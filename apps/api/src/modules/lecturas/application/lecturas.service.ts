import { createHash } from 'node:crypto'
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import {
  LecturasRepository,
  type ComentarioDeLecturaEntity,
  type LecturaEntity,
  type OracionEntity,
  type TipoDeLectura,
} from '../domain/lecturas.repository'
import { MediaService } from '../../media'
import type { Actor } from '../../shared'

/** Una lectura como la consume la interfaz, con la portada ya firmada. */
export interface LecturaCard {
  id: string
  tipo: TipoDeLectura
  titulo: string
  entradilla: string | null
  /** Markdown: párrafos, subtítulos e imágenes. */
  cuerpo: string
  seccion: string | null
  autor: string
  referencia: string | null
  /** Redes que acompañan al artículo, de «red» a dirección. */
  redes: Record<string, string>
  portadaUrl: string | null
  /** Recorte sin fondo para la página del devocional. */
  ilustracionUrl: string | null
  fondo: string | null
  /** Minutos de lectura, calculados del propio texto. */
  minutos: number
  publishedAt: string | null
  oculto: boolean
}

/** Un comentario de artículo, con alias en vez de huella. */
export interface ComentarioDeLectura {
  id: string
  autor: string
  mensaje: string
  createdAt: string
  oculto: boolean
}

/** Una oración como la consume la interfaz, con el audio ya firmado. */
export interface OracionCard {
  id: string
  titulo: string
  tema: string | null
  lineas: string[]
  /** Segundo en que empieza cada línea. Nulo: la interfaz las reparte. */
  marcas: number[] | null
  audioUrl: string
  publishedAt: string | null
  oculto: boolean
}

/** Palabras por minuto de una lectura pausada, que es como se lee esto. */
const PALABRAS_POR_MINUTO = 180

/**
 * Cuenta las palabras de un Markdown, sin contar sus marcas.
 *
 * Una imagen no se lee y un `##` no es una palabra: incluirlos inflaba los
 * minutos de un artículo ilustrado y prometía más tiempo del que cuesta.
 */
