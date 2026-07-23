import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '@elcamino/ui'
import { useCatalog, type CatalogItem } from './api'

/**
 * Catálogo de cursos por nivel (HU-4.1). Los cursos de nivel superior se
 * muestran bloqueados con su motivo, no se ocultan.
 */
export function CatalogoPage() {
  const { data: cursos, isPending, isError } = useCatalog()
  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState('Todos')
  const categorias = ['Todos', 'Biblia', 'Vida práctica', 'Oración', 'Discipulado']
  const categoriasNavRef = useRef<HTMLElement>(null)
  const [indicador, setIndicador] = useState({ left: 0, width: 0 })

  useLayoutEffect(() => {
    const actualizarIndicador = () => {
      const nav = categoriasNavRef.current
      const boton = nav?.querySelector<HTMLButtonElement>(`[data-categoria="${categoria}"]`)
      if (!nav || !boton) return
      setIndicador({ left: boton.offsetLeft, width: boton.offsetWidth })
    }

    actualizarIndicador()
    window.addEventListener('resize', actualizarIndicador)
    return () => window.removeEventListener('resize', actualizarIndicador)
  }, [categoria])
  const cursosFiltrados = useMemo(() => {
    if (!cursos) return []
    const termino = busqueda.trim().toLowerCase()
    return cursos.filter((curso) => {
      const coincideTexto =
        !termino ||
        [curso.title, curso.description ?? '', curso.teacherName]
          .join(' ')
          .toLowerCase()
          .includes(termino)
      // La API actual aún no expone categoría; mantenemos las categorías como
      // navegación preparada y Todos como filtro real hasta que exista el campo.
      const coincideCategoria = categoria === 'Todos' || categoria === 'Discipulado'
      return coincideTexto && coincideCategoria
    })
  }, [busqueda, categoria, cursos])

  return (
    <div className="flex w-full flex-col gap-aire-l pb-aire-m pt-0">
      <header className="flex flex-col gap-aire-m">
        <h1 className="m-0 font-mono text-h-l font-normal text-contenido">Catálogo de cursos</h1>
        <label className="relative block w-full">
          <span className="sr-only">Buscar cursos</span>
          <svg
            className="pointer-events-none absolute left-aire-s top-1/2 size-5 -translate-y-1/2 text-texto-tenue"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar un curso, tema o maestro"
            className="h-14 w-full rounded-full border border-linea-fuerte bg-superficie-1 pl-12 pr-aire-s font-ui text-body text-contenido shadow-[inset_0_0_0_1px_var(--linea)] outline-none transition-[border-color,box-shadow] placeholder:text-texto-tenue focus:border-vino focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--vino)_12%,transparent)]"
          />
        </label>
        <nav
          ref={categoriasNavRef}
          aria-label="Categorías de cursos"
          className="relative flex w-full gap-aire-s overflow-x-auto pb-1 scrollbar-none"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-1 left-0 h-0.5 bg-vino transition-[width,transform] duration-[760ms] ease-camino"
            style={{ width: indicador.width, transform: `translateX(${indicador.left}px)` }}
          />
          {categorias.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCategoria(item)}
              data-categoria={item}
              className={[
                'shrink-0 pb-1 font-ui text-body-s font-medium transition-colors',
                categoria === item ? 'text-contenido' : 'text-texto-tenue hover:text-contenido',
              ].join(' ')}
            >
              {item}
            </button>
          ))}
        </nav>
      </header>

      {isPending && <Estado>Cargando el catálogo…</Estado>}
      {isError && <Estado>No se pudo cargar el catálogo.</Estado>}

      {cursos && cursos.length === 0 && <Estado>Aún no hay cursos publicados.</Estado>}
      {cursos && cursos.length > 0 && cursosFiltrados.length === 0 && (
        <Estado>No encontramos cursos con esa búsqueda.</Estado>
      )}

      {cursosFiltrados.length > 0 && (
        <div className="grid gap-aire-m sm:grid-cols-2 md:grid-cols-3">
          {cursosFiltrados.map((curso) => (
            <CursoCard key={curso.id} curso={curso} />
          ))}
        </div>
      )}
    </div>
  )
}

