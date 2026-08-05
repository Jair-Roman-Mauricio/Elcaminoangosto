/** Entidades de dominio. TypeScript puro: sin Nest, sin Drizzle. */

export type EstadoDePublicacion = 'VISIBLE' | 'OCULTO'

/**
 * Qué es esta lectura.
 *
 * Un DEVOCIONAL es breve: una historia con su cierre y una portada, para leer
 * de una sentada. Un ARTICULO va más hondo, admite conversación debajo y por
 * eso vive en la revista. Comparten forma —portada, título, cuerpo, firma— así
 * que comparten tabla; lo que cambia es dónde se leen y qué permiten.
 */
export type TipoDeLectura = 'DEVOCIONAL' | 'ARTICULO'

/** Una lectura tal como se guarda. */
export interface LecturaEntity {
  id: string
  tipo: TipoDeLectura
  titulo: string
  entradilla: string | null
  /**
   * Cuerpo en Markdown: párrafos, subtítulos que parten el texto en secciones
   * e imágenes dentro de ellas. Las imágenes viven en un bucket público, así
   * que sus direcciones no caducan y pueden viajar dentro del propio texto.
   */
  cuerpo: string
  /** Sección dentro de la revista: «Testimonio», «Familia»… Nula en un devocional. */
  seccion: string | null
  autor: string
  referencia: string | null
  /**
   * Redes que acompañan al artículo, de «red» a dirección. Van por lectura
   * porque un artículo firmado por alguien de fuera lleva las suyas.
   */
  redes: Record<string, string>
  portadaAssetId: string | null
  /** Recorte sin fondo que acompaña al devocional dentro de su página. */
  ilustracionAssetId: string | null
  /** Telón de fondo: la clave de uno de los que trae la interfaz, o nada. */
  fondo: string | null
  estado: EstadoDePublicacion
  publishedAt: Date | null
  createdAt: Date
}

/** Un comentario de artículo. Anónimo, como el resto de la plataforma. */
export interface ComentarioDeLecturaEntity {
  id: string
  lecturaId: string
  cuerpo: string
  autorHuella: string
  estado: EstadoDePublicacion
  createdAt: Date
}

/** Una oración guiada tal como se guarda. */
export interface OracionEntity {
  id: string
  titulo: string
  tema: string | null
  /** Líneas que se iluminan una a una. */
  lineas: string[]
  /** Segundo en que empieza cada línea, si se conoce. */
  marcas: number[] | null
  audioAssetId: string
  estado: EstadoDePublicacion
  publishedAt: Date | null
  createdAt: Date
}

/** Los cambios llegan de un cuerpo parcial: admiten `undefined` explícito. */
type Cambios<T> = { [K in keyof T]?: T[K] | undefined }

/**
 * Puerto de las lecturas: devocionales, artículos de revista y oraciones.
 *
 * Van juntos porque comparten forma —texto publicado por la administración y
 * abierto a cualquiera— y separarlos habría duplicado la estructura entera sin
 * compartir nada más que la duplicación.
 */
export abstract class LecturasRepository {
  abstract lecturas(tipo: TipoDeLectura, incluirOcultas: boolean): Promise<LecturaEntity[]>
  abstract lectura(id: string, incluirOcultas: boolean): Promise<LecturaEntity | null>
  abstract crearLectura(
    input: Omit<LecturaEntity, 'id' | 'estado' | 'createdAt'>,
  ): Promise<LecturaEntity>
  abstract editarLectura(
    id: string,
    cambios: Cambios<Omit<LecturaEntity, 'id' | 'createdAt'>>,
  ): Promise<void>
  abstract eliminarLectura(id: string): Promise<void>
  /**
   * Otras lecturas del mismo tipo para seguir leyendo. Las de la misma sección
   * primero: quien termina un artículo de «Familia» suele querer otro de
   * «Familia», no lo más reciente que se haya publicado.
   */
  abstract relacionadas(input: {
    excluir: string
    tipo: TipoDeLectura
    seccion: string | null
    limite: number
  }): Promise<LecturaEntity[]>

  // ── Conversación bajo un artículo ────────────────────────────────────────

  abstract comentariosDe(
    lecturaId: string,
    incluirOcultos: boolean,
  ): Promise<ComentarioDeLecturaEntity[]>
  abstract comentar(input: {
    lecturaId: string
    cuerpo: string
    autorHuella: string
  }): Promise<ComentarioDeLecturaEntity>
  abstract comentariosDesde(autorHuella: string, desde: Date): Promise<number>
  abstract cambiarEstadoDeComentario(id: string, estado: EstadoDePublicacion): Promise<void>

  // ── Oraciones guiadas ────────────────────────────────────────────────────

  abstract oraciones(incluirOcultas: boolean): Promise<OracionEntity[]>
  abstract oracion(id: string, incluirOcultas: boolean): Promise<OracionEntity | null>
  abstract crearOracion(
    input: Omit<OracionEntity, 'id' | 'estado' | 'createdAt'>,
  ): Promise<OracionEntity>
  abstract editarOracion(
    id: string,
    cambios: Cambios<Omit<OracionEntity, 'id' | 'createdAt'>>,
  ): Promise<void>
  abstract eliminarOracion(id: string): Promise<void>
}