function palabrasDe(markdown: string): number {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // imágenes
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // enlaces: queda el texto
    .replace(/^[#>\-*\d.\s]+/gm, ' ') // marcas de bloque al inicio de línea
    .replace(/[*_`~]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length
}

/**
 * API pública del bounded context `lecturas`.
 *
 * Todo el contenido es abierto: se lee y se comenta sin cuenta, como el resto
 * de la plataforma. Publicar y retirar es solo del ADMIN.
 */
@Injectable()
export class LecturasService {
  /** Cuántos comentarios puede escribir una persona por hora. */
  private static readonly LIMITE_POR_HORA = 20

  constructor(
    private readonly lecturas: LecturasRepository,
    private readonly media: MediaService,
  ) {}

  // ── Lecturas: devocionales y artículos ───────────────────────────────────

  async listar(actor: Actor | null, tipo: TipoDeLectura): Promise<LecturaCard[]> {
    const admin = this.esAdmin(actor)
    const filas = await this.lecturas.lecturas(tipo, admin)
    return Promise.all(filas.map((fila) => this.aLectura(fila)))
  }

  async ver(actor: Actor | null, id: string): Promise<LecturaCard> {
    const fila = await this.lecturas.lectura(id, this.esAdmin(actor))
    if (!fila) throw new NotFoundException('Esa lectura no existe')
    return this.aLectura(fila)
  }

  async publicar(
    actor: Actor,
    input: {
      tipo: TipoDeLectura
      titulo: string
      entradilla: string | null
      cuerpo: string
      seccion: string | null
      autor: string
      referencia: string | null
      redes: Record<string, string>
      portadaAssetId: string | null
      ilustracionAssetId: string | null
      fondo: string | null
    },
  ): Promise<{ id: string }> {
    this.exigirAdmin(actor)
    const fila = await this.lecturas.crearLectura({
      ...input,
      cuerpo: this.exigirTexto(input.cuerpo),
      // Se publica al crearse: el admin ya decidió al pulsar publicar.
      publishedAt: new Date(),
    })
    return { id: fila.id }
  }

  async editar(
    actor: Actor,
    id: string,
    cambios: {
      titulo?: string | undefined
      entradilla?: string | null | undefined
      cuerpo?: string | undefined
      seccion?: string | null | undefined
      autor?: string | undefined
      referencia?: string | null | undefined
      redes?: Record<string, string> | undefined
      portadaAssetId?: string | null | undefined
      ilustracionAssetId?: string | null | undefined
      fondo?: string | null | undefined
      oculto?: boolean | undefined
    },
  ): Promise<void> {
    this.exigirAdmin(actor)
    const { oculto, cuerpo, ...resto } = cambios
    await this.lecturas.editarLectura(id, {
      ...resto,
      ...(cuerpo === undefined ? {} : { cuerpo: this.exigirTexto(cuerpo) }),
      ...(oculto === undefined ? {} : { estado: oculto ? 'OCULTO' : 'VISIBLE' }),
    })
  }

  /** Tres lecturas para seguir después de esta. Vacío si no hay más. */
  async relacionadas(actor: Actor | null, id: string): Promise<LecturaCard[]> {
    const fila = await this.lecturas.lectura(id, this.esAdmin(actor))
    if (!fila) throw new NotFoundException('Esa lectura no existe')
    const filas = await this.lecturas.relacionadas({
      excluir: fila.id,
      tipo: fila.tipo,
      seccion: fila.seccion,
      limite: 3,
    })
    return Promise.all(filas.map((otra) => this.aLectura(otra)))
  }

  async eliminar(actor: Actor, id: string): Promise<void> {
    this.exigirAdmin(actor)
    await this.lecturas.eliminarLectura(id)
  }

  // ── Conversación bajo un artículo ────────────────────────────────────────

  /**
   * Comentarios de un artículo.
   *
   * Los alias se calculan al leer y no se guardan, igual que en la comunidad:
   * la misma persona es «Caminante 2» aquí y otro número en otro artículo. Es
   * lo justo para seguir una conversación sin convertir el anonimato en un
   * seudónimo perseguible.
   */
  async comentarios(actor: Actor | null, lecturaId: string): Promise<ComentarioDeLectura[]> {
    const filas = await this.lecturas.comentariosDe(lecturaId, this.esAdmin(actor))
    const alias = new Map<string, string>()
    for (const fila of [...filas].reverse()) {
      if (!alias.has(fila.autorHuella)) alias.set(fila.autorHuella, `Caminante ${alias.size + 1}`)
    }
    return filas.map((fila) => this.aComentario(fila, alias.get(fila.autorHuella)!))
  }

  /** Comentar no pide cuenta: no hay cuentas. Solo los artículos lo admiten. */
  async comentar(input: {
    lecturaId: string
    cuerpo: string
    autorId: string
  }): Promise<ComentarioDeLectura> {
    const lectura = await this.lecturas.lectura(input.lecturaId, false)
    if (!lectura) throw new NotFoundException('Ese artículo no existe')
    if (lectura.tipo !== 'ARTICULO') {
      throw new BadRequestException('Un devocional se lee, no se comenta')
    }

    const limpio = input.autorId.trim()
    if (limpio.length < 16) throw new BadRequestException('Identificador de autor inválido')
    const cuerpo = input.cuerpo.trim()
    if (!cuerpo) throw new BadRequestException('El comentario está vacío')
    if (cuerpo.length > 1000) throw new BadRequestException('El comentario es demasiado largo')

    const huella = createHash('sha256').update(limpio).digest('hex')
    const haceUnaHora = new Date(Date.now() - 60 * 60 * 1000)
    if (
      (await this.lecturas.comentariosDesde(huella, haceUnaHora)) >= LecturasService.LIMITE_POR_HORA
    ) {
      throw new ForbiddenException(
        'Has comentado mucho en poco tiempo. Espera un momento antes de volver a escribir.',
      )
    }

    const fila = await this.lecturas.comentar({
      lecturaId: input.lecturaId,
      cuerpo,
      autorHuella: huella,
    })
    return this.aComentario(fila, 'Tú')
  }

  async ocultarComentario(actor: Actor, id: string, oculto: boolean): Promise<void> {
    this.exigirAdmin(actor)
    await this.lecturas.cambiarEstadoDeComentario(id, oculto ? 'OCULTO' : 'VISIBLE')
  }

  // ── Oraciones guiadas ────────────────────────────────────────────────────

  /**
   * Una oración sin su voz no es una oración guiada, así que se queda fuera del
   * listado; lo que no puede es llevarse por delante a las demás. Ya pasó en el
   * feed: un medio que aún no estaba listo dejaba la sección entera en blanco.
   */
  async oraciones(actor: Actor | null): Promise<OracionCard[]> {
    const filas = await this.lecturas.oraciones(this.esAdmin(actor))
    const cards = await Promise.all(filas.map((fila) => this.aOracion(fila).catch(() => null)))
    return cards.filter((card): card is OracionCard => card !== null)
  }

  async publicarOracion(
    actor: Actor,
    input: {
      titulo: string
      tema: string | null
      lineas: string[]
      marcas: number[] | null
      audioAssetId: string
    },
  ): Promise<{ id: string }> {
    this.exigirAdmin(actor)
    const lineas = this.exigirLineas(input.lineas)
    const fila = await this.lecturas.crearOracion({
      ...input,
      lineas,
      marcas: this.marcasValidas(input.marcas, lineas.length),
      publishedAt: new Date(),
    })
    return { id: fila.id }
  }

  async editarOracion(
    actor: Actor,
    id: string,
    cambios: {
      titulo?: string | undefined
      tema?: string | null | undefined
      lineas?: string[] | undefined
      marcas?: number[] | null | undefined
      audioAssetId?: string | undefined
      oculto?: boolean | undefined
    },
  ): Promise<void> {
    this.exigirAdmin(actor)
    const { oculto, lineas, marcas, ...resto } = cambios
    const limpias = lineas ? this.exigirLineas(lineas) : undefined
    await this.lecturas.editarOracion(id, {
      ...resto,
      ...(limpias ? { lineas: limpias } : {}),
      ...(marcas === undefined ? {} : { marcas: this.marcasValidas(marcas, limpias?.length ?? 0) }),
      ...(oculto === undefined ? {} : { estado: oculto ? 'OCULTO' : 'VISIBLE' }),
    })
  }

  async eliminarOracion(actor: Actor, id: string): Promise<void> {
    this.exigirAdmin(actor)
    await this.lecturas.eliminarOracion(id)
  }

  // ── Interioridades ───────────────────────────────────────────────────────

  private async aLectura(fila: LecturaEntity): Promise<LecturaCard> {
    const palabras = palabrasDe(fila.cuerpo)
    return {
      id: fila.id,
      tipo: fila.tipo,
      titulo: fila.titulo,
      entradilla: fila.entradilla,
      cuerpo: fila.cuerpo,
      seccion: fila.seccion,
      autor: fila.autor,
      referencia: fila.referencia,
      redes: fila.redes,
      portadaUrl: fila.portadaAssetId
        ? await this.media.urlDeLectura(fila.portadaAssetId, true).catch(() => null)
        : null,
      ilustracionUrl: fila.ilustracionAssetId
        ? await this.media.urlDeLectura(fila.ilustracionAssetId, true).catch(() => null)
        : null,
      fondo: fila.fondo,
      // Nunca cero: «menos de un minuto» se dice con un 1, no con un 0.
      minutos: Math.max(1, Math.round(palabras / PALABRAS_POR_MINUTO)),
      publishedAt: fila.publishedAt?.toISOString() ?? null,
      oculto: fila.estado === 'OCULTO',
    }
  }

  private aComentario(fila: ComentarioDeLecturaEntity, autor: string): ComentarioDeLectura {
    return {
      id: fila.id,
      autor,
      mensaje: fila.cuerpo,
      createdAt: fila.createdAt.toISOString(),
      oculto: fila.estado === 'OCULTO',
    }
  }

  private async aOracion(fila: OracionEntity): Promise<OracionCard> {
    return {
      id: fila.id,
      titulo: fila.titulo,
      tema: fila.tema,
      lineas: fila.lineas,
      marcas: fila.marcas,
      audioUrl: await this.media.urlDeLectura(fila.audioAssetId, true),
      publishedAt: fila.publishedAt?.toISOString() ?? null,
      oculto: fila.estado === 'OCULTO',
    }
  }

  /** Limpia las líneas de una oración: sin vacías ni todo en blanco. */
  private exigirLineas(crudas: string[]): string[] {
    const limpias = crudas.map((l) => l.trim()).filter(Boolean)
    if (limpias.length === 0) throw new BadRequestException('La oración no puede estar vacía')
    return limpias
  }

  /** Un cuerpo en blanco no es una lectura, por muchos saltos que traiga. */
  private exigirTexto(crudo: string): string {
    const limpio = crudo.trim()
    if (!limpio) throw new BadRequestException('La lectura no puede estar vacía')
    return limpio
  }

  /**
   * Las marcas solo valen si hay una por línea y van en orden.
   *
   * Una lista a medias es peor que ninguna: la interfaz sabe repartir por
   * longitud, pero no sabe qué hacer con un texto que se ilumina hacia atrás.
   */
  private marcasValidas(marcas: number[] | null | undefined, lineas: number): number[] | null {
    if (!marcas || marcas.length === 0) return null
    if (marcas.length !== lineas) {
      throw new BadRequestException('Hay que dar una marca de tiempo por línea, o ninguna')
    }
    if (!marcas.every((m, i) => i === 0 || m >= marcas[i - 1]!)) {
      throw new BadRequestException('Las marcas de tiempo no van en orden')
    }
    return marcas
  }

  private esAdmin(actor: Actor | null): boolean {
    return actor?.role === 'ADMIN'
  }

  private exigirAdmin(actor: Actor): void {
    if (!this.esAdmin(actor)) throw new ForbiddenException('Solo un admin publica lecturas')
  }
}
