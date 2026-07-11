import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import {
  BucketSchema,
  MediaKindSchema,
  SIGNED_URL_TTL_SECONDS,
  isPrivateBucket,
  type Bucket,
  type MediaKind,
} from '@elcamino/shared-types'
import { MediaRepository, type MediaAssetEntity } from '../domain/media.repository'
import { MediaStoragePort, MediaQueuePort } from '../domain/media-storage.port'
import type { Actor } from '../../shared'

/** Extensiones aceptadas por tipo. La ruta la construye el API, no el cliente. */
const EXT: Record<MediaKind, string> = { VIDEO: 'mp4', AUDIO: 'mp3', IMAGE: 'jpg' }

/**
 * API pública del bounded context `media`. Ingesta (subida reanudable),
 * transcodificación asíncrona y entrega por URL firmada (arquitectura.md §6).
 */
@Injectable()
export class MediaService {
  constructor(
    private readonly assets: MediaRepository,
    private readonly storage: MediaStoragePort,
    private readonly queue: MediaQueuePort,
  ) {}

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
   * HU-8.2 — el cliente avisa de que terminó la subida; se encola la
   * transcodificación. Solo el dueño puede disparar el proceso de su asset.
   */
  async encolarProcesamiento(actor: Actor, assetId: string): Promise<void> {
    const asset = await this.propioAsset(actor, assetId)
    await this.queue.enqueueTranscode({
      assetId: asset.id,
      bucket: asset.bucket,
      path: asset.path,
      kind: asset.kind,
    })
  }

  /**
   * HU-8.3 — URL firmada de corta vida para reproducir un medio privado, tras
   * validar que el actor puede verlo. La autorización fina (inscripción, feed
   * publicado) la resuelve quien llama, pasando un `puedeVer` ya evaluado.
   */
  async urlDeLectura(assetId: string, autorizado: boolean): Promise<string> {
    if (!autorizado) throw new ForbiddenException('No tienes acceso a este medio')
    const asset = await this.assets.findById(assetId)
    if (!asset) throw new NotFoundException('Medio no encontrado')
    if (asset.status !== 'READY') throw new NotFoundException('El medio aún no está listo')

    // Preferir el póster/derivado listo; el MP4 normalizado vive en `path`.
    return this.storage.signedUrl(asset.bucket, asset.path, SIGNED_URL_TTL_SECONDS)
  }

  /** URL firmada del póster (imagen de portada del video). */
  async urlDePoster(assetId: string, autorizado: boolean): Promise<string | null> {
    if (!autorizado) throw new ForbiddenException('No tienes acceso a este medio')
    const asset = await this.assets.findById(assetId)
    if (!asset?.posterPath) return null
    return this.storage.signedUrl(asset.bucket, asset.posterPath, SIGNED_URL_TTL_SECONDS)
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
