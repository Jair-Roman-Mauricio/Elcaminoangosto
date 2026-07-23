import type { ReactNode } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import type { Role } from '@elcamino/shared-types'
import { Boton, Eyebrow } from '@elcamino/ui/static'
import { useSession, usePerfil } from './session'
import { supabase } from '../lib/supabase'

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
  const { data: perfil, isPending, isError, refetch } = usePerfil()
  const location = useLocation()

  if (!cargando && !session) {
    return <Navigate to="/entrar" state={{ desde: location.pathname }} replace />
  }

  // El perfil no cargó (API caído, timeout, sesión inválida). Antes esto dejaba
  // la pantalla en «Cargando…» para siempre; ahora hay salida clara.
  if (session && isError) {
    return <ErrorDeSesion onReintentar={() => void refetch()} />
  }

  if (cargando || (session && isPending)) {
    return (
      <div className="grid min-h-screen place-items-center bg-fondo font-mono text-eyebrow uppercase tracking-label text-texto-tenue">
        Cargando…
      </div>
    )
  }

  // El ADMIN tiene control absoluto (contexto.md §4.3).
  if (roles && perfil && perfil.role !== 'ADMIN' && !roles.includes(perfil.role)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

function ErrorDeSesion({ onReintentar }: { onReintentar: () => void }) {
  const navigate = useNavigate()

  const cerrarSesion = async () => {
    await supabase.auth.signOut()
    navigate('/entrar', { replace: true })
  }

  return (
    <div className="grid min-h-screen place-items-center bg-fondo px-gutter">
      <div className="flex max-w-md flex-col items-center gap-aire-m text-center">
        <Eyebrow>No pudimos cargar tu sesión</Eyebrow>
        <p className="m-0 font-mono text-body text-texto-tenue">
          El servidor no respondió. Revisa tu conexión e inténtalo de nuevo, o vuelve a iniciar
          sesión.
        </p>
        <div className="flex flex-wrap justify-center gap-aire-s">
          <Boton onClick={onReintentar}>Reintentar</Boton>
          <Boton variante="sutil" onClick={() => void cerrarSesion()}>
            Cerrar sesión
          </Boton>
        </div>
      </div>
    </div>
  )
}
