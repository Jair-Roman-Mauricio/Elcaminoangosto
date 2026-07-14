import { Link, NavLink as RouterNavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import type { Role } from '@elcamino/shared-types'
import { Nav, Boton } from '@elcamino/ui'
import { supabase } from '../lib/supabase'
import { PlayerBar } from '../modules/music/player-bar'
import { PageTransition } from '../components/page-transition'
import { ThemeToggle } from '../components/theme'
import { useVistaComo } from '../components/vista-como'

interface EnlaceDeNav {
  to: string
  label: string
}

const ENLACES_ESTUDIANTE: EnlaceDeNav[] = [
  { to: '/discipulado', label: 'Discipulado' },
  { to: '/tarjetas', label: 'Tarjetas' },
  { to: '/alabanza', label: 'Alabanza' },
  { to: '/chat', label: 'Mentor' },
]

// El profesor ve la misma interfaz que el alumno, más «Mis cursos» para crear
// y gestionar sus borradores.
const ENLACES_MAESTRO: EnlaceDeNav[] = [
  { to: '/discipulado', label: 'Discipulado' },
  { to: '/tarjetas', label: 'Tarjetas' },
  { to: '/alabanza', label: 'Alabanza' },
  { to: '/maestro/cursos', label: 'Mis cursos' },
  { to: '/maestro/estudiantes', label: 'Estudiantes' },
]

const ENLACES_ADMIN: EnlaceDeNav[] = [
  { to: '/admin', label: 'Panel' },
  { to: '/admin/revisiones', label: 'Revisiones' },
  { to: '/admin/usuarios', label: 'Usuarios' },
  { to: '/admin/moderacion', label: 'Moderación' },
]

function enlacesPara(role: Role | undefined): EnlaceDeNav[] {
  if (role === 'ADMIN') return ENLACES_ADMIN
  if (role === 'MAESTRO') return ENLACES_MAESTRO
  return ENLACES_ESTUDIANTE
}

/**
 * Layout de la app autenticada, común a los tres roles. La nav se deriva del
 * **rol efectivo** (el real, o el que el admin esté simulando con «Ver como»),
 * así el profesor ve la interfaz de alumno + «Mis cursos» sin layouts aparte.
 */
export function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { rolReal, rolEfectivo, viendoComo, verComo } = useVistaComo()

  const enlaces = enlacesPara(rolEfectivo)

  const salir = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-fondo pb-24">
      <Nav
        marca={
          <Link to="/" className="text-contenido no-underline">
            El Camino Angosto
          </Link>
        }
        acciones={
          <>
            {rolReal === 'ADMIN' && <VerComo activo={viendoComo} onVer={verComo} />}
            <ThemeToggle />
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
            end={to === '/admin'}
            className={({ isActive }) =>
              [
                'font-mono text-label uppercase tracking-label no-underline',
                'transition-colors duration-fade ease-camino hover:text-contenido',
                isActive ? 'text-contenido' : 'text-texto-tenue',
              ].join(' ')
            }
          >
            {label}
          </RouterNavLink>
        ))}
      </Nav>

      {/* Banner cuando el admin está simulando otro rol. */}
      {viendoComo && (
        <div className="fixed inset-x-0 top-[5.75rem] z-40 flex items-center justify-center gap-aire-s bg-vino px-gutter py-2 font-mono text-eyebrow uppercase tracking-label text-hueso">
          Viendo como {viendoComo === 'MAESTRO' ? 'profesor' : 'estudiante'}
          <button
            type="button"
            onClick={() => {
              verComo(null)
              navigate('/admin')
            }}
            className="underline decoration-hueso/60 underline-offset-4 hover:decoration-hueso"
          >
            Volver a admin
          </button>
        </div>
      )}

      <main className={`px-gutter ${viendoComo ? 'pt-40' : 'pt-32'}`}>
        <PageTransition key={location.pathname}>
          <Outlet />
        </PageTransition>
      </main>

      {/* Persiste entre navegaciones: vive fuera del <Outlet /> (HU-2.1). */}
      <PlayerBar />
    </div>
  )
}

/** Control «Ver como» del admin (estudiante / profesor). */
function VerComo({ activo, onVer }: { activo: Role | null; onVer: (r: Role | null) => void }) {
  const navigate = useNavigate()
  const ver = (role: Role, destino: string) => {
    onVer(role)
    navigate(destino)
  }
  return (
    <div className="hidden items-center gap-1 cine:flex">
      <span className="font-mono text-eyebrow uppercase tracking-label text-texto-debil">
        Ver como
      </span>
      <BotonMini activo={activo === 'ESTUDIANTE'} onClick={() => ver('ESTUDIANTE', '/discipulado')}>
        Alumno
      </BotonMini>
      <BotonMini activo={activo === 'MAESTRO'} onClick={() => ver('MAESTRO', '/maestro/cursos')}>
        Profesor
      </BotonMini>
    </div>
  )
}

function BotonMini({
  activo,
  onClick,
  children,
}: {
  activo: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded border px-aire-xs py-1 font-mono text-eyebrow uppercase tracking-label',
        'transition-colors duration-fade ease-camino',
        activo
          ? 'border-vino bg-vino/10 text-contenido'
          : 'border-linea text-texto-tenue hover:border-vino hover:text-contenido',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
