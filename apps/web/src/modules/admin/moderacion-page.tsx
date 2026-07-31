import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Eyebrow } from '@elcamino/ui'
import { BotonEnlace } from '../../components/boton-enlace'
import { useModerationQueue, type ModerationCourse } from '../discipleship/authoring-api'
import { MarcaCursoBloqueado, MarcaRecuento } from '../discipleship/marca-moderacion'

type Filtro = 'TODOS' | 'PENDIENTES' | 'BLOQUEADOS'
const FILTROS: { valor: Filtro; label: string }[] = [
  { valor: 'TODOS', label: 'Todos' },
  { valor: 'PENDIENTES', label: 'Con pendientes' },
  { valor: 'BLOQUEADOS', label: 'Bloqueados' },
]

/**
 * Moderación (HU-7.2, ADMIN): monitoreo de cursos ya publicados. Verifica el
 * contenido nuevo o cambiado antes de que lo vean los estudiantes.
 */
export function ModeracionPage() {
  const { data: cola, isPending } = useModerationQueue()
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('TODOS')

  const cursos = useMemo(() => cola ?? [], [cola])
  const q = busqueda.trim().toLowerCase()
  const visibles = cursos.filter((c) => {
    if (!c.title.toLowerCase().includes(q)) return false
    if (filtro === 'PENDIENTES') return c.pendientes > 0
    if (filtro === 'BLOQUEADOS') return c.blocked || c.bloqueados > 0
    return true
  })
  const cuenta = (f: Filtro) =>
    f === 'TODOS'
      ? cursos.length
      : f === 'PENDIENTES'
        ? cursos.filter((c) => c.pendientes > 0).length
        : cursos.filter((c) => c.blocked || c.bloqueados > 0).length

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

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-aire-m py-aire-m">
      <header className="flex flex-col gap-aire-xs">
        <Eyebrow>Administración</Eyebrow>
        <h1 className="m-0 font-mono text-h-l font-normal text-contenido">Moderación</h1>
        <p className="m-0 font-mono text-body-s text-texto-tenue">
          Verifica los contenidos nuevos o cambiados de los cursos ya publicados.
        </p>
      </header>

      <label className="relative block w-full">
        <span className="sr-only">Buscar curso</span>
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
          placeholder="Buscar un curso publicado"
          className="h-14 w-full rounded-full border border-linea-fuerte bg-superficie-1 pl-12 pr-aire-s font-ui text-body text-contenido shadow-[inset_0_0_0_1px_var(--linea)] outline-none transition-[border-color,box-shadow] placeholder:text-texto-tenue focus:border-vino focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--vino)_12%,transparent)]"
        />
      </label>

      <nav ref={filtrosRef} aria-label="Filtrar" className="relative flex gap-aire-m">
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
      {!isPending && visibles.length === 0 && (
        <p className="font-ui text-body-s text-texto-tenue">No hay cursos que coincidan.</p>
      )}

      {visibles.length > 0 && (
        <ul className="m-0 grid list-none grid-cols-1 gap-aire-m p-0 sm:grid-cols-2 lg:grid-cols-3">
          {visibles.map((c) => (
            <li key={c.id}>
              <TarjetaCurso curso={c} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function TarjetaCurso({ curso }: { curso: ModerationCourse }) {
  return (
    <article className="flex h-full flex-col gap-aire-s bg-superficie-1 p-aire-m shadow-[0_0.9rem_2.2rem_-0.5rem_rgba(20,17,15,0.22)]">
      <div className="flex flex-wrap items-center justify-end gap-aire-xs">
        {curso.blocked && <MarcaCursoBloqueado />}
        <MarcaRecuento estado="PENDING" cantidad={curso.pendientes} />
        <MarcaRecuento estado="BLOCKED" cantidad={curso.bloqueados} />
      </div>

      <h2 className="m-0 font-mono text-h-s font-normal text-contenido">{curso.title}</h2>
      <p className="m-0 font-ui text-body-s text-texto-tenue">
        {curso.pendientes > 0 || curso.bloqueados > 0
          ? 'Tiene contenido por verificar.'
          : 'Sin cambios pendientes.'}
      </p>

      <BotonEnlace variante="tarjeta" to={`/admin/moderacion/${curso.id}`} className="mt-auto">
        Monitorear
      </BotonEnlace>
    </article>
  )
}
