import type { SupabaseClient } from '@supabase/supabase-js'
import {
  MediaProvider,
  type DerivadosDeMedio,
  type EntradaDeTranscodificacion,
} from './media-provider'

/**
 * Adaptador sobre Supabase Storage + ffmpeg local.
 *
 * Hecho clave (arquitectura.md §6): Supabase Storage **no transcodifica**.
 * Sirve los archivos tal cual. Por eso la transcodificación a HLS ocurre aquí,
 * en el worker, y los derivados se vuelven a subir al bucket.
 */
export class SupabaseMediaProvider extends MediaProvider {
  readonly nombre = 'supabase'

  constructor(private readonly supabase: SupabaseClient) {
    super()
  }

  async transcodificar(entrada: EntradaDeTranscodificacion): Promise<DerivadosDeMedio> {
    // TODO(S3 · HU-8.2): implementar el pipeline real con ffmpeg.
    //   1. Descargar `path` del bucket a un temporal.
    //   2. VIDEO → variantes HLS (`ffmpeg -f hls`) + póster (`-ss 1 -vframes 1`).
    //      AUDIO → normalizar a loudness EBU R128 (`loudnorm`).
    //      IMAGE → solo miniatura (image transforms de Supabase).
    //   3. Subir derivados a `<path sin extensión>/hls/` y `/poster.jpg`.
    //   4. Devolver rutas y duración (`ffprobe`).
    // Debe ser idempotente: BullMQ reintenta.
    throw new Error(
      `Transcodificación no implementada todavía (asset ${entrada.assetId}, tipo ${entrada.kind}). Historia HU-8.2, sprint S3.`,
    )
  }

  async firmarUrl(bucket: string, path: string, ttlSeconds: number): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(bucket)
      .createSignedUrl(path, ttlSeconds)

    if (error || !data) {
      throw new Error(`No se pudo firmar ${bucket}/${path}: ${error?.message ?? 'sin datos'}`)
    }
    return data.signedUrl
  }
}
