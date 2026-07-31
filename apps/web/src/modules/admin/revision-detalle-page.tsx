import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Boton, Field, Modal, Textarea } from '@elcamino/ui'
import {
  useStudentView,
  useReviewActions,
  useObservations,
  useAddObservation,
  useDeleteObservation,
  type Observation,
  type ObservationResource,
} from '../discipleship/authoring-api'
import { VistaDeLeccion } from '../discipleship/editor-curso-page'
import { EstadoBadge } from '../discipleship/estado-curso'
import { IconoLeccion } from '../discipleship/lesson-icon'
import type { Lesson } from '../discipleship/api'
import '../discipleship/editor-curso.css'

/**
 * Canvas de revisión (ADMIN): replica la vista del profesor —portada, descripción,
 * propósito, objetivos y contenidos— pero donde el profesor edita, el admin deja
 * indicaciones de cambio por recurso. El profesor las verá en su editor (HU-5.2).
 */
export function RevisionDetallePage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { data: curso, isPending } = useStudentView(id)
  const { data: observaciones } = useObservations(id)
  const { take, approve, reject } = useReviewActions(id)

  const modulos = useMemo(() => curso?.modules ?? [], [curso])
  const [rechazando, setRechazando] = useState(false)
  const [notas, setNotas] = useState('')

  if (isPending) {
    return <p className="mx-auto max-w-5xl px-aire-m py-aire-l font-mono text-texto-tenue">Cargando…</p>
  }
  if (!curso) {
    return (
      <div className="mx-auto max-w-5xl px-aire-m py-aire-l">
        <p className="font-mono text-texto-tenue">Curso no encontrado.</p>
        <Link to="/admin/revisiones" className="font-mono text-body-s text-vino">← Volver a la cola</Link>
      </div>
    )
  }

  const enRevision = curso.status === 'UNDER_REVIEW'
  const puedeIndicar = enRevision || curso.status === 'SUBMITTED'
  const obs = observaciones ?? []
  const hayIndicaciones = obs.length > 0
  const err = take.error ?? approve.error ?? reject.error

  const rechazar = (borrarTodo: boolean) => {
    if (notas.trim().length < 1) return
    reject.mutate(
      { notes: notas.trim(), ...(borrarTodo ? { borrarTodo: true } : {}) },
      { onSuccess: () => navigate('/admin/revisiones') },
    )
  }

  // Con indicaciones, «Aprobar» se convierte en «Mandar a revisión»: devuelve el
  // curso al profesor para que corrija según las indicaciones dejadas.
  const mandarARevision = () =>
    reject.mutate(
      { notes: 'Revisa las indicaciones dejadas en cada recurso y vuelve a enviar el curso.' },
      { onSuccess: () => navigate('/admin/revisiones') },
    )

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-aire-l py-aire-m">
      {/* Barra superior */}
      <header className="flex flex-col gap-aire-s">
        <Link
          to="/admin/revisiones"
          className="w-fit font-mono text-eyebrow uppercase tracking-label text-texto-tenue no-underline hover:text-vino"
        >
          ← Cola de revisión
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-aire-s">
          <div className="flex items-center gap-aire-s">
            <h1 className="m-0 font-mono text-h-l font-normal text-contenido">{curso.title}</h1>
            <EstadoBadge status={curso.status} />
          </div>
          <div className="flex flex-wrap items-center gap-aire-s">
            {curso.status === 'SUBMITTED' && (
              <Boton
                variante="formulario"
                onClick={() => take.mutate()}
                disabled={take.isPending}
                className="hover:border-vino hover:bg-vino hover:text-hueso"
              >
                {take.isPending ? 'Tomando…' : 'Tomar para revisar'}
              </Boton>
            )}
            {enRevision && !rechazando && (
              <>
                <Boton variante="contorno" onClick={() => setRechazando(true)}>
                  Rechazar
                </Boton>
                {hayIndicaciones ? (
                  <Boton
                    variante="formulario"
                    onClick={mandarARevision}
                    disabled={reject.isPending}
                    className="hover:border-vino hover:bg-vino hover:text-hueso"
                  >
                    {reject.isPending ? 'Enviando…' : 'Mandar a corrección'}
                  </Boton>
                ) : (
                  <Boton
                    variante="formulario"
                    onClick={() => approve.mutate(null)}
                    disabled={approve.isPending}
                    className="hover:border-vino hover:bg-vino hover:text-hueso"
                  >
                    {approve.isPending ? 'Aprobando…' : 'Aprobar'}
                  </Boton>
                )}
              </>
            )}
          </div>
        </div>
        {puedeIndicar && (
          <p className="m-0 font-ui text-body-s text-texto-tenue">
            Deja indicaciones de cambio en cada recurso. El profesor las verá en su editor.
          </p>
        )}
        {err instanceof Error && (
          <p role="alert" className="m-0 font-mono text-body-s text-vino">{err.message}</p>
        )}
      </header>

      {/* Portada */}
      <Recurso titulo="Portada">
        {curso.coverImageUrl ? (
          <img
            src={curso.coverImageUrl}
            alt="Portada del curso"
            className="max-h-48 w-full rounded-lg object-cover"
          />
        ) : (
          <p className="m-0 font-ui text-body-s text-texto-tenue">Sin portada.</p>
        )}
        <Indicaciones courseId={id} tipo="COVER" obs={obs} puedeIndicar={puedeIndicar} />
      </Recurso>

      {/* Descripción */}
      <Recurso titulo="Descripción general">
        <p className="m-0 font-ui text-body text-contenido">
          {curso.description || <span className="text-texto-tenue">Sin descripción.</span>}
        </p>
        <Indicaciones courseId={id} tipo="DESCRIPTION" obs={obs} puedeIndicar={puedeIndicar} />
      </Recurso>

      {/* Propósito */}
      <Recurso titulo="Propósito">
        <p className="m-0 font-ui text-body text-contenido">
          {curso.purpose || <span className="text-texto-tenue">Sin propósito.</span>}
        </p>
        <Indicaciones courseId={id} tipo="PURPOSE" obs={obs} puedeIndicar={puedeIndicar} />
      </Recurso>

      {/* Objetivos */}
      <Recurso titulo="Lo que aprenderás">
        {curso.learningObjectives.length > 0 ? (
          <ul className="m-0 flex list-disc flex-col gap-aire-xs pl-aire-m font-ui text-body text-contenido">
            {curso.learningObjectives.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        ) : (
          <p className="m-0 font-ui text-body-s text-texto-tenue">Sin objetivos.</p>
        )}
        <Indicaciones courseId={id} tipo="OBJECTIVES" obs={obs} puedeIndicar={puedeIndicar} />
      </Recurso>

      {/* Contenidos */}
      <Recurso titulo="Contenidos">
        {modulos.length === 0 && (
          <p className="m-0 font-ui text-body-s text-texto-tenue">Este borrador aún no tiene contenidos.</p>
        )}
        <div className="flex flex-col gap-aire-m">
          {modulos.map((m) => (
            <div key={m.id} className="flex flex-col gap-aire-s">
              <span className="font-mono text-eyebrow uppercase tracking-label text-texto-debil">
                {m.title}
              </span>
              {m.lessons.map((l) => (
                <ContenidoRevision
                  key={l.id}
                  courseId={id}
                  leccion={l}
                  obs={obs}
                  puedeIndicar={puedeIndicar}
                />
              ))}
            </div>
          ))}
        </div>
      </Recurso>

      {/* Panel de rechazo */}
      {enRevision && rechazando && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            rechazar(false)
          }}
          className="flex flex-col gap-aire-s bg-superficie-1 p-aire-m shadow-[0_0.9rem_2.2rem_-0.5rem_rgba(20,17,15,0.22)]"
        >
          <Field label="Mensaje de rechazo (obligatorio)" htmlFor="notas-rechazo">
            <Textarea
              id="notas-rechazo"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={3}
              placeholder="Resumen para el profesor. Las indicaciones por recurso ya quedaron guardadas arriba."
              className="text-body-s"
            />
          </Field>
          <div className="flex flex-wrap gap-aire-s">
            <Boton
              type="submit"
              variante="formulario"
              disabled={reject.isPending || notas.trim().length < 1}
              className="hover:border-vino hover:bg-vino hover:text-hueso"
            >
              {reject.isPending ? 'Rechazando…' : 'Rechazar'}
            </Boton>
            <Boton
              type="button"
              variante="contorno"
              onClick={() => rechazar(true)}
              disabled={reject.isPending || notas.trim().length < 1}
            >
              Rechazar y borrar todos los contenidos
            </Boton>
            <Boton type="button" variante="sutil" onClick={() => setRechazando(false)}>
              Cancelar
            </Boton>
          </div>
        </form>
      )}
    </div>
  )
}