function CursoCard({ curso }: { curso: CatalogItem }) {
  const navigate = useNavigate()
  const nivel = curso.requiredLevelRank ? `Nivel ${curso.requiredLevelRank}` : 'Abierto'

  const abrir = () => navigate(`/discipulado/${curso.slug}`)

  return (
    <Card
      titulo={curso.title}
      meta={`${curso.teacherName} · ${curso.lessonCount} lecciones`}
      media={<CursoMedia bloqueado={!curso.unlocked} />}
      className={`course-catalog-card !border-0 !rounded-none${curso.unlocked ? ' is-unlocked' : ' opacity-80'}`}
    >
      <div className="flex flex-wrap gap-2">
        <span className="rounded-sm bg-vino px-2 py-1 font-ui text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-hueso">
          {curso.isFree ? 'Gratis' : 'Premium'}
        </span>
        <span className="rounded-sm bg-marino/40 px-2 py-1 font-ui text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-hueso">
          {nivel}
        </span>
        {curso.enrolled && (
          <span className="rounded-sm bg-exito/15 px-2 py-1 font-ui text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-exito">
            En curso
          </span>
        )}
      </div>
      {curso.enrolled && (
        <div
          className="flex items-center gap-2"
          aria-label={`Progreso ${Math.round(curso.progressPct ?? 0)}%`}
        >
          <div className="h-1 flex-1 overflow-hidden bg-linea">
            <div
              className="h-full bg-vino transition-[width] duration-fade ease-camino"
              style={{ width: `${curso.progressPct ?? 0}%` }}
            />
          </div>
          <span className="font-mono text-eyebrow tabular-nums text-texto-tenue">
            {Math.round(curso.progressPct ?? 0)}%
          </span>
        </div>
      )}
      {curso.description && (
        <p className="m-0 line-clamp-2 font-mono text-body-s text-texto-tenue">
          {curso.description}
        </p>
      )}

      {!curso.unlocked && curso.lockedReason && (
        <p className="m-0 mt-auto border border-linea bg-superficie-2 px-aire-xs py-2 font-mono text-eyebrow uppercase tracking-label text-texto-tenue">
          {curso.lockedReason}
        </p>
      )}

      {curso.unlocked && (
        <div className="mt-auto pt-aire-xs">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              abrir()
            }}
            className="inline-flex w-full items-center justify-center rounded-none border-0 bg-vino px-aire-m py-aire-xs font-mono text-[0.6rem] uppercase tracking-[0.12em] text-hueso transition-colors duration-fade hover:bg-vino/90"
          >
            Ver detalle
          </button>
        </div>
      )}
    </Card>
  )
}

/** Placeholder de la mitad superior mientras los cursos no traen miniatura. */
function CursoMedia({ bloqueado }: { bloqueado: boolean }) {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br from-marino/40 via-superficie-2 to-negro">
      {/* Cruz bajo arco, el motivo de la marca. */}
      <svg viewBox="0 0 48 48" fill="none" aria-hidden className="h-14 w-14 text-contenido/[0.18]">
        <path
          d="M10 46V20a14 14 0 0 1 28 0v26"
          stroke="currentColor"
          strokeWidth={1.4}
          strokeLinecap="round"
        />
        <path
          d="M24 12v26M16 21h16"
          stroke="currentColor"
          strokeWidth={1.4}
          strokeLinecap="round"
        />
      </svg>
      {bloqueado && (
        <span className="absolute right-aire-s top-aire-s rounded-sm bg-vino px-2 py-1 font-ui text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-hueso">
          Bloqueado
        </span>
      )}
    </div>
  )
}

const Estado = ({ children }: { children: string }) => (
  <p className="py-aire-l text-center font-mono text-body text-texto-tenue">{children}</p>
)
