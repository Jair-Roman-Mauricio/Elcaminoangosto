import { useMemo, useState, type CSSProperties } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Boton, Eyebrow } from '@elcamino/ui'
import { apiClient } from '../../lib/api-client'

interface Estudiante {
  studentId: string
  displayName: string
  avatarUrl: string | null
  levelName: string | null
  levelRank: number
  lastActivityAt: string | null
  haConsultado: boolean
  courses: { id: string; title: string }[]
}

const LIBRES = '__libres__'
const TODOS = '__todos__'

const PALETA = ['#b41e44', '#1b3460', '#2e7d5b', '#c9862b', '#6d4c9f', '#0f766e']
function iniciales(nombre: string): string {
  const p = nombre.trim().split(/\s+/)
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || '·'
}
function colorDe(id: string): string {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return PALETA[h % PALETA.length]!
}
function tiempoRelativo(iso: string | null): string {
  if (!iso) return ''
  const seg = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (seg < 60) return 'hace un momento'
  const min = Math.round(seg / 60)
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.round(h / 24)
  if (d < 7) return `hace ${d} d`
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short' })
}

/** Mis estudiantes (HU-1.3, MAESTRO): consultas por chat + inscritos, por curso. */
export function EstudiantesPage() {
  const { data, isPending } = useQuery({
    queryKey: ['my-students'],
    queryFn: () => apiClient.get<Estudiante[]>('/users/my-students'),
  })

  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<string>(TODOS)

  const estudiantes = useMemo(() => data ?? [], [data])
  const q = busqueda.trim().toLowerCase()
  const visibles = estudiantes.filter((e) => e.displayName.toLowerCase().includes(q))

  // Cursos con al menos un estudiante ligado.
  const cursos = useMemo(() => {
    const mapa = new Map<string, string>()
    estudiantes.forEach((e) => e.courses.forEach((c) => mapa.set(c.id, c.title)))
    return [...mapa].map(([id, title]) => ({ id, title })).sort((a, b) => a.title.localeCompare(b.title))
  }, [estudiantes])
  const hayLibres = estudiantes.some((e) => e.courses.length === 0)

  // Secciones a mostrar según el filtro activo.
  const secciones = useMemo(() => {
    const deCurso = (id: string) => visibles.filter((e) => e.courses.some((c) => c.id === id))
    const libres = visibles.filter((e) => e.courses.length === 0)
    if (filtro === LIBRES) return [{ id: LIBRES, titulo: 'Consultas libres', gente: libres }]
    if (filtro !== TODOS) {
      const curso = cursos.find((c) => c.id === filtro)
      return curso ? [{ id: curso.id, titulo: curso.title, gente: deCurso(curso.id) }] : []
    }
    const grupos = cursos.map((c) => ({ id: c.id, titulo: c.title, gente: deCurso(c.id) }))
    if (hayLibres) grupos.push({ id: LIBRES, titulo: 'Consultas libres', gente: libres })
    return grupos
  }, [filtro, visibles, cursos, hayLibres])

  const totalVisibles = visibles.length

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-aire-m py-aire-m">
      <header className="flex flex-col gap-aire-xs">
        <Eyebrow>Mentoría</Eyebrow>
        <h1 className="m-0 font-mono text-h-l font-normal text-contenido">Mis estudiantes</h1>
        {estudiantes.length > 0 && (
          <p className="m-0 font-mono text-body-s text-texto-tenue">
            {estudiantes.length} {estudiantes.length === 1 ? 'persona' : 'personas'} en total
          </p>
        )}
      </header>

      {isPending && <p className="font-mono text-body text-texto-tenue">Cargando…</p>}

      {data && estudiantes.length === 0 && (
        <div className="rounded-xl border border-linea bg-superficie-1 px-aire-m py-aire-l text-center">
          <p className="m-0 font-mono text-body text-texto-tenue">Aún nadie te ha consultado.</p>
          <p className="mx-auto mt-aire-xs max-w-md font-ui text-body-s text-texto-tenue">
            Cuando un estudiante te escriba por el chat o se inscriba en uno de tus cursos,
            aparecerá aquí para que le des seguimiento.
          </p>
        </div>
      )}

      {data && estudiantes.length > 0 && (
        <>
          {/* Buscador + selector de curso */}
          <div className="flex flex-col gap-aire-s sm:flex-row sm:items-center">
            <label className="relative block flex-1">
              <span className="sr-only">Buscar estudiante</span>
              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar estudiante…"
                className="w-full rounded-full border border-linea bg-superficie-2 px-[1.4rem] py-[0.85rem] font-ui text-body-s text-contenido outline-none placeholder:text-texto-tenue focus:border-vino"
              />
            </label>

            <label className="relative shrink-0">
              <span className="sr-only">Filtrar por curso</span>
              <select
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                className="w-full cursor-pointer appearance-none rounded-full border border-linea bg-superficie-2 py-[0.85rem] pl-[1.4rem] pr-[2.6rem] font-mono text-eyebrow uppercase tracking-label text-contenido outline-none focus:border-vino sm:w-[16rem]"
              >
                <option value={TODOS}>Todos los cursos</option>
                {cursos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
                {hayLibres && <option value={LIBRES}>Consultas libres</option>}
              </select>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute right-[1.2rem] top-1/2 -translate-y-1/2 text-texto-tenue"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none">
                  <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </label>
          </div>

          {totalVisibles === 0 && (
            <p className="font-ui text-body-s text-texto-tenue">
              Nadie coincide con «{busqueda}».
            </p>
          )}

          {secciones.map((s) =>
            s.gente.length === 0 ? null : (
              <section key={s.id} className="flex flex-col gap-aire-s">
                <div className="flex items-baseline gap-aire-xs border-b border-linea pb-aire-xs">
                  <h2 className="m-0 font-mono text-body font-normal text-contenido">{s.titulo}</h2>
                  <span className="font-mono text-eyebrow uppercase tracking-label text-texto-tenue">
                    {s.gente.length}
                  </span>
                </div>
                <ul className="m-0 grid list-none grid-cols-1 gap-aire-s p-0 sm:grid-cols-2 lg:grid-cols-3">
                  {s.gente.map((e) => (
                    <TarjetaEstudiante key={e.studentId} estudiante={e} />
                  ))}
                </ul>
              </section>
            ),
          )}
        </>
      )}
    </div>
  )
}

function TarjetaEstudiante({ estudiante: e }: { estudiante: Estudiante }) {
  const navigate = useNavigate()
  return (
    <li className="flex flex-col gap-aire-s rounded-xl border border-linea bg-superficie-1 p-aire-s">
      <div className="flex items-center gap-aire-s">
        <span
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full font-mono text-body-s font-medium text-hueso"
          style={{ backgroundColor: colorDe(e.studentId) } as CSSProperties}
          aria-hidden="true"
        >
          {iniciales(e.displayName)}
        </span>
        <div className="min-w-0">
          <p className="m-0 truncate font-mono text-body text-contenido">{e.displayName}</p>
          <p className="m-0 font-mono text-eyebrow uppercase tracking-label text-texto-tenue">
            {e.levelName ?? `Nivel ${e.levelRank || '—'}`}
          </p>
        </div>
      </div>

      <p className="m-0 font-ui text-body-s text-texto-tenue">
        {e.haConsultado ? `Última consulta ${tiempoRelativo(e.lastActivityAt)}` : 'Inscrito en tu curso'}
      </p>

      <Boton variante="contorno" className="w-full" onClick={() => navigate('/maestro/chat')}>
        Escribir
      </Boton>
    </li>
  )
}
