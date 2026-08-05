/** Entidades de dominio. TypeScript puro: sin Nest, sin Drizzle. */

export type TipoDeContenido = 'VIDEO' | 'POST' | 'SONG'

/**
 * Cómo se ordena un ranking. «vistas» cuenta cada reproducción; «visitantes»
 * cuenta sesiones distintas, que responde a otra pregunta: si algo llega a
 * muchos o si a pocos que repiten.
 */
export type OrdenDeRanking = 'vistas' | 'visitantes'

/** Una pieza en el ranking de lo más visto o escuchado. */
export interface ContenidoMasVisto {
  contentId: string
  titulo: string
  /** Álbum de la canción o serie del video; nulo si no aplica. */
  contexto: string | null
  vistas: number
  /** Sesiones distintas: una que repite no cuenta diez veces. */
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
  /** Sesiones distintas que entraron ese día. */
  visitantes: number
  /** Entradas a secciones: una sesión que recorre cuatro cuenta cuatro. */
  visitas: number
}

/**
 * Resumen de quién entra.
 *
 * Ya no se separa entre registrados y anónimos: **nadie tiene cuenta salvo la
 * administración**, así que esa división medía una sola cosa —si el admin
 * estaba con la sesión abierta— y no decía nada del público. Ese tráfico se
 * descuenta, no se cuenta aparte: mirar tu propia plataforma no es una visita.
 */
export interface FlujoDeVisitantes {
  /** Sesiones distintas en el periodo. */
  visitantes: number
  /** Entradas a secciones. */
  visitas: number
  /** Piezas abiertas: videos, tarjetas y canciones juntos. */
  vistasDeContenido: number
  porDia: DiaDeVisitas[]
  porSeccion: { seccion: string; visitas: number; visitantes: number }[]
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
