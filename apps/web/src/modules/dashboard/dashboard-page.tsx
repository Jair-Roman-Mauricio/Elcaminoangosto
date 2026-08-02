import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Eyebrow, Reveal } from '@elcamino/ui'
import { apiClient } from '../../lib/api-client'
import { usePerfil } from '../../auth/session'
import { useVistaComo } from '../../components/vista-como'
import { useMyCourses, useCourseCompletions, type CourseCompletion } from '../discipleship/authoring-api'
import { DashboardPage as PanelAdmin } from '../admin/dashboard-page'
import { BarrasV, Dona, type Serie } from './charts'

/**
 * Base de la navegación para MAESTRO y ADMIN: el dashboard del que cuelgan sus
 * secciones. Es rol-aware (respeta el «ver como» del admin): el administrador
 * reutiliza su panel de gobernanza; el maestro estrena su propio dashboard.
 */
export function DashboardHomePage() {
  const { rolEfectivo } = useVistaComo()
  if (rolEfectivo === 'ADMIN') return <PanelAdmin />
  return <DashboardMaestro />
}

interface StudentRow {
  studentId: string
  displayName: string
  levelName: string | null
  levelRank: number
  lastActivityAt: string | null
  haConsultado: boolean
  courses: { id: string; title: string }[]
}

const SEMANA_MS = 7 * 24 * 60 * 60 * 1000

function DashboardMaestro() {
  const { data: perfil } = usePerfil()
  const { data: estudiantes } = useQuery({
    queryKey: ['my-students'],
    queryFn: () => apiClient.get<StudentRow[]>('/users/my-students'),
  })
  const { data: cursos } = useMyCourses()
  const { data: completitud } = useCourseCompletions()

  const nombre = perfil?.displayName?.split(/\s+/)[0] ?? 'profesor'
  const cursosConInscritos = (completitud ?? []).filter((c) => c.enrolled > 0)
  const totalCompletaron = cursosConInscritos.reduce((s, c) => s + c.completed, 0)
  const alumnos = useMemo(() => estudiantes ?? [], [estudiantes])
  const misCursos = useMemo(() => cursos ?? [], [cursos])

  const totalEstudiantes = alumnos.length
  const totalCursos = misCursos.length
  const publicados = misCursos.filter((c) => c.status === 'PUBLISHED').length
  const enRevision = misCursos.filter((c) => c.status === 'SUBMITTED' || c.status === 'UNDER_REVIEW').length
  const borradores = misCursos.filter((c) => c.status === 'DRAFT').length
  const consultasSemana = alumnos.filter(
    (a) => a.lastActivityAt && Date.now() - new Date(a.lastActivityAt).getTime() < SEMANA_MS,
  ).length

  // Estudiantes por curso (+ consultas libres, sin inscripción).
  const porCurso = useMemo<Serie[]>(() => {
    const cuenta = new Map<string, number>()
    let libres = 0
    for (const a of alumnos) {
      if (a.courses.length === 0) libres += 1
      for (const c of a.courses) cuenta.set(c.title, (cuenta.get(c.title) ?? 0) + 1)
    }
    const filas = [...cuenta].map(([label, valor]) => ({ label, valor }))
    if (libres > 0) filas.push({ label: 'Consultas libres', valor: libres })
    return filas.sort((a, b) => b.valor - a.valor)
  }, [alumnos])

  // Distribución por nivel de discipulado.
  const porNivel = useMemo<Serie[]>(() => {
    const cuenta = new Map<string, { valor: number; rank: number }>()
    for (const a of alumnos) {
      const label = a.levelName ?? `Nivel ${a.levelRank}`
      const prev = cuenta.get(label) ?? { valor: 0, rank: a.levelRank }
      cuenta.set(label, { valor: prev.valor + 1, rank: a.levelRank })
    }
    return [...cuenta]
      .map(([label, { valor, rank }]) => ({ label, valor, rank }))
      .sort((a, b) => a.rank - b.rank)
  }, [alumnos])

  // Estado de tus cursos (accionable: qué falta terminar o enviar). Colores
  // categóricos Okabe-Ito, seguros para daltonismo (validados) + etiquetas.
  const porEstado = useMemo<Serie[]>(
    () =>
      [
        { label: 'Publicados', valor: publicados, color: '#009E73' },
        { label: 'En revisión', valor: enRevision, color: '#E69F00' },
        { label: 'Borradores', valor: borradores, color: '#0072B2' },
      ].filter((f) => f.valor > 0),
    [publicados, enRevision, borradores],
  )

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-aire-l py-aire-m">
      <header className="flex flex-col gap-aire-xs">
        <Eyebrow>Panel del profesor</Eyebrow>
        <h1 className="m-0 font-mono text-h-l font-normal text-contenido">Hola, {nombre}</h1>
        <p className="m-0 font-mono text-body text-texto-tenue">
          Tu punto de partida: acompaña a tus estudiantes y gestiona tus cursos.
        </p>
      </header>

      {/* Métricas */}
      <div className="grid gap-aire-m sm:grid-cols-2 md:grid-cols-4">
        <Metrica valor={totalEstudiantes} label="Estudiantes" />
        <Metrica valor={consultasSemana} label="Consultas · 7 días" />
        <Metrica valor={publicados} label="Cursos publicados" />
        <Metrica valor={enRevision} label="En revisión" acento={enRevision > 0} />
      </div>

      {/* Pendientes: alertas accionables en vez de vigilancia constante. */}
      {(enRevision > 0 || borradores > 0) && (
        <div className="flex flex-col gap-aire-xs rounded-xl border border-linea bg-superficie-1 p-aire-s">
          <span className="font-mono text-eyebrow uppercase tracking-label text-vino">Pendientes</span>
          <ul className="m-0 flex list-none flex-col gap-aire-xs p-0">
            {enRevision > 0 && (
              <Pendiente to="/maestro/cursos">
                {enRevision} curso(s) en revisión esperando aprobación.
              </Pendiente>
            )}
            {borradores > 0 && (
              <Pendiente to="/maestro/cursos">
                {borradores} borrador(es) por terminar y enviar a revisión.
              </Pendiente>
            )}
          </ul>
        </div>
      )}

      {/* Completitud: cuántos estudiantes acabaron cada curso. */}
      <Panel
        titulo="Estudiantes que completaron cada curso"
        vacio={cursosConInscritos.length === 0 ? 'Aún no hay estudiantes inscritos en tus cursos.' : undefined}
      >
        <Completitud datos={cursosConInscritos} totalCompletaron={totalCompletaron} />
      </Panel>

      {/* Gráficas */}
      <div className="grid gap-aire-m md:grid-cols-2">
        <Panel titulo="Estudiantes por curso" vacio={porCurso.length === 0 ? 'Aún no hay estudiantes ligados a tus cursos.' : undefined}>
          <BarrasV datos={porCurso} unidad="estudiante" />
        </Panel>
        <Panel titulo="Niveles de tus estudiantes" vacio={porNivel.length === 0 ? 'Aún no tienes estudiantes.' : undefined}>
          <BarrasV datos={porNivel} unidad="estudiante" />
        </Panel>
        <Panel titulo="Estado de tus cursos" vacio={porEstado.length === 0 ? 'Aún no has creado cursos.' : undefined}>
          <Dona datos={porEstado} unidad="curso" />
        </Panel>
        <Panel titulo="Accesos rápidos">
          <div className="flex flex-col gap-aire-xs">
            <Acceso to="/maestro/cursos" titulo="Mis cursos" nota={`${totalCursos} curso(s)`} />
            <Acceso to="/maestro/chat" titulo="Chat con estudiantes" nota="Responde consultas" />
            <Acceso to="/maestro/estudiantes" titulo="Mis estudiantes" nota={`${totalEstudiantes} persona(s)`} />
          </div>
        </Panel>
      </div>
    </div>
  )
}


