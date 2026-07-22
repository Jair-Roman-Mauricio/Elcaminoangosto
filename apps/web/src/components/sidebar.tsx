import { useEffect } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import type { Role } from '@elcamino/shared-types'
import { BrandLogo, Boton, cn } from '@elcamino/ui/static'
import { supabase } from '../lib/supabase'
import { useVistaComo } from './vista-como'
import { usePerfil } from '../auth/session'
import { navegarConTransicion } from './view-transition'

export interface EnlaceDeNav {
  to: string
  label: string
  /** Solo activo en coincidencia exacta (rutas índice como /admin). */
  exacto?: boolean
}

export interface GrupoDeNav {
  titulo: string
  enlaces: EnlaceDeNav[]
}

const PLATAFORMA: EnlaceDeNav[] = [
  { to: '/discipulado', label: 'Discipulado' },
  { to: '/tarjetas', label: 'Tarjetas' },
  { to: '/videos', label: 'Videos cristianos' },
  { to: '/alabanza', label: 'Alabanza' },
  { to: '/chat', label: 'Mentor' },
]

/** Grupos del sidebar según el rol efectivo. */
export function gruposPara(role: Role | undefined): GrupoDeNav[] {
  if (role === 'ADMIN') {
    return [
      {
        titulo: 'Administración',
        enlaces: [
          { to: '/admin', label: 'Panel', exacto: true },
          { to: '/admin/revisiones', label: 'Revisiones' },
          { to: '/admin/usuarios', label: 'Usuarios' },
          { to: '/admin/moderacion', label: 'Moderación' },
        ],
      },
    ]
  }

  if (role === 'MAESTRO') {
    return [
      {
        titulo: 'Profesor',
        enlaces: [
          { to: '/maestro/cursos', label: 'Principal' },
          { to: '/maestro/chat', label: 'Chat con estudiantes' },
          { to: '/maestro/estudiantes', label: 'Mis estudiantes' },
        ],
      },
    ]
  }

  return [{ titulo: 'Plataforma', enlaces: PLATAFORMA }]
}

export interface SidebarProps {
  /** Solo gobierna el cajón móvil; en escritorio el sidebar es fijo. */
  abierto: boolean
  onCerrar: () => void
  /** Oculta la navegación global en la experiencia inmersiva de una lección. */
  oculto?: boolean
}

/**
 * Navegación lateral de la app autenticada. Fija en escritorio; cajón deslizante
 * bajo `cine` (820px), donde no cabe una columna sin comerse el contenido.
 */
