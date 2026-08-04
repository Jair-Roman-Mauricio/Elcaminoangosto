/** Un hilo tal como se lista: sin cuerpo, que solo hace falta al abrirlo. */
export interface HiloResumen {
  id: string
  titulo: string
  respuestas: number
  ultimaActividad: Date
  createdAt: Date
}

export interface HiloEntity extends HiloResumen {
  cuerpo: string
  autorHuella: string
  estado: 'VISIBLE' | 'OCULTO'
}

export interface RespuestaEntity {
  id: string
  hiloId: string
  /** Respuesta a la que contesta; `null` si contesta al hilo. */
  respuestaPadreId: string | null
  cuerpo: string
  autorHuella: string
  estado: 'VISIBLE' | 'OCULTO'
  createdAt: Date
}

/**
 * Puerto de la comunidad.
 *
 * `autorHuella` nunca sale de este contexto hacia la interfaz: se traduce a un
 * alias dentro del hilo. Es un identificador seudónimo y publicarlo permitiría
 * cruzar lo que alguien escribió en hilos distintos.
 */
export abstract class CommunityRepository {
  /** Hilos visibles, del de actividad más reciente al más antiguo. */
  abstract listarHilos(input: {
    busqueda: string | null
    limite: number
    incluirOcultos: boolean
  }): Promise<HiloResumen[]>

  abstract buscarHilo(id: string, incluirOcultos: boolean): Promise<HiloEntity | null>

  abstract respuestasDe(hiloId: string, incluirOcultas: boolean): Promise<RespuestaEntity[]>

  /** Una respuesta suelta. Hace falta para validar a quién contesta otra. */
  abstract buscarRespuesta(id: string): Promise<RespuestaEntity | null>

  abstract crearHilo(input: {
    titulo: string
    cuerpo: string
    autorHuella: string
  }): Promise<HiloEntity>

  abstract responder(input: {
    hiloId: string
    respuestaPadreId: string | null
    cuerpo: string
    autorHuella: string
  }): Promise<RespuestaEntity>

  /** Cuántas publicaciones lleva esa huella desde un instante dado. */
  abstract publicacionesDesde(autorHuella: string, desde: Date): Promise<number>

  abstract cambiarEstadoDeHilo(id: string, estado: 'VISIBLE' | 'OCULTO'): Promise<void>
  abstract cambiarEstadoDeRespuesta(id: string, estado: 'VISIBLE' | 'OCULTO'): Promise<void>
  abstract eliminarHilo(id: string): Promise<void>
}
