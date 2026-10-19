/**
 * Puerto de almacenamiento de medios. El dominio no sabe si detrás está
 * un bucket S3 (Railway), Mux o Cloudflare Stream (Strategy, arquitectura.md §4).
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
   * holgado, porque su papel es no estorbar: quien manda es el ancho y la
   * proporción se conserva.
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

  /** Sube un objeto leyéndolo en flujo (sin cargarlo entero en memoria). */
  abstract put(
    bucket: string,
    path: string,
    body: NodeJS.ReadableStream | Buffer,
    contentType: string,
  ): Promise<void>

  /** Lee un objeto. `null` si no existe. */
  abstract get(bucket: string, path: string): Promise<ObjetoLeido | null>

  /** URL permanente (sin firma) de un objeto de un bucket PÚBLICO. */
  abstract urlPublica(bucket: string, path: string): string

  /** Firma de una URL de imagen redimensionada; la verifica el endpoint que la sirve. */
  abstract firmarRedimension(bucket: string, path: string, expiraEn: number, w: number, q: number): string
  abstract verificarRedimension(
    bucket: string,
    path: string,
    expiraEn: number,
    w: number,
    q: number,
    firma: string,
  ): boolean
}

export interface ObjetoLeido {
  body: NodeJS.ReadableStream
  contentType: string | undefined
  contentLength: number | undefined
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