export function Sidebar({ abierto, onCerrar, oculto = false }: SidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { rolReal, rolEfectivo, viendoComo, verComo } = useVistaComo()
  const { data: perfil } = usePerfil()

  // Navegar cierra el cajón: en móvil taparía la página recién abierta.
  useEffect(() => {
    onCerrar()
  }, [location.pathname, onCerrar])

  if (oculto) return null

  const salir = async () => {
    await supabase.auth.signOut()
    navegarConTransicion(() => navigate('/entrar'))
  }

  return (
    <>
      {/* Velo del cajón móvil. */}
      {abierto && (
        <button
          type="button"
          aria-label="Cerrar el menú"
          onClick={onCerrar}
          className="fixed inset-0 z-40 bg-negro/50 cine:hidden"
        />
      )}

      <aside
        aria-label="Navegación principal"
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[15.5rem] flex-col',
          'border-r border-linea bg-superficie-1',
          'transition-transform duration-fade ease-camino',
          abierto ? 'translate-x-0' : '-translate-x-full',
          'cine:translate-x-0',
        )}
      >
        <div className="px-aire-s py-aire-m">
          <Link
            to="/"
            aria-label="Ir al inicio"
            className="block w-full no-underline"
          >
          <BrandLogo layout="horizontal" tone="adaptive" size="sm" variante="sidebar" decorative />
          </Link>
        </div>

        <nav className="flex flex-1 flex-col gap-aire-s overflow-y-auto px-0 py-aire-m scrollbar-none">
          {gruposPara(rolEfectivo).map((grupo) => (
            <div key={grupo.titulo} className="relative flex flex-col gap-aire-xs">
              {(() => {
                const indiceActivo = grupo.enlaces.findIndex(({ to, exacto }) =>
                  exacto ? location.pathname === to : location.pathname.startsWith(to),
                )
                return indiceActivo >= 0 ? (
                  <span
                    aria-hidden="true"
                    className="sidebar-selector"
                    style={{ transform: `translateY(calc(${indiceActivo} * 3.1rem))` }}
                  />
                ) : null
              })()}
              {grupo.enlaces.map(({ to, label, exacto }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={exacto ?? false}
                  className={({ isActive }) =>
                    cn(
                      'sidebar-nav-link relative flex h-[2.35rem] items-center justify-start rounded-none border border-transparent px-aire-m text-left no-underline',
                      'font-mono text-[0.6rem] uppercase tracking-[0.12em]',
                      'transition-colors duration-fade ease-camino',
                      // Barra de vino a la izquierda: marca la ruta activa sin
                      // depender solo del color del texto.
                      'before:absolute before:inset-y-2 before:left-0 before:w-[2px] before:rounded-full',
                      isActive
                        ? 'border-transparent text-hueso before:bg-transparent'
                        : 'border-transparent text-texto-tenue before:bg-transparent hover:text-contenido',
                    )
                  }
                >
                  {label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="flex flex-col gap-aire-s px-0 py-aire-m">
          {rolReal === 'ADMIN' && <VerComo activo={viendoComo} onVer={verComo} />}

          <div className="flex items-center px-aire-m">
            <div className="flex min-w-0 flex-1 items-center gap-aire-xs font-mono text-[0.6rem] uppercase tracking-[0.12em] text-texto-tenue">
              {perfil?.avatarUrl ? (
                <img src={perfil.avatarUrl} alt="" className="size-7 rounded-full object-cover" />
              ) : (
                <span className="grid size-7 place-items-center rounded-full bg-vino font-ui text-[0.6rem] font-semibold text-hueso">
                  {(perfil?.displayName ?? 'P').slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="truncate">{perfil?.displayName ?? 'Perfil'}</span>
            </div>
            <Link
              to="/perfil"
              aria-label="Editar perfil"
              title="Editar perfil"
              className="grid size-7 shrink-0 place-items-center rounded border border-linea text-texto-tenue transition-colors duration-fade ease-camino hover:border-vino hover:text-vino"
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" aria-hidden="true">
                <path d="m4 16.5-.8 4.3 4.3-.8L19.8 7.7a2.1 2.1 0 0 0-3-3L4 16.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="m14.8 6.2 3 3" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </Link>
          </div>

          <Boton
            variante="nav"
            onClick={() => void salir()}
            className="w-full rounded-none border-vino bg-vino px-aire-m py-aire-xs font-mono text-[0.6rem] tracking-[0.12em] text-hueso hover:border-vino hover:bg-vino hover:text-hueso"
          >
            Cerrar sesión
          </Boton>
        </div>
      </aside>
    </>
  )
}

/** Control «Ver como» del admin: simula la interfaz de alumno o de profesor. */
function VerComo({ activo, onVer }: { activo: Role | null; onVer: (r: Role | null) => void }) {
  const navigate = useNavigate()
  const ver = (role: Role, destino: string) => {
    onVer(role)
    navigate(destino)
  }

  return (
    <div className="flex flex-col gap-aire-xs">
      <span className="px-aire-xs font-mono text-eyebrow uppercase tracking-label text-texto-debil">
        Ver como
      </span>
      {/* En columna: en una fila, «Profesor» no cabe en el ancho del sidebar. */}
      <div className="flex flex-col gap-aire-xs">
        <BotonMini
          activo={activo === 'ESTUDIANTE'}
          onClick={() => ver('ESTUDIANTE', '/discipulado')}
        >
          Alumno
        </BotonMini>
        <BotonMini activo={activo === 'MAESTRO'} onClick={() => ver('MAESTRO', '/maestro/cursos')}>
          Profesor
        </BotonMini>
      </div>
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
      aria-pressed={activo}
      className={cn(
        'rounded border px-aire-xs py-2 text-left font-mono text-eyebrow uppercase tracking-label',
        'transition-colors duration-fade ease-camino',
        activo
          ? 'border-vino bg-vino/10 text-contenido'
          : 'border-linea text-texto-tenue hover:border-vino hover:text-contenido',
      )}
    >
      {children}
    </button>
  )
}
