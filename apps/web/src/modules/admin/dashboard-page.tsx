import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Eyebrow, Reveal } from '@elcamino/ui'
import type { Role } from '@elcamino/shared-types'
import { apiClient } from '../../lib/api-client'

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

  const total = usuarios?.length ?? 0
  const maestros = usuarios?.filter((u) => u.role === 'MAESTRO').length ?? 0
  const estudiantes = usuarios?.filter((u) => u.role === 'ESTUDIANTE').length ?? 0
  const porRevisar = cola?.length ?? 0

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
            descripcion="Revisa el contenido reportado (S6)."
          />
        </Reveal>
      </div>
    </div>
  )
}

function Metrica({ valor, label, acento = false }: { valor: number; label: string; acento?: boolean }) {
  return (
    <div className="flex flex-col gap-aire-xs rounded border border-linea bg-superficie-1 p-aire-m">
      <span className={`font-mono text-display leading-none ${acento ? 'text-vino' : 'text-contenido'}`}>
        {valor}
      </span>
      <span className="font-mono text-eyebrow uppercase tracking-label text-texto-tenue">{label}</span>
    </div>
  )
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
        'flex flex-col gap-aire-xs rounded border bg-superficie-1 p-aire-m no-underline',
        'transition-colors duration-fade ease-camino',
        resalta ? 'border-vino/50 hover:border-vino' : 'border-linea hover:border-linea-fuerte',
      ].join(' ')}
    >
      <Eyebrow rule={false}>{eyebrow}</Eyebrow>
      <h2 className="m-0 font-mono text-h-s font-normal text-contenido">{titulo}</h2>
      <p className="m-0 font-mono text-body-s text-texto-tenue">{descripcion}</p>
      <span className="mt-aire-xs font-mono text-eyebrow uppercase tracking-label text-contenido">
        Abrir →
      </span>
    </Link>
  )
}
