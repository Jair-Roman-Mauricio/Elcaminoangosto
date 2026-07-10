import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import type { Role } from '@elcamino/shared-types'
import { useSession, usePerfil } from './session'

interface RequireRoleProps {
  /** Si se omite, basta con estar autenticado. */
  roles?: Role[]
  children: ReactNode
}

/**
 * Guardia de ruta. Es una comodidad de UX, **no** una medida de seguridad:
 * la autorización real vive en los guards de NestJS y en RLS. Aquí solo se
 * evita mostrar una pantalla que el API va a rechazar con 403.
 */
export function RequireRole({ roles, children }: RequireRoleProps) {
  const { session, cargando } = useSession()
  const { data: perfil, isPending } = usePerfil()
  const location = useLocation()

  if (cargando || (session && isPending)) {
    return (
      <div className="grid min-h-screen place-items-center font-mono text-eyebrow uppercase tracking-label text-texto-tenue">
        Cargando…
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/entrar" state={{ desde: location.pathname }} replace />
  }

  // El ADMIN tiene control absoluto (contexto.md §4.3).
  if (roles && perfil && perfil.role !== 'ADMIN' && !roles.includes(perfil.role)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
