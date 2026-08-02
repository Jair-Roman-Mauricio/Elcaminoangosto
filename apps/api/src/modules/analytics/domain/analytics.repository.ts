/** Entidades de dominio. TypeScript puro: sin Nest, sin Drizzle. */

export type TipoDeContenido = 'VIDEO' | 'POST' | 'SONG'

/**
 * Cómo se ordena un ranking. «vistas» cuenta cada reproducción; «visitantes»
 * cuenta sesiones distintas, que responde a otra pregunta: si algo llega a
 * mucha gente o si a poca que repite.
 */
export type OrdenDeRanking = 'vistas' | 'visitantes'

/** Una pieza en el ranking de lo más visto o escuchado. */
export interface ContenidoMasVisto {
  contentId: string
  titulo: string
  /** Álbum de la canción o serie del video; nulo si no aplica. */
  contexto: string | null
  vistas: number
  /** Personas distintas: una sesión que repite no cuenta diez veces. */
  visitantes: number
  ultimaVista: Date | null
}

/** Álbum ordenado por escuchas de sus canciones. */
export interface AlbumMasEscuchado {
  albumId: string
  titulo: string
  numero: string | null
  escuchas: number
  canciones: number
}

/** Un día del flujo de visitas. */
export interface DiaDeVisitas {
  dia: string
  /** Sesiones distintas sin cuenta. */
  anonimos: number
  /** Sesiones distintas con sesión iniciada. */
  registrados: number
}

/** Resumen del flujo de quien entra sin cuenta. */
export interface FlujoDeVisitantes {
  /** Sesiones distintas sin cuenta en el periodo. */
  visitantesAnonimos: number
  /** Sesiones distintas que sí tenían cuenta. */
  visitantesRegistrados: number
  /**
   * Sesiones que empezaron sin cuenta y acabaron con una: la conversión que
   * de verdad importa.
   */
  sesionesQueSeRegistraron: number
  porDia: DiaDeVisitas[]
  porSeccion: { seccion: string; visitas: number; anonimos: number }[]
}

export abstract class AnalyticsRepository {
  /** Registra una vista de contenido. */
  abstract registrarVista(input: {
    kind: TipoDeContenido
    contentId: string
    viewerId: string | null
    sessionId: string
  }): Promise<void>

  /** Registra la entrada a una sección. */
  abstract registrarVisita(input: {
    section: string
    viewerId: string | null
    sessionId: string
  }): Promise<void>

  /**
   * Ranking de lo más visto de un tipo. `busqueda` filtra por título; `desde`
   * acota el periodo.
   */
  abstract masVistos(input: {
    kind: TipoDeContenido
    desde: Date
    busqueda: string | null
    orden: OrdenDeRanking
    limite: number
  }): Promise<ContenidoMasVisto[]>

  /** Álbumes ordenados por escuchas acumuladas de sus canciones. */
  abstract albumesMasEscuchados(input: {
    desde: Date
    busqueda: string | null
    limite: number
  }): Promise<AlbumMasEscuchado[]>

  abstract flujoDeVisitantes(desde: Date): Promise<FlujoDeVisitantes>
}
