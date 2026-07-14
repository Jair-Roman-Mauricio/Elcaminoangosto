import { BadRequestException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { AuthAdminPort } from '../domain/auth-admin.port'

/**
 * Adaptador de Supabase Auth (admin). Usa la `service_role` —solo en el
 * servidor— para crear cuentas ya confirmadas. Es el único punto que conoce
 * el SDK de Auth.
 */
@Injectable()
export class SupabaseAuthAdminAdapter extends AuthAdminPort {
  private readonly client: SupabaseClient

  constructor(config: ConfigService) {
    super()
    this.client = createClient(
      config.getOrThrow<string>('SUPABASE_URL'),
      config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false } },
    )
  }

  async createUser(input: {
    email: string
    password: string
    displayName: string
  }): Promise<string> {
    const { data, error } = await this.client.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true, // el admin crea la cuenta ya confirmada (ADR-005)
      user_metadata: { display_name: input.displayName },
    })

    if (error) {
      // Correo duplicado u otros errores de validación → 400 legible.
      throw new BadRequestException(
        /already/i.test(error.message)
          ? 'Ya existe una cuenta con ese correo'
          : error.message,
      )
    }
    if (!data.user) throw new BadRequestException('No se pudo crear la cuenta')
    return data.user.id
  }
}
