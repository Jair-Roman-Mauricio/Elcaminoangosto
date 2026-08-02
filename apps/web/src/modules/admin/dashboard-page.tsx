import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Boton, Eyebrow, Reveal } from '@elcamino/ui'
import type { Role } from '@elcamino/shared-types'
import { apiClient } from '../../lib/api-client'
import {
  usePublishKeys,
  useGeneratePublishKey,
  useModerationQueue,
} from '../discipleship/authoring-api'
import { BarrasV, Dona, type Serie } from '../dashboard/charts'

interface PlatformStats {
  total: number
  signups: { periodo: string; nuevos: number }[]
  activos7: number
  activos30: number
  porRol: { rol: Role; total: number }[]
}

const ROL_LABEL: Record<Role, string> = {
  ESTUDIANTE: 'Estudiantes',
  MAESTRO: 'Profesores',
  ADMIN: 'Admins',
}
// Colores categóricos Okabe-Ito (CVD-safe, validados) por rol, con leyenda.
const ROL_COLOR: Record<Role, string> = {
  ESTUDIANTE: '#0072B2',
  MAESTRO: '#009E73',
  ADMIN: '#E69F00',
}

// Sombra de card, más visible en el tema claro (sobre superficie blanca) que la
// `shadow-lg` por defecto. Negro cálido (tono de `--contenido`), difuminada.
const SOMBRA = 'shadow-[0_0.9rem_2.2rem_-0.5rem_rgba(20,17,15,0.22)]'
const SOMBRA_FUERTE = 'shadow-[0_1.4rem_3rem_-0.6rem_rgba(20,17,15,0.32)]'

interface UsuarioRow {
  id: string
  role: Role
}
interface CursoCola {
  id: string
  status: string
}

