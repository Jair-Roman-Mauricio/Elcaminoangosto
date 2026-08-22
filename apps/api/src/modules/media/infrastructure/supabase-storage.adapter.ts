import { Injectable, InternalServerErrorException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { MediaStoragePort, type TransformacionDeImagen } from '../domain/media-storage.port'

/**
 * Adaptador de Supabase Storage. Usa la `service_role` (solo en el servidor)
 * para firmar URLs de objetos privados. Es el único punto que conoce el SDK.
 */
@Injectable()
export class SupabaseStorageAdapter extends MediaStoragePort {
  private readonly client: SupabaseClient

  constructor(config: ConfigService) {
    super()
    this.client = createClient(
      config.getOrThrow<string>('SUPABASE_URL'),
      config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false } },
    )
  }

  async signedUrl(
    bucket: string,
    path: string,
    ttlSeconds: number,
    transformacion?: TransformacionDeImagen,
  ): Promise<string> {
    // Con `transform`, Supabase firma contra su redimensionador: devuelve la
    // imagen al ancho pedido y en WebP si el navegador lo acepta.
    const { data, error } = await this.client.storage
      .from(bucket)
      .createSignedUrl(path, ttlSeconds, transformacion ? { transform: transformacion } : {})
    if (error || !data) {
      throw new InternalServerErrorException(
        `No se pudo firmar ${bucket}/${path}: ${error?.message ?? 'sin datos'}`,
      )
    }
    return data.signedUrl
  }

  async remove(bucket: string, paths: string[]): Promise<void> {
    if (paths.length === 0) return
    const { error } = await this.client.storage.from(bucket).remove(paths)
    if (error) {
      throw new InternalServerErrorException(
        `No se pudo borrar de ${bucket}: ${error.message}`,
      )
    }
  }
}
