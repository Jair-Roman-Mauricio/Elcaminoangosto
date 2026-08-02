import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Boton, Modal, ModalConfirmacion } from '@elcamino/ui'
import {
  useStudentView,
  useModerateLesson,
  useBlockCourse,
  useModerationLog,
  type ModerationAction,
  type ModerationLogEntry,
} from '../discipleship/authoring-api'
import { VistaDeLeccion } from '../discipleship/editor-curso-page'
import { IconoLeccion } from '../discipleship/lesson-icon'
import { MarcaCursoBloqueado, MarcaModeracion } from '../discipleship/marca-moderacion'
import type { Lesson } from '../discipleship/api'
import { ApiError } from '../../lib/api-client'
import '../discipleship/editor-curso.css'

/** Cómo se lee cada decisión en la bitácora. */
const ACCION: Record<ModerationAction, string> = {
  LESSON_APPROVED: 'Aprobó el contenido',
  LESSON_PENDING: 'Devolvió el contenido a pendiente',
  LESSON_BLOCKED: 'Bloqueó el contenido',
  COURSE_BLOCKED: 'Bloqueó el curso',
  COURSE_UNBLOCKED: 'Reactivó el curso',
}

/**
 * Decisión pendiente de confirmar. Toda acción de moderación se ve fuera de la
 * plataforma —publica o retira contenido para los estudiantes— y varias no se
 * deshacen solas, así que ninguna se ejecuta con un clic suelto.
 */
interface Confirmacion {
  titulo: string
  descripcion: string
  textoConfirmar: string
  aplicar: () => void
}

/**
 * Detalle de moderación (HU-7.2): el admin revisa el contenido de un curso ya
 * publicado, aprueba o bloquea contenidos cambiados/nuevos, y puede bloquear el
 * curso por completo si el profesor no corrige.
 */