function Recurso({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-aire-s bg-superficie-1 p-aire-m shadow-[0_0.9rem_2.2rem_-0.5rem_rgba(20,17,15,0.22)]">
      <h2 className="m-0 font-mono text-body font-normal text-contenido">{titulo}</h2>
      {children}
    </section>
  )
}

function ContenidoRevision({
  courseId,
  leccion,
  obs,
  puedeIndicar,
}: {
  courseId: string
  leccion: Lesson
  obs: Observation[]
  puedeIndicar: boolean
}) {
  const [abierto, setAbierto] = useState(false)
  const nIndic = obs.filter((o) => o.resourceType === 'LESSON' && o.resourceId === leccion.id).length

  return (
    <>
      {/* Fila del contenido: abre el modal de revisión */}
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="group flex items-center gap-aire-s border-l-2 border-linea bg-transparent py-aire-xs pl-aire-s text-left transition-colors hover:border-vino"
      >
        <IconoLeccion tipo={leccion.type} className="size-4 shrink-0 text-vino" />
        <span className="min-w-0 flex-1 truncate font-mono text-body-s text-contenido">{leccion.title}</span>
        {nIndic > 0 && (
          <span className="grid size-[1.35rem] shrink-0 place-items-center rounded-full bg-vino font-mono text-eyebrow text-hueso">
            {nIndic}
          </span>
        )}
        <span className="shrink-0 whitespace-nowrap rounded-full border border-vino bg-vino px-[1.1rem] py-[0.3rem] font-mono text-eyebrow uppercase tracking-label text-hueso">
          Abrir
        </span>
      </button>

      <Modal
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        titulo={leccion.title}
        className="max-w-4xl"
      >
        <div className="grid gap-aire-m md:grid-cols-[minmax(0,1fr)_20rem]">
          {/* Contenido a la izquierda */}
          <div className="min-w-0 bg-fondo">
            <VistaDeLeccion leccion={leccion} editable={false} onCrearModulo={() => {}} />
          </div>
          {/* Indicaciones en columna a la derecha */}
          <aside className="flex flex-col gap-aire-s border-t border-linea pt-aire-s md:border-l md:border-t-0 md:pl-aire-m md:pt-0">
            <span className="font-mono text-eyebrow uppercase tracking-label text-texto-tenue">
              Indicaciones de este contenido
            </span>
            <Indicaciones
              courseId={courseId}
              tipo="LESSON"
              resourceId={leccion.id}
              obs={obs}
              puedeIndicar={puedeIndicar}
            />
          </aside>
        </div>
      </Modal>
    </>
  )
}

