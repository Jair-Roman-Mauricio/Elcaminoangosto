import type { MediaKind } from '@elcamino/shared-types'

/**
 * Strategy (arquitectura.md §4, §6).
 *
 * El dominio NUNCA sabe qué proveedor está detrás. Hoy `SupabaseMediaProvider`
 * (Storage + ffmpeg local). Mañana `MuxMediaProvider` o `CloudflareStreamProvider`
 * sin tocar una línea de negocio: basta registrar otra implementación.
 */
export interface DerivadosDeMedio {
  /** Ruta del manifiesto HLS (`.m3u8`) dentro del bucket. `null` si no aplica. */
  hlsPath: string | null
  /** Ruta del póster/miniatura. `null` si no aplica. */
  posterPath: string | null
  durationSeconds: number | null
}

export interface EntradaDeTranscodificacion {
  assetId: string
  bucket: string
  /** Ruta del archivo original (raw) dentro del bucket. */
  path: string
  kind: MediaKind
}

export abstract class MediaProvider {
  /** Nombre del proveedor, para logs y métricas. */
  abstract readonly nombre: string

  /**
   * Genera los derivados (HLS, póster, audio normalizado) y los sube.
   * Debe ser idempotente: el mismo `assetId` procesado dos veces produce
   * el mismo resultado, porque BullMQ reintenta.
   */
  abstract transcodificar(entrada: EntradaDeTranscodificacion): Promise<DerivadosDeMedio>

  /** URL firmada de corta vida para un medio privado. */
  abstract firmarUrl(bucket: string, path: string, ttlSeconds: number): Promise<string>
}