/**
 * Cuántos estudiantes completaron cada curso: barra de progreso (completados /
 * inscritos) con la cifra directa. Verde = finalización (buen resultado).
 */
function Completitud({ datos, totalCompletaron }: { datos: CourseCompletion[]; totalCompletaron: number }) {
  return (
    <div className="flex flex-col gap-aire-s">
      <p className="m-0 font-mono text-body-s text-texto-tenue">
        {totalCompletaron} finalización(es) en total en tus cursos.
      </p>
      <ul className="m-0 flex list-none flex-col gap-aire-s p-0">
        {datos.map((d) => {
          const pct = d.enrolled > 0 ? Math.round((d.completed / d.enrolled) * 100) : 0
          return (
            <li key={d.courseId} className="flex flex-col gap-aire-xs">
              <div className="flex items-baseline justify-between gap-aire-s">
                <span className="truncate font-mono text-body-s text-contenido" title={d.title}>
                  {d.title}
                </span>
                <span className="shrink-0 font-mono text-body-s tabular-nums text-texto-tenue">
                  {d.completed} de {d.enrolled} · {pct}%
                </span>
              </div>
              <span
                className="relative block h-[0.55rem] rounded-full bg-[var(--linea)]"
                title={`${d.title}: ${d.completed} de ${d.enrolled} completaron`}
              >
                <span
                  className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-fade ease-camino"
                  style={{ width: `${pct}%`, background: '#009E73' }}
                />
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Panel({
  titulo,
  vacio,
  children,
}: {
  titulo: string
  vacio?: string | undefined
  children?: React.ReactNode
}) {
  return (
    <Reveal>
      <section className="flex h-full flex-col gap-aire-s rounded-xl border border-linea bg-superficie-1 p-aire-m">
        <h2 className="m-0 font-mono text-body font-normal text-contenido">{titulo}</h2>
        {vacio ? <p className="m-0 font-ui text-body-s text-texto-tenue">{vacio}</p> : children}
      </section>
    </Reveal>
  )
}

function Metrica({ valor, label, acento = false }: { valor: number; label: string; acento?: boolean }) {
  return (
    <div className="flex flex-col gap-aire-xs rounded-xl border border-linea bg-superficie-1 p-aire-s">
      <span className={`font-mono text-h-l font-normal leading-none ${acento ? 'text-vino' : 'text-contenido'}`}>
        {valor}
      </span>
      <span className="font-mono text-eyebrow uppercase tracking-label text-texto-tenue">{label}</span>
    </div>
  )
}

function Pendiente({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <li>
      <Link
        to={to}
        className="flex items-center gap-aire-xs font-ui text-body-s text-texto-tenue no-underline transition-colors hover:text-contenido"
      >
        <span aria-hidden="true" className="size-[0.4rem] shrink-0 rounded-full bg-vino" />
        {children}
      </Link>
    </li>
  )
}

function Acceso({ to, titulo, nota }: { to: string; titulo: string; nota: string }) {
  return (
    <Link
      to={to}
      className="group flex items-center justify-between rounded-lg border border-linea px-aire-s py-aire-xs no-underline transition-colors duration-fade ease-camino hover:border-vino"
    >
      <span className="flex flex-col">
        <span className="font-mono text-body-s text-contenido">{titulo}</span>
        <span className="font-mono text-eyebrow uppercase tracking-label text-texto-tenue">{nota}</span>
      </span>
      <span className="font-mono text-eyebrow text-texto-tenue transition-colors group-hover:text-vino">→</span>
    </Link>
  )
}