/** Lista y alta de indicaciones de un recurso concreto. */
function Indicaciones({
  courseId,
  tipo,
  resourceId,
  obs,
  puedeIndicar,
}: {
  courseId: string
  tipo: ObservationResource
  resourceId?: string
  obs: Observation[]
  puedeIndicar: boolean
}) {
  const agregar = useAddObservation(courseId)
  const borrar = useDeleteObservation(courseId)
  const [texto, setTexto] = useState('')
  const [abierto, setAbierto] = useState(false)

  const propias = obs.filter(
    (o) => o.resourceType === tipo && (resourceId ? o.resourceId === resourceId : !o.resourceId),
  )

  const enviar = () => {
    const nota = texto.trim()
    if (!nota) return
    agregar.mutate(
      { resourceType: tipo, resourceId: resourceId ?? null, note: nota },
      {
        onSuccess: () => {
          setTexto('')
          setAbierto(false)
        },
      },
    )
  }

  return (
    <div className="flex flex-col gap-aire-xs">
      {propias.map((o) => (
        <div
          key={o.id}
          className="flex items-start gap-aire-xs border-l-2 border-vino bg-vino/5 px-aire-s py-aire-xs"
        >
          <span aria-hidden="true" className="mt-[0.15rem] shrink-0 text-vino">✎</span>
          <p className="m-0 flex-1 font-ui text-body-s text-contenido">{o.note}</p>
          {puedeIndicar && (
            <button
              type="button"
              onClick={() => borrar.mutate(o.id)}
              className="shrink-0 bg-transparent font-mono text-eyebrow uppercase tracking-label text-texto-tenue hover:text-vino"
            >
              Quitar
            </button>
          )}
        </div>
      ))}

      {puedeIndicar &&
        (abierto ? (
          <div className="flex flex-col gap-aire-xs">
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={2}
              placeholder="Indicación de cambio para este recurso…"
              className="text-body-s"
            />
            <div className="flex items-center gap-aire-s">
              <Boton
                variante="formulario"
                onClick={enviar}
                disabled={agregar.isPending || !texto.trim()}
                className="h-[2.1rem] w-[7.5rem] min-w-0 shrink-0 px-[1rem] py-0 text-hueso [font-size:0.62rem] [line-height:1] hover:border-vino hover:bg-vino hover:text-hueso"
              >
                {agregar.isPending ? 'Guardando…' : 'Guardar'}
              </Boton>
              <Boton
                variante="contorno"
                onClick={() => setAbierto(false)}
                className="h-[2.1rem] w-[7.5rem] min-w-0 shrink-0 px-[1rem] py-0 [font-size:0.62rem] [line-height:1]"
              >
                Cancelar
              </Boton>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAbierto(true)}
            className="w-fit bg-transparent font-mono text-eyebrow uppercase tracking-label text-vino hover:opacity-80"
          >
            + Añadir indicación
          </button>
        ))}
    </div>
  )
}
