import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'
import {
  BucketSchema,
  MediaKindSchema,
  SIGNED_URL_TTL_SECONDS,
  isPrivateBucket,
  type Bucket,
  type MediaKind,
} from '@elcamino/shared-types'
import { MediaRepository, type MediaAssetEntity } from '../domain/media.repository'
import {
  MediaStoragePort,
  MediaQueuePort,
  type TransformacionDeImagen,
} from '../domain/media-storage.port'
import type { Actor } from '../../shared'

/** Extensiones aceptadas por tipo. La ruta la construye el API, no el cliente. */
const EXT: Record<MediaKind, string> = { VIDEO: 'mp4', AUDIO: 'mp3', IMAGE: 'jpg' }

/** Margen para encolar antes de dar la cola por caída. */
const ENQUEUE_TIMEOUT_MS = 5_000

/**
 * Cuánto se reutiliza una URL firmada antes de volver a pedirla.
 *
 * Diez minutos por debajo de su caducidad real, para que a nadie se le venza
 * el enlace con el archivo a medio descargar.
 */
const VIDA_UTIL_MS = (SIGNED_URL_TTL_SECONDS - 10 * 60) * 1000

/** A partir de aquí se barren las entradas ya vencidas. */
const ENTRADAS_ANTES_DE_BARRER = 500

/** Calidad del redimensionado. Ver `TransformacionDeImagen`. */
const CALIDAD_DE_IMAGEN = 75

/**
 * El alto se pide al doble del ancho: más de lo que mide cualquier imagen que
 * se suba aquí, así que quien manda es el ancho y la proporción se conserva.
 */
const transformacionDe = (ancho: number): TransformacionDeImagen => ({
  width: ancho,
  height: ancho * 2,
  resize: 'contain',
  quality: CALIDAD_DE_IMAGEN,
})

/**
 * API pública del bounded context `media`. Ingesta (subida reanudable),
 * transcodificación asíncrona y entrega por URL firmada (arquitectura.md §6).
 */
@Injectable()
export class MediaService {
  /**
   * URLs firmadas ya emitidas, por asset.
   *
   * Firmar es una llamada de red a Supabase y una consulta más a la BD, y el
   * catálogo de Alabanza lo hacía 43 veces por visita. Pero lo caro de verdad
   * era otra cosa: cada firma nueva cambia el enlace, y un enlace que cambia
   * es un objeto nuevo para la CDN y para el navegador. Nadie reutilizaba
   * nada; cada visita se traía todos los audios desde el origen.
   *
   * Reutilizar la misma URL mientras siga siendo válida convierte esa segunda
   * visita en un acierto de caché.
   */
  private readonly firmadas = new Map<string, { url: string; expiraEn: number }>()

  constructor(
    private readonly assets: MediaRepository,
    private readonly storage: MediaStoragePort,
    private readonly queue: MediaQueuePort,
  ) {}

  /** Devuelve la URL guardada si aún sirve; si no, la pide y la guarda. */
  private async firmadaConCache(
    clave: string,
    construir: () => Promise<string | null>,
  ): Promise<string | null> {
    const ahora = Date.now()
    const guardada = this.firmadas.get(clave)
    if (guardada && guardada.expiraEn > ahora) return guardada.url

    const url = await construir()
    if (url) {
      if (this.firmadas.size >= ENTRADAS_ANTES_DE_BARRER) {
        for (const [k, v] of this.firmadas) if (v.expiraEn <= ahora) this.firmadas.delete(k)
      }
      this.firmadas.set(clave, { url, expiraEn: ahora + VIDA_UTIL_MS })
    }
    return url
  }

  /** Olvida lo firmado de un asset: lo que ya no existe no se sirve de caché. */
  private olvidarFirmas(assetId: string): void {
    // La clave lleva el ancho pedido, así que puede haber varias por asset.
    for (const clave of this.firmadas.keys()) {
      if (clave.includes(`:${assetId}:`) || clave.endsWith(`:${assetId}`)) {
        this.firmadas.delete(clave)
      }
    }
  }

  /**
   * HU-8.1 — reserva un asset para una subida reanudable. Devuelve el destino
   * (bucket + path); el cliente sube ahí por TUS con su propio JWT. La ruta
   * incluye el `ownerId` como carpeta: así las políticas de Storage por
   * carpeta (migración de buckets) impiden escribir en la ajena.
   */
  async crearSubida(
    actor: Actor,
    input: { kind: MediaKind; bucket: Bucket },
  ): Promise<{ assetId: string; bucket: Bucket; path: string }> {
    const kind = MediaKindSchema.parse(input.kind)
    const bucket = BucketSchema.parse(input.bucket)

    // Solo maestros y admins publican en buckets privados de contenido.
    if (isPrivateBucket(bucket) && actor.role === 'ESTUDIANTE') {
      throw new ForbiddenException('No tienes permiso para subir a este bucket')
    }

    const assetId = crypto.randomUUID()
    const path = `${actor.id}/${assetId}/original.${EXT[kind]}`
    const asset = await this.assets.create({ ownerId: actor.id, bucket, path, kind })
    return { assetId: asset.id, bucket, path }
  }

