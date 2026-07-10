import { Link, NavLink as RouterNavLink, Outlet, useNavigate } from 'react-router-dom'
import { Nav, Boton } from '@elcamino/ui'
import { usePerfil } from '../auth/session'
import { supabase } from '../lib/supabase'
import { PlayerBar } from '../modules/music/player-bar'

interface EnlaceDeNav {
  to: string
  label: string
}

/** Layout de la app autenticada. Común a los tres roles; el nav cambia. */
export function AppLayout({ enlaces }: { enlaces: EnlaceDeNav[] }) {
  const { data: perfil } = usePerfil()
  const navigate = useNavigate()

  const salir = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-negro pb-24">
      <Nav
        marca={
          <Link to="/" className="text-hueso no-underline">
            El Camino Angosto
          </Link>
        }
        acciones={
          <>
            <span className="hidden font-mono text-eyebrow uppercase tracking-label text-texto-tenue cine:inline">
              {perfil?.role}
            </span>
            <Boton variante="nav" onClick={() => void salir()}>
              Salir
            </Boton>
          </>
        }
      >
        {enlaces.map(({ to, label }) => (
          <RouterNavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              [
                'font-mono text-label uppercase tracking-label no-underline',
                'transition-colors duration-fade ease-camino hover:text-hueso',
                isActive ? 'text-hueso' : 'text-texto-tenue',
              ].join(' ')
            }
          >
            {label}
          </RouterNavLink>
        ))}
      </Nav>

      <main className="px-gutter pt-32">
        <Outlet />
      </main>

      {/* Persiste entre navegaciones: vive fuera del <Outlet /> (HU-2.1). */}
      <PlayerBar />
    </div>
  )
}

export const ENLACES_ESTUDIANTE: EnlaceDeNav[] = [
  { to: '/discipulado', label: 'Discipulado' },
  { to: '/tarjetas', label: 'Tarjetas' },
  { to: '/alabanza', label: 'Alabanza' },
  { to: '/chat', label: 'Mentor' },
]

export const ENLACES_MAESTRO: EnlaceDeNav[] = [
  { to: '/maestro/cursos', label: 'Mis cursos' },
  { to: '/maestro/estudiantes', label: 'Estudiantes' },
  { to: '/chat', label: 'Chat' },
]

export const ENLACES_ADMIN: EnlaceDeNav[] = [
  { to: '/admin', label: 'Panel' },
  { to: '/admin/revisiones', label: 'Revisiones' },
  { to: '/admin/moderacion', label: 'Moderación' },
  { to: '/admin/usuarios', label: 'Usuarios' },
]