/** Dashboard del ADMIN (HU-7.1): colas y métricas con accesos directos. */
export function DashboardPage() {
  const { data: usuarios } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => apiClient.get<UsuarioRow[]>('/users'),
  })
  const { data: cola } = useQuery({
    queryKey: ['review-queue'],
    queryFn: () => apiClient.get<CursoCola[]>('/discipleship/review-queue'),
  })
  const { data: stats } = useQuery({
    queryKey: ['platform-stats'],
    queryFn: () => apiClient.get<PlatformStats>('/users/platform-stats'),
  })
  const { data: colaModeracion } = useModerationQueue()

  const total = usuarios?.length ?? 0
  const maestros = usuarios?.filter((u) => u.role === 'MAESTRO').length ?? 0
  const estudiantes = usuarios?.filter((u) => u.role === 'ESTUDIANTE').length ?? 0
  const porRevisar = cola?.length ?? 0

  // Cola de moderación (HU-7.2): contenido por verificar y cursos bloqueados.
  const porVerificar = (colaModeracion ?? []).reduce((n, c) => n + c.pendientes, 0)
  const cursosBloqueados = (colaModeracion ?? []).filter((c) => c.blocked).length

  const altas: Serie[] = (stats?.signups ?? []).map((s) => ({ label: s.periodo, valor: s.nuevos }))
  const composicion: Serie[] = (stats?.porRol ?? []).map((r) => ({
    label: ROL_LABEL[r.rol],
    valor: r.total,
    color: ROL_COLOR[r.rol],
  }))

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-aire-l py-aire-m">
      <header className="flex flex-col gap-aire-xs">
        <Eyebrow>Administración</Eyebrow>
        <h1 className="m-0 font-mono text-h-l font-normal text-contenido">Panel</h1>
        <p className="m-0 font-mono text-body text-texto-tenue">
          Gobierna la plataforma: aprueba cursos, gestiona cuentas y modera el contenido.
        </p>
      </header>

      {/* Métricas */}
      <div className="grid gap-aire-m sm:grid-cols-2 md:grid-cols-4">
        <Metrica valor={total} label="Usuarios" />
        <Metrica valor={maestros} label="Profesores" />
        <Metrica valor={estudiantes} label="Estudiantes" />
        <Metrica valor={porRevisar} label="Cursos por revisar" acento={porRevisar > 0} />
      </div>

      {/* Crecimiento y composición de la plataforma */}
      <div className="grid gap-aire-m md:grid-cols-2">
        <div className="md:col-span-2">
          <PanelGrafica
            titulo="Nuevos usuarios por semana"
            nota="Cuánta gente entró a la plataforma (últimas 8 semanas)."
            vacio={altas.every((a) => a.valor === 0) ? 'Aún no hay altas recientes.' : undefined}
          >
            <BarrasV datos={altas} unidad="usuario" />
          </PanelGrafica>
        </div>
        <PanelGrafica titulo="Composición por rol" vacio={composicion.length === 0 ? 'Sin usuarios.' : undefined}>
          <Dona datos={composicion} unidad="usuarios" />
        </PanelGrafica>
        <PanelGrafica titulo="Actividad reciente">
          <div className="flex flex-1 items-center gap-aire-l">
            <NumeroActividad valor={stats?.activos7 ?? 0} label="Activos · 7 días" />
            <NumeroActividad valor={stats?.activos30 ?? 0} label="Activos · 30 días" />
          </div>
        </PanelGrafica>
      </div>

      {/* Colas y accesos */}
      <div className="grid gap-aire-m md:grid-cols-2">
        <Reveal>
          <TarjetaAccion
            to="/admin/revisiones"
            eyebrow="Gobernanza"
            titulo="Cursos por revisar"
            descripcion={
              porRevisar > 0
                ? `${porRevisar} curso(s) esperando tu decisión.`
                : 'No hay cursos en cola.'
            }
            resalta={porRevisar > 0}
          />
        </Reveal>
        <Reveal delay={0.05}>
          <TarjetaAccion
            to="/admin/usuarios"
            eyebrow="Cuentas"
            titulo="Usuarios y roles"
            descripcion="Crea cuentas de profesor y gestiona roles."
          />
        </Reveal>
        <Reveal delay={0.1}>
          <TarjetaAccion
            to="/admin/moderacion"
            eyebrow="Comunidad"
            titulo="Moderación"
            descripcion={descripcionDeModeracion(porVerificar, cursosBloqueados)}
            resalta={porVerificar > 0 || cursosBloqueados > 0}
          />
        </Reveal>
      </div>

      <CodigosDePublicacion />
    </div>
  )
}

/**
 * Llaves de publicación: el admin genera un código de un solo uso y se lo da a
 * un maestro de confianza para que publique su curso sin pasar por revisión.
 */
