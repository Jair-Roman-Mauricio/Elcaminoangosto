import { Injectable, NotFoundException } from '@nestjs/common'
import { ProfileRepository, type ProfileEntity } from '../domain/profile.repository'

/**
 * API pública del bounded context `users`.
 * Es el ÚNICO punto por el que otros módulos piden datos de perfil.
 */
@Injectable()
export class UsersService {
  constructor(private readonly profiles: ProfileRepository) {}

  async obtenerPerfil(id: string): Promise<ProfileEntity> {
    const perfil = await this.profiles.findById(id)
    if (!perfil) throw new NotFoundException('Perfil no encontrado')
    return perfil
  }

  /** `null` si la cuenta aún no tiene fila en `profiles`. Lo usa el guard. */
  async buscarPerfil(id: string): Promise<ProfileEntity | null> {
    return this.profiles.findById(id)
  }

  async actualizarPerfil(
    id: string,
    cambios: { displayName?: string; bio?: string | null; avatarUrl?: string | null },
  ): Promise<ProfileEntity> {
    return this.profiles.updateProfile(id, cambios)
  }
}
