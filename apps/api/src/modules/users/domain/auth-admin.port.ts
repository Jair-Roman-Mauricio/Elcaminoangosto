/**
 * Puerto de administración de identidades. El dominio no sabe que detrás está
 * Supabase Auth; se accede por esta interfaz (adaptador en infrastructure).
 */
export abstract class AuthAdminPort {
  /**
   * Crea una cuenta de acceso (email + contraseña), confirmada. Devuelve el
   * id del usuario (= `profiles.id`). Lanza si el correo ya existe.
   */
  abstract createUser(input: {
    email: string
    password: string
    displayName: string
  }): Promise<string>
}