function CodigosDePublicacion() {
  const { data: codigos } = usePublishKeys()
  const generar = useGeneratePublishKey()

  return (
    <section className={`flex flex-col gap-aire-s bg-superficie-1 p-aire-m ${SOMBRA}`}>
      <div className="flex flex-wrap items-end justify-between gap-aire-s">
        <div className="flex flex-col gap-aire-xs">
          <Eyebrow rule={false}>Publicación</Eyebrow>
          <h2 className="m-0 font-mono text-h-s font-normal text-contenido">
            Códigos de publicación
          </h2>
          <p className="m-0 font-mono text-body-s text-texto-tenue">
            Un código de un solo uso permite a un profesor publicar su curso sin revisión.
          </p>
        </div>
        <Boton
          variante="formulario"
          onClick={() => generar.mutate()}
          disabled={generar.isPending}
          className="hover:border-vino hover:bg-vino hover:text-hueso"
        >
          {generar.isPending ? 'Generando…' : 'Generar código'}
        </Boton>
      </div>

      {generar.data && (
        <p className="m-0 border border-vino/40 bg-vino/10 px-aire-s py-aire-xs font-mono text-body text-contenido">
          Nuevo código: <strong className="tracking-[0.14em]">{generar.data.code}</strong> — cópialo
          y dáselo al profesor.
        </p>
      )}

      {codigos && codigos.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {codigos.map((k) => (
            <li
              key={k.id}
              className="flex items-center justify-between gap-aire-s border-b border-linea/60 py-aire-xs font-mono text-body-s"
            >
              <span className="tracking-[0.14em] text-contenido">{k.code}</span>
              <span
                className={`text-eyebrow uppercase tracking-label ${
                  k.usedAt ? 'text-texto-debil' : 'text-exito'
                }`}
              >
                {k.usedAt ? 'Usado' : 'Disponible'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function PanelGrafica({
  titulo,
  nota,
  vacio,
  children,
}: {
  titulo: string
  nota?: string | undefined
  vacio?: string | undefined
  children?: React.ReactNode
}) {
  return (
    <section className={`flex h-full flex-col gap-aire-s bg-superficie-1 p-aire-m ${SOMBRA}`}>
      <div className="flex flex-col gap-[0.15rem]">
        <h2 className="m-0 font-mono text-body font-normal text-contenido">{titulo}</h2>
        {nota && <p className="m-0 font-ui text-body-s text-texto-tenue">{nota}</p>}
      </div>
      {vacio ? <p className="m-0 font-ui text-body-s text-texto-tenue">{vacio}</p> : children}
    </section>
  )
}

function NumeroActividad({ valor, label }: { valor: number; label: string }) {
  return (
    <div className="flex flex-col gap-aire-xs">
      <span className="font-mono text-display leading-none text-contenido">{valor}</span>
      <span className="font-mono text-eyebrow uppercase tracking-label text-texto-tenue">{label}</span>
    </div>
  )
}

function Metrica({ valor, label, acento = false }: { valor: number; label: string; acento?: boolean }) {
  return (
    <div className={`flex flex-col gap-aire-xs bg-superficie-1 p-aire-m ${SOMBRA}`}>
      <span className={`font-mono text-display leading-none ${acento ? 'text-vino' : 'text-contenido'}`}>
        {valor}
      </span>
      <span className="font-mono text-eyebrow uppercase tracking-label text-texto-tenue">{label}</span>
    </div>
  )
}

/** Resumen de la cola de moderación para la tarjeta del panel (HU-7.2). */
function descripcionDeModeracion(porVerificar: number, cursosBloqueados: number): string {
  const partes: string[] = []
  if (porVerificar > 0) {
    partes.push(`${porVerificar} contenido(s) por verificar`)
  }
  if (cursosBloqueados > 0) {
    partes.push(`${cursosBloqueados} curso(s) bloqueado(s)`)
  }
  if (partes.length === 0) return 'Todo el contenido publicado está verificado.'
  return `${partes.join(' · ')}.`
}

function TarjetaAccion({
  to,
  eyebrow,
  titulo,
  descripcion,
  resalta = false,
}: {
  to: string
  eyebrow: string
  titulo: string
  descripcion: string
  resalta?: boolean
}) {
  return (
    <Link
      to={to}
      className={[
        'group flex flex-col gap-aire-xs bg-superficie-1 p-aire-m no-underline',
        'transition-[box-shadow,transform] duration-fade ease-camino hover:-translate-y-0.5',
        'hover:shadow-[0_1.4rem_3rem_-0.6rem_rgba(20,17,15,0.32)]',
        resalta ? SOMBRA_FUERTE : SOMBRA,
      ].join(' ')}
    >
      <Eyebrow rule={false}>{eyebrow}</Eyebrow>
      <h2 className="m-0 font-mono text-h-s font-normal text-contenido">{titulo}</h2>
      <p className="m-0 font-mono text-body-s text-texto-tenue">{descripcion}</p>
      <span className="mt-aire-s inline-flex w-fit items-center gap-aire-xs whitespace-nowrap rounded-full border border-vino bg-vino px-[1.6rem] py-[0.6rem] font-ui text-body-s font-medium tracking-boton text-hueso">
        Abrir →
      </span>
    </Link>
  )
}
