/**
 * Puerto de almacenamiento de medios. El dominio no sabe si detrás está
 * Supabase Storage, Mux o Cloudflare Stream (Strategy, arquitectura.md §4).
 */
/**
 * Redimensionado al vuelo, para no mandar una foto de tres megas a una tarjeta
 * de trescientos píxeles. Solo tiene sentido en imágenes.
 */
export interface TransformacionDeImagen {
  /** Ancho en píxeles del archivo servido. */
  width: number
  /**
   * Alto máximo. Va siempre acompañado de `resize: 'contain'` y se pide
   * holgado, porque su papel es no estorbar: con solo `width`, Supabase
   * entrega el ancho pedido y CONSERVA el alto original, es decir, deforma.
   */
  height: number
  /** `contain` respeta la proporción y no recorta ni rellena los bordes. */
  resize: 'contain'
  /** 1-100. Por debajo de 70 empiezan a verse los bloques. */
  quality: number
}

export abstract class MediaStoragePort {
  /** URL firmada de corta vida para leer un objeto privado. */
  abstract signedUrl(
    bucket: string,
    path: string,
    ttlSeconds: number,
    transformacion?: TransformacionDeImagen,
  ): Promise<string>

  /** Borra uno o varios objetos de un bucket (idempotente). */
  abstract remove(bucket: string, paths: string[]): Promise<void>
}

/**
 * Puerto de la cola de procesamiento. El API encola; el worker consume.
 * Aislar BullMQ tras esta interfaz permite testear el productor sin Redis.
 */
export abstract class MediaQueuePort {
  abstract enqueueTranscode(input: {
    assetId: string
    bucket: string
    path: string
    kind: 'AUDIO' | 'VIDEO' | 'IMAGE'
  }): Promise<void>
}
