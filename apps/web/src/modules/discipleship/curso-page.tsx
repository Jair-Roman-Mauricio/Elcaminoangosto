import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Boton, Eyebrow } from '@elcamino/ui'
import { ApiError } from '../../lib/api-client'
import {
  useCourse,
  useEnroll,
  useCompleteLesson,
  type CourseDetail,
  type Lesson,
} from './api'

/**
 * Course shell (HU-4.2): sidebar de lecciones + contenido + barra de progreso.
 * El progreso se guarda en el servidor al marcar una lección completada.
 */
export function CursoPage() {
  const { slug = '' } = useParams()
  const { data: curso, isPending, error } = useCourse(slug)

  if (isPending) return <Estado>Cargando el curso…</Estado>
  if (error) {
    const msg = error instanceof ApiError && error.statusCode === 404 ? 'Curso no encontrado' : 'No se pudo cargar el curso'
    return <Estado>{msg}</Estado>
  }

  if (!curso.unlocked) return <Bloqueado curso={curso} />
  if (!curso.enrolled) return <NoInscrito curso={curso} slug={slug} />

  return <Contenido curso={curso} slug={slug} />
}

function Contenido({ curso, slug }: { curso: CourseDetail; slug: string }) {
  const lecciones = curso.modules.flatMap((m) => m.lessons)
  const completadas = new Set(curso.completedLessonIds)

  // Lección activa. `null` = "aún no elegida": se resuelve a la primera
  // pendiente al renderizar, sin un efecto que dependa de `lecciones`.
  const [elegidaId, setElegidaId] = useState<string | null>(null)
  const primeraPendiente = lecciones.find((l) => !completadas.has(l.id)) ?? lecciones[0]
  const activa =
    (elegidaId && lecciones.find((l) => l.id === elegidaId)) || primeraPendiente

  const completar = useCompleteLesson(slug)

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-aire-m py-aire-m">
      <header className="flex flex-col gap-aire-xs">
        <Link to="/discipulado" className="font-mono text-eyebrow uppercase tracking-label text-texto-debil no-underline hover:text-texto-tenue">
          ← Catálogo
        </Link>
        <Eyebrow>{curso.requiredLevelRank ? `Nivel ${curso.requiredLevelRank}` : 'Abierto'}</Eyebrow>
        <h1 className="m-0 font-mono text-h-l font-normal text-contenido">{curso.title}</h1>
        <BarraProgreso pct={curso.progressPct} />
      </header>

      <div className="grid gap-aire-m md:grid-cols-[minmax(0,18rem)_1fr]">
        {/* Sidebar de módulos y lecciones */}
        <nav aria-label="Lecciones" className="flex flex-col gap-aire-s">
          {curso.modules.map((m) => (
            <div key={m.id} className="flex flex-col gap-aire-xs">
              <p className="m-0 font-mono text-eyebrow uppercase tracking-label text-texto-tenue">
                {m.title}
              </p>
              <ul className="m-0 flex list-none flex-col gap-px p-0">
                {m.lessons.map((l) => (
                  <li key={l.id}>
                    <button
                      type="button"
                      onClick={() => setElegidaId(l.id)}
                      aria-current={l.id === activa?.id}
                      className={[
                        'flex w-full items-center gap-2 rounded px-aire-s py-aire-xs text-left',
                        'font-mono text-body-s transition-colors duration-fade ease-camino',
                        l.id === activa?.id ? 'bg-superficie-2 text-contenido' : 'text-texto-tenue hover:bg-superficie-1',
                      ].join(' ')}
                    >
                      <span aria-hidden className={completadas.has(l.id) ? 'text-exito' : 'text-texto-debil'}>
                        {completadas.has(l.id) ? '✓' : '○'}
                      </span>
                      <span className="truncate">{l.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Contenido de la lección activa */}
        {activa && (
          <article className="flex flex-col gap-aire-m rounded bg-superficie-1 p-aire-m">
            <div className="flex flex-col gap-aire-xs">
              <Eyebrow rule={false}>{activa.type === 'VIDEO' ? 'Video' : 'Lectura'}</Eyebrow>
              <h2 className="m-0 font-mono text-h-m font-normal text-contenido">{activa.title}</h2>
            </div>

            <LeccionCuerpo leccion={activa} />

            <div className="flex items-center justify-between border-t border-linea pt-aire-s">
              {completadas.has(activa.id) ? (
                <span className="font-mono text-eyebrow uppercase tracking-label text-exito">
                  ✓ Completada
                </span>
              ) : (
                <Boton
                  onClick={() => completar.mutate(activa.id)}
                  disabled={completar.isPending}
                >
                  {completar.isPending ? 'Guardando…' : 'Marcar como completada'}
                </Boton>
              )}
            </div>
          </article>
        )}
      </div>
    </div>
  )
}

function LeccionCuerpo({ leccion }: { leccion: Lesson }) {
  if (leccion.type === 'TEXT') {
    return (
      <div className="font-serif text-body-l leading-relaxed text-contenido/[0.9]">
        {leccion.content?.split('\n').map((p, i) => (
          <p key={i} className="mb-aire-s">
            {p}
          </p>
        ))}
      </div>
    )
  }

  // El reproductor real (URL firmada + hls.js) llega en S3 (HU-8.3). Aquí, el marco.
  return (
    <div className="flex aspect-video items-center justify-center rounded bg-superficie-2 font-mono text-body-s text-texto-debil">
      El reproductor de video llega en el Sprint S3.
    </div>
  )
}

function BarraProgreso({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-aire-s">
      <div className="h-1 flex-1 overflow-hidden rounded bg-linea">
        <div
          className="h-full bg-vino transition-[width] duration-fade ease-camino"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-eyebrow tabular-nums text-texto-tenue">{Math.round(pct)}%</span>
    </div>
  )
}

function NoInscrito({ curso, slug }: { curso: CourseDetail; slug: string }) {
  const enroll = useEnroll()
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-aire-m py-aire-l text-center">
      <Eyebrow>{curso.requiredLevelRank ? `Nivel ${curso.requiredLevelRank}` : 'Abierto'}</Eyebrow>
      <h1 className="m-0 font-mono text-h-l font-normal text-contenido">{curso.title}</h1>
      {curso.description && <p className="m-0 font-mono text-body text-texto-tenue">{curso.description}</p>}
      <Boton onClick={() => enroll.mutate(curso.id)} disabled={enroll.isPending}>
        {enroll.isPending ? 'Inscribiendo…' : 'Inscribirme a este curso'}
      </Boton>
      <Link to="/discipulado" className="font-mono text-eyebrow uppercase tracking-label text-texto-debil no-underline hover:text-texto-tenue">
        ← Volver al catálogo
      </Link>
      {/* `slug` conservado para futura navegación entre curso y lección. */}
      <span className="sr-only">{slug}</span>
    </div>
  )
}

function Bloqueado({ curso }: { curso: CourseDetail }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-aire-m py-aire-l text-center">
      <span aria-hidden className="text-4xl">🔒</span>
      <h1 className="m-0 font-mono text-h-l font-normal text-contenido">{curso.title}</h1>
      <p className="m-0 font-mono text-body text-aviso">
        Este curso requiere el nivel {curso.requiredLevelRank}. Sigue avanzando para desbloquearlo.
      </p>
      <Link to="/discipulado" className="font-mono text-eyebrow uppercase tracking-label text-texto-debil no-underline hover:text-texto-tenue">
        ← Volver al catálogo
      </Link>
    </div>
  )
}

const Estado = ({ children }: { children: string }) => (
  <p className="py-aire-l text-center font-mono text-body text-texto-tenue">{children}</p>
)
