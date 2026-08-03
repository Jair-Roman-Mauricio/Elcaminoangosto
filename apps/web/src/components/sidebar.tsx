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
  { to: '/tarjetas', label: 'Tarjetas' },
  { to: '/videos', label: 'Videos cristianos' },
  { to: '/alabanza', label: 'Alabanza' },
]

/**
 * Grupos del sidebar. Todo el mundo ve lo mismo —la plataforma es abierta— y
 * solo el admin suma su bloque de administración.
 */
export function gruposPara(role: Role | undefined): GrupoDeNav[] {
  const grupos: GrupoDeNav[] = [{ titulo: 'Plataforma', enlaces: PLATAFORMA }]

  if (role === 'ADMIN') {
    grupos.push({
      titulo: 'Administración',
      enlaces: [
        { to: '/admin/contenido', label: 'Contenido' },
        { to: '/admin/estadisticas', label: 'Estadísticas' },
      ],
    })
  }

  return grupos
}

export interface SidebarProps {
  /** Solo gobierna el cajón móvil; en escritorio el sidebar es fijo. */
  abierto: boolean
  onCerrar: () => void
  /** Oculta la navegación global en la experiencia inmersiva de una lección. */
  oculto?: boolean
  /** Visitante sin sesión: mismo sidebar de estudiante, sin funciones privadas. */
  invitado?: boolean
}

/**
 * Navegación lateral de la app autenticada. Fija en escritorio; cajón deslizante
 * bajo `cine` (820px), donde no cabe una columna sin comerse el contenido.
 */
export function Sidebar({ abierto, onCerrar, oculto = false, invitado = false }: SidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { rolEfectivo } = useVistaComo()
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
                      'sidebar-nav-link relative flex h-[2.35rem] min-w-0 items-center justify-start rounded-none border border-transparent px-aire-m text-left no-underline',
                      'font-mono text-[0.6rem] uppercase tracking-[0.12em]',
                      label === 'Chat con administradores' && 'text-[0.54rem] tracking-[0.08em] whitespace-nowrap',
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

        {invitado ? (
          <div className="px-aire-m py-aire-m">
            {/* Nadie más necesita entrar: no hay cuentas que crear. Se ofrece
                discreto, como puerta de servicio y no como llamada a la acción. */}
            <Link
              to="/entrar"
              className="sidebar-nav-link flex h-[2.35rem] items-center justify-center border border-linea font-mono text-[0.6rem] uppercase tracking-[0.12em] text-texto-tenue no-underline transition-colors duration-fade hover:border-vino hover:text-vino"
            >
              Ingresar como admin
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-aire-s px-0 py-aire-m">
            <div className="flex items-center px-aire-m">
              <div className="flex min-w-0 flex-1 items-center gap-aire-xs font-mono text-[0.6rem] uppercase tracking-[0.12em] text-texto-tenue">
                {perfil?.avatarUrl ? (
                  <img src={perfil.avatarUrl} alt="" className="size-7 rounded-full object-cover" />
                ) : (
                  <span className="grid size-7 place-items-center rounded-full bg-vino font-ui text-[0.6rem] font-semibold text-hueso">
                    {(perfil?.displayName ?? 'A').slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="truncate">{perfil?.displayName ?? 'Administración'}</span>
              </div>
            </div>

            <Boton
              variante="nav"
              onClick={() => void salir()}
              className="w-full rounded-none border-vino bg-vino px-aire-m py-aire-xs font-mono text-[0.6rem] tracking-[0.12em] text-hueso hover:border-vino hover:bg-vino hover:text-hueso"
            >
              Cerrar sesión
            </Boton>
          </div>
        )}
      </aside>
    </>
  )
}
