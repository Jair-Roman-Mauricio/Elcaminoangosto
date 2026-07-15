import { useCallback, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { PlayerBar } from '../modules/music/player-bar'
import { PageTransition } from '../components/page-transition'
import { Sidebar } from '../components/sidebar'
import { useVistaComo } from '../components/vista-como'
import { BrandLogo, cn } from '@elcamino/ui'
import { ThemeToggle } from '../components/theme'

const RUTAS_BASE = [
  { prefijo: '/discipulado', etiqueta: 'Discipulado' },
  { prefijo: '/tarjetas', etiqueta: 'Tarjetas de fe' },
  { prefijo: '/alabanza', etiqueta: 'Alabanza' },
  { prefijo: '/chat', etiqueta: 'Mentor' },
] as const

function etiquetaDeSegmento(segmento: string): string {
  return decodeURIComponent(segmento)
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letra) => letra.toUpperCase())
}

function construirMigas(pathname: string): Array<[string, string]> {
  const ruta = RUTAS_BASE.find(({ prefijo }) => pathname === prefijo || pathname.startsWith(`${prefijo}/`))
  if (!ruta) return []

  const segmentos = pathname.split('/').filter(Boolean)
  const segmentosBase = ruta.prefijo.split('/').filter(Boolean)
  const migas: Array<[string, string]> = [[ruta.prefijo, ruta.etiqueta]]

  for (let indice = segmentosBase.length; indice < segmentos.length; indice += 1) {
    const segmento = segmentos[indice]
    if (!segmento) continue
    const destino = `/${segmentos.slice(0, indice + 1).join('/')}`
    migas.push([destino, etiquetaDeSegmento(segmento)])
  }

  return migas
}

/**
 * Layout de la app autenticada, común a los tres roles. La navegación vive en un
 * sidebar y se deriva del **rol efectivo** (el real, o el que el admin esté
 * simulando con «Ver como»), así el profesor ve la interfaz de alumno más su
 * sección de enseñanza sin necesidad de un layout aparte.
 */
export function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { viendoComo, verComo } = useVistaComo()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const cursoDetalle = location.pathname.startsWith('/discipulado/')

  const cerrarMenu = useCallback(() => setMenuAbierto(false), [])
  const migas = construirMigas(location.pathname)

  return (
    <div className="min-h-screen bg-fondo">
      <Sidebar abierto={menuAbierto} onCerrar={cerrarMenu} oculto={cursoDetalle} />

      {/* Cabecera solo en móvil: bajo `cine` el sidebar es un cajón. */}
      <header className={cn('fixed inset-x-0 top-0 z-30 flex items-center gap-aire-s border-b border-linea bg-fondo px-aire-s py-aire-xs cine:hidden', cursoDetalle && 'hidden')}>
        <button
          type="button"
          onClick={() => setMenuAbierto(true)}
          aria-label="Abrir el menú"
          aria-expanded={menuAbierto}
          className="rounded border border-linea p-2 text-contenido transition-colors duration-fade ease-camino hover:border-vino"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" strokeWidth="1.4" />
          </svg>
        </button>
        <Link
          to="/"
          className="min-w-0 overflow-hidden no-underline"
        >
          <BrandLogo layout="horizontal" tone="adaptive" size="sm" decorative />
        </Link>
      </header>

      <div className={cn(!cursoDetalle && 'cine:pl-[15.5rem]')}>
        {/* Banner cuando el admin está simulando otro rol. */}
        {viendoComo && (
          <div className="sticky top-0 z-20 flex items-center justify-center gap-aire-s bg-vino px-gutter py-2 font-mono text-eyebrow uppercase tracking-label text-hueso">
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

        <main className="relative px-gutter pb-32 pt-[5.5rem] cine:pt-8">
          <div className="theme-toggle-anchor flex items-center gap-aire-s">
            <ThemeToggle />
          </div>
          <nav aria-label="Ruta actual" className="relative -top-1 mb-aire-xs hidden h-10 items-center gap-aire-xs md:flex">
            {migas.map(([to, label], index) => (
              <span key={`${to}-${label}`} className="flex items-center gap-aire-xs">
                {index > 0 && <span className="font-mono text-eyebrow text-texto-debil">›</span>}
                <NavLink
                  to={to}
                  className={cn(
                    'font-mono text-[0.6rem] uppercase tracking-[0.12em] no-underline transition-colors duration-fade',
                    index === migas.length - 1
                      ? 'text-contenido underline decoration-vino decoration-2 underline-offset-8'
                      : 'text-texto-tenue hover:text-contenido',
                  )}
                >
                  {label}
                </NavLink>
              </span>
            ))}
          </nav>
          {cursoDetalle ? (
            /* El panel de lecciones usa position:fixed. Framer Motion deja un
               transform en PageTransition y convertiría este wrapper en su
               viewport, recortando la columna. El barrido CSS se conserva. */
            <div key={location.pathname} className="course-interface-transition">
              <Outlet />
            </div>
          ) : (
            <PageTransition key={location.pathname} className="main-interface-transition">
              <Outlet />
            </PageTransition>
          )}
        </main>
      </div>

      {/* Persiste entre navegaciones: vive fuera del <Outlet /> (HU-2.1). */}
      <PlayerBar />
    </div>
  )
}
