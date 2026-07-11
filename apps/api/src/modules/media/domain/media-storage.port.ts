/**
 * Puerto de almacenamiento de medios. El dominio no sabe si detrás está
 * Supabase Storage, Mux o Cloudflare Stream (Strategy, arquitectura.md §4).
 */
export abstract class MediaStoragePort {
  /** URL firmada de corta vida para leer un objeto privado. */
  abstract signedUrl(bucket: string, path: string, ttlSeconds: number): Promise<string>
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