export function ModeracionDetallePage() {
  const { id = '' } = useParams()
  const { data: curso, isPending } = useStudentView(id)
  const { data: bitacora } = useModerationLog(id)
  const moderar = useModerateLesson(id)
  const bloquearCurso = useBlockCourse(id)
  const [activa, setActiva] = useState<Lesson | null>(null)
  const [verBitacora, setVerBitacora] = useState(false)
  const [confirmacion, setConfirmacion] = useState<Confirmacion | null>(null)
  const entradas = bitacora ?? []
  const errorDeAccion = mensajeDeError(moderar.error) ?? mensajeDeError(bloquearCurso.error)
  const aplicando = moderar.isPending || bloquearCurso.isPending

  const confirmarLeccion = (leccion: Lesson, status: 'APPROVED' | 'BLOCKED') =>
    setConfirmacion({
      titulo: status === 'APPROVED' ? 'Aprobar el contenido' : 'Bloquear el contenido',
      descripcion:
        status === 'APPROVED'
          ? `«${leccion.title}» quedará visible para los estudiantes inscritos.`
          : `«${leccion.title}» dejará de verse en el curso hasta que el profesor lo corrija y lo apruebes de nuevo.`,
      textoConfirmar: status === 'APPROVED' ? 'Aprobar' : 'Bloquear',
      aplicar: () => moderar.mutate({ lessonId: leccion.id, status }),
    })

  const confirmarCurso = (bloquear: boolean) =>
    setConfirmacion({
      titulo: bloquear ? 'Bloquear el curso' : 'Reactivar el curso',
      descripcion: bloquear
        ? 'El curso desaparecerá del catálogo y nadie podrá abrirlo ni inscribirse, ni siquiera quienes ya están inscritos.'
        : 'El curso vuelve al catálogo y los estudiantes recuperan el acceso a su contenido aprobado.',
      textoConfirmar: bloquear ? 'Bloquear curso' : 'Reactivar curso',
      aplicar: () => bloquearCurso.mutate(bloquear),
    })

  const modulos = useMemo(() => curso?.modules ?? [], [curso])
  const lecciones = useMemo(() => modulos.flatMap((m) => m.lessons), [modulos])
  const pendientes = lecciones.filter((l) => l.moderationStatus === 'PENDING').length

  if (isPending) {
    return <p className="mx-auto max-w-5xl px-aire-m py-aire-l font-mono text-texto-tenue">Cargando…</p>
  }
  if (!curso) {
    return (
      <div className="mx-auto max-w-5xl px-aire-m py-aire-l">
        <p className="font-mono text-texto-tenue">Curso no encontrado.</p>
      </div>
    )
  }

  const bloqueado = curso.blocked

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-aire-l py-aire-m">
      {/* Para volver a la cola está el breadcrumb del layout: no se duplica aquí. */}
      <header className="flex flex-col gap-aire-s">
        <div className="flex flex-wrap items-end justify-between gap-aire-s">
          <div className="flex items-center gap-aire-s">
            <h1 className="m-0 font-mono text-h-l font-normal text-contenido">{curso.title}</h1>
            {bloqueado && <MarcaCursoBloqueado />}
          </div>
          <div className="flex flex-wrap items-center gap-aire-xs">
            <Boton variante="contorno" onClick={() => setVerBitacora(true)}>
              Bitácora{entradas.length > 0 && ` (${entradas.length})`}
            </Boton>
            <Boton
              variante={bloqueado ? 'contorno' : 'formulario'}
              onClick={() => confirmarCurso(!bloqueado)}
              disabled={bloquearCurso.isPending}
              className={bloqueado ? '' : 'hover:border-vino hover:bg-vino hover:text-hueso'}
            >
              {bloqueado ? 'Reactivar curso' : 'Bloquear curso'}
            </Boton>
          </div>
        </div>
        <p className="m-0 font-ui text-body-s text-texto-tenue">
          {pendientes > 0
            ? `${pendientes} contenido(s) por verificar. Apruébalos para que los vean los estudiantes o bloquéalos para que el profesor los corrija.`
            : 'No hay contenido pendiente de verificación.'}
        </p>
        {errorDeAccion && (
          <p role="alert" className="m-0 font-ui text-body-s text-vino">
            {errorDeAccion}
          </p>
        )}
      </header>

      <section className="flex flex-col gap-aire-s bg-superficie-1 p-aire-m shadow-[0_0.9rem_2.2rem_-0.5rem_rgba(20,17,15,0.22)]">
        {lecciones.length === 0 && (
          <p className="m-0 font-ui text-body-s text-texto-tenue">Este curso no tiene contenidos.</p>
        )}
        {modulos.map((m) => (
          <div key={m.id} className="flex flex-col gap-aire-xs">
            <span className="font-mono text-eyebrow uppercase tracking-label text-texto-debil">{m.title}</span>
            {m.lessons.map((l) => {
              const estado = l.moderationStatus ?? 'APPROVED'
              return (
                <div
                  key={l.id}
                  className="flex flex-wrap items-center gap-aire-s border-l-2 border-linea py-aire-xs pl-aire-s"
                >
                  <IconoLeccion tipo={l.type} className="size-4 shrink-0 text-vino" />
                  <span className="min-w-0 flex-1 truncate font-mono text-body-s text-contenido">{l.title}</span>
                  <MarcaModeracion estado={estado} tamano="mini" />
                  <Boton variante="pastilla" onClick={() => setActiva(l)}>
                    Ver
                  </Boton>
                  {estado !== 'APPROVED' && (
                    <Boton
                      variante="pastilla"
                      onClick={() => confirmarLeccion(l, 'APPROVED')}
                      disabled={moderar.isPending}
                    >
                      Aprobar
                    </Boton>
                  )}
                  {estado !== 'BLOCKED' && (
                    <Boton
                      variante="pastilla"
                      onClick={() => confirmarLeccion(l, 'BLOCKED')}
                      disabled={moderar.isPending}
                    >
                      Bloquear
                    </Boton>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </section>

      <Modal
        abierto={verBitacora}
        onCerrar={() => setVerBitacora(false)}
        titulo="Bitácora"
        descripcion="Toda decisión de moderación de este curso queda registrada aquí."
      >
        <Bitacora entradas={entradas} />
      </Modal>

      <Modal
        abierto={activa !== null}
        onCerrar={() => setActiva(null)}
        titulo={activa?.title ?? 'Contenido'}
        className="max-w-3xl"
      >
        <VistaDeLeccion leccion={activa} editable={false} onCrearModulo={() => {}} />
      </Modal>

      <ModalConfirmacion
        abierto={confirmacion !== null}
        titulo={confirmacion?.titulo ?? ''}
        descripcion={confirmacion?.descripcion ?? ''}
        textoConfirmar={confirmacion?.textoConfirmar ?? 'Confirmar'}
        ocupado={aplicando}
        onConfirmar={() => {
          confirmacion?.aplicar()
          setConfirmacion(null)
        }}
        onCancelar={() => setConfirmacion(null)}
      />
    </div>
  )
}

const FORMATO_FECHA = new Intl.DateTimeFormat('es-PE', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

/**
 * Auditoría de HU-7.2 (contenido del diálogo; el título lo pone el `Modal`).
 * Las decisiones llegan de la más reciente a la más antigua.
 */
function Bitacora({ entradas }: { entradas: ModerationLogEntry[] }) {
  return (
    <section className="flex flex-col gap-aire-s">
      {entradas.length === 0 ? (
        <p className="m-0 font-ui text-body-s text-texto-tenue">
          Todavía no se ha moderado nada en este curso.
        </p>
      ) : (
        <ol className="m-0 flex list-none flex-col gap-aire-xs p-0">
          {entradas.map((e) => (
            <li
              key={e.id}
              className="flex flex-wrap items-baseline gap-aire-xs border-l-2 border-linea py-aire-xs pl-aire-s font-ui text-body-s text-texto-tenue"
            >
              <span className="text-contenido">{ACCION[e.action]}</span>
              {e.lessonTitle && <span className="font-mono">«{e.lessonTitle}»</span>}
              <span>· {e.moderatorName}</span>
              <span>· {FORMATO_FECHA.format(new Date(e.createdAt))}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

/** Mensaje legible de un fallo del API; `null` si no hubo error. */
function mensajeDeError(error: unknown): string | null {
  if (!error) return null
  return error instanceof ApiError ? error.message : 'No se pudo aplicar la decisión.'
}