  /**
   * HU-8.2 — el cliente avisa de que terminó la subida. Solo el dueño puede
   * disparar el proceso de su asset.
   *
   * Ni una IMAGEN ni un AUDIO se transcodifican: para la imagen el worker se
   * limitaba a usarla como su propio póster, y del audio no saca derivados. Se
   * marcan READY aquí mismo, así una tarjeta o una canción se publican sin
   * depender de la cola ni del worker. Solo el VIDEO pasa por ffmpeg.
   */
  async encolarProcesamiento(actor: Actor, assetId: string): Promise<void> {
    const asset = await this.propioAsset(actor, assetId)

    if (asset.kind === 'IMAGE' || asset.kind === 'AUDIO') {
      await this.assets.markReady(asset.id, {
        posterPath: asset.kind === 'IMAGE' ? asset.path : null,
        durationSeconds: null,
      })
      return
    }

    await this.encolarConLimite({
      assetId: asset.id,
      bucket: asset.bucket,
      path: asset.path,
      kind: asset.kind,
    })
  }

  /**
   * Encola con un límite de espera. `ioredis` reintenta la conexión sin fin, así
   * que con Redis caído `enqueueTranscode` no resuelve nunca y la petición se
   * quedaba colgada hasta que el cliente cortaba por timeout. Mejor fallar
   * pronto y decir qué pasa.
   */
  private async encolarConLimite(trabajo: {
    assetId: string
    bucket: string
    path: string
    kind: MediaKind
  }): Promise<void> {
    const limite = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new ServiceUnavailableException('La cola de procesamiento no responde')),
        ENQUEUE_TIMEOUT_MS,
      ),
    )
    await Promise.race([this.queue.enqueueTranscode(trabajo), limite])
  }

  /**
   * HU-8.3 — URL firmada de corta vida para reproducir un medio privado, tras
   * validar que el actor puede verlo. La autorización fina (inscripción, feed
   * publicado) la resuelve quien llama, pasando un `puedeVer` ya evaluado.
   */
  async urlDeLectura(assetId: string, autorizado: boolean, ancho?: number): Promise<string> {
    if (!autorizado) throw new ForbiddenException('No tienes acceso a este medio')

    // Solo se guarda lo que ya estaba listo, así que un medio que aún se
    // procesa nunca se queda cacheado como «no disponible».
    const url = await this.firmadaConCache(`lectura:${assetId}:${ancho ?? 0}`, async () => {
      const asset = await this.assets.findById(assetId)
      if (!asset) throw new NotFoundException('Medio no encontrado')
      if (asset.status !== 'READY') throw new NotFoundException('El medio aún no está listo')

      // Preferir el póster/derivado listo; el MP4 normalizado vive en `path`.
      return this.storage.signedUrl(
        asset.bucket,
        asset.path,
        SIGNED_URL_TTL_SECONDS,
        this.transformacionPara(asset, ancho),
      )
    })
    if (!url) throw new NotFoundException('Medio no encontrado')
    return url
  }

  /**
   * El ancho solo manda si el medio es una imagen. Pedirle un `width` a un MP3
   * no lo encoge: lo rompe.
   */
  private transformacionPara(
    asset: MediaAssetEntity,
    ancho: number | undefined,
  ): TransformacionDeImagen | undefined {
    if (!ancho || asset.kind !== 'IMAGE') return undefined
    return transformacionDe(ancho)
  }

  /**
   * URL firmada del archivo ORIGINAL subido, sin exigir que esté transcodificado.
   * Sirve para que el dueño (maestro) previsualice su video en cuanto lo sube,
   * antes de que el worker lo procese.
   */
  async urlDeOrigen(assetId: string, autorizado: boolean): Promise<string | null> {
    if (!autorizado) throw new ForbiddenException('No tienes acceso a este medio')
    return this.firmadaConCache(`origen:${assetId}`, async () => {
      const asset = await this.assets.findById(assetId)
      if (!asset) return null
      return this.storage.signedUrl(asset.bucket, asset.path, SIGNED_URL_TTL_SECONDS)
    })
  }

  /** Borra un medio: el objeto (y su póster) del storage y su registro. */
  async eliminar(assetId: string): Promise<void> {
    const asset = await this.assets.findById(assetId)
    if (!asset) return
    const rutas = [asset.path, ...(asset.posterPath ? [asset.posterPath] : [])]
    await this.storage.remove(asset.bucket, rutas)
    await this.assets.delete(assetId)
    this.olvidarFirmas(assetId)
  }

  /** URL firmada del póster (imagen de portada del video). */
  async urlDePoster(assetId: string, autorizado: boolean, ancho?: number): Promise<string | null> {
    if (!autorizado) throw new ForbiddenException('No tienes acceso a este medio')
    return this.firmadaConCache(`poster:${assetId}:${ancho ?? 0}`, async () => {
      const asset = await this.assets.findById(assetId)
      if (!asset?.posterPath) return null
      // El póster SIEMPRE es una imagen, aunque el asset sea un video.
      return this.storage.signedUrl(
        asset.bucket,
        asset.posterPath,
        SIGNED_URL_TTL_SECONDS,
        ancho ? transformacionDe(ancho) : undefined,
      )
    })
  }

  /** Estado de un asset (para que el front sepa cuándo dejar de esperar). */
  async estado(assetId: string): Promise<MediaAssetEntity> {
    const asset = await this.assets.findById(assetId)
    if (!asset) throw new NotFoundException('Medio no encontrado')
    return asset
  }

  private async propioAsset(actor: Actor, assetId: string): Promise<MediaAssetEntity> {
    const asset = await this.assets.findById(assetId)
    if (!asset) throw new NotFoundException('Medio no encontrado')
    if (asset.ownerId !== actor.id && actor.role !== 'ADMIN') {
      throw new ForbiddenException('Este medio no es tuyo')
    }
    return asset
  }
}
