import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Chip, Eyebrow } from '@elcamino/ui'
import { useReviewQueue, type AuthoringCourse } from '../discipleship/authoring-api'
import { EstadoBadge } from '../discipleship/estado-curso'
import { BotonEnlace } from '../../components/boton-enlace'

type Filtro = 'TODOS' | 'SUBMITTED' | 'UNDER_REVIEW'
const FILTROS: { valor: Filtro; label: string }[] = [
  { valor: 'TODOS', label: 'Todos' },
  { valor: 'SUBMITTED', label: 'Por tomar' },
  { valor: 'UNDER_REVIEW', label: 'En revisión' },
]

/** Cola de revisión de cursos (HU-5.2, ADMIN): buscador, filtros y grid de cards. */
export function RevisionesPage() {
  const { data: cola, isPending } = useReviewQueue()
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('TODOS')

  // Subrayado deslizante sobre el filtro activo, como en el catálogo.
  const filtrosRef = useRef<HTMLElement>(null)
  const [indicador, setIndicador] = useState({ left: 0, width: 0 })
  useLayoutEffect(() => {
    const mover = () => {
      const nav = filtrosRef.current
      const boton = nav?.querySelector<HTMLButtonElement>(`[data-filtro="${filtro}"]`)
      if (!nav || !boton) return
      setIndicador({ left: boton.offsetLeft, width: boton.offsetWidth })
    }
    mover()
    window.addEventListener('resize', mover)
    return () => window.removeEventListener('resize', mover)
  }, [filtro, cola])

  const cursos = useMemo(() => cola ?? [], [cola])
  const q = busqueda.trim().toLowerCase()
  const visibles = cursos.filter(
    (c) =>
      (filtro === 'TODOS' || c.status === filtro) &&
      (c.title.toLowerCase().includes(q) || (c.description ?? '').toLowerCase().includes(q)),
  )
  const cuenta = (f: Filtro) => (f === 'TODOS' ? cursos.length : cursos.filter((c) => c.status === f).length)

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-aire-m py-aire-m">
      <header className="flex flex-col gap-aire-xs">
        <Eyebrow>Administración</Eyebrow>
        <h1 className="m-0 font-mono text-h-l font-normal text-contenido">Cursos por revisar</h1>
        {cursos.length > 0 && (
          <p className="m-0 font-mono text-body-s text-texto-tenue">
            {cursos.length} borrador(es) en la cola.
          </p>
        )}
      </header>

      {/* Buscador con lupa (formato del catálogo) */}
      <label className="relative block w-full">
        <span className="sr-only">Buscar borrador</span>
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
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar un borrador por nombre o descripción"
          className="h-14 w-full rounded-full border border-linea-fuerte bg-superficie-1 pl-12 pr-aire-s font-ui text-body text-contenido shadow-[inset_0_0_0_1px_var(--linea)] outline-none transition-[border-color,box-shadow] placeholder:text-texto-tenue focus:border-vino focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--vino)_12%,transparent)]"
        />
      </label>

      {/* Filtros por estado: tabs con subrayado deslizante */}
      <nav ref={filtrosRef} aria-label="Filtrar por estado" className="relative flex gap-aire-m">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-0 h-0.5 bg-vino transition-[width,transform] duration-[600ms] ease-camino"
          style={{ width: indicador.width, transform: `translateX(${indicador.left}px)` }}
        />
        {FILTROS.map((f) => (
          <button
            key={f.valor}
            type="button"
            data-filtro={f.valor}
            onClick={() => setFiltro(f.valor)}
            aria-pressed={filtro === f.valor}
            className={[
              'shrink-0 pb-2 font-ui text-body-s font-medium transition-colors',
              filtro === f.valor ? 'text-contenido' : 'text-texto-tenue hover:text-contenido',
            ].join(' ')}
          >
            {f.label} · {cuenta(f.valor)}
          </button>
        ))}
      </nav>

      {isPending && <p className="font-mono text-body text-texto-tenue">Cargando…</p>}
      {!isPending && cursos.length === 0 && (
        <p className="font-mono text-body text-texto-tenue">No hay cursos esperando revisión.</p>
      )}
      {!isPending && cursos.length > 0 && visibles.length === 0 && (
        <p className="font-ui text-body-s text-texto-tenue">Ningún borrador coincide con el filtro.</p>
      )}

      {/* Grid responsive de borradores */}
      {visibles.length > 0 && (
        <ul className="m-0 grid list-none grid-cols-1 gap-aire-m p-0 sm:grid-cols-2 lg:grid-cols-3">
          {visibles.map((c) => (
            <li key={c.id}>
              <TarjetaBorrador curso={c} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function TarjetaBorrador({ curso }: { curso: AuthoringCourse }) {
  const nivel = curso.requiredLevelRank ? `Nivel ${curso.requiredLevelRank}` : 'Abierto'
  return (
    <article className="flex h-full flex-col gap-aire-s bg-superficie-1 p-aire-m shadow-[0_0.9rem_2.2rem_-0.5rem_rgba(20,17,15,0.22)]">
      {/* Etiquetas de estado, arriba a la derecha */}
      <div className="flex flex-wrap items-center justify-end gap-aire-xs">
        <EstadoBadge status={curso.status} />
        <Chip>{nivel}</Chip>
      </div>

      <h2 className="m-0 font-mono text-h-s font-normal text-contenido">{curso.title}</h2>
      {curso.description && (
        <p className="m-0 line-clamp-3 font-ui text-body-s text-texto-tenue">{curso.description}</p>
      )}

      {/* Botón para abrir el canvas de revisión */}
      <BotonEnlace variante="tarjeta" to={`/admin/revisiones/${curso.id}`} className="mt-auto">
        Abrir revisión →
      </BotonEnlace>
    </article>
  )
}
