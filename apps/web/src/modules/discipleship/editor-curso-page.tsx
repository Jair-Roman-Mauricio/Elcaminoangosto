import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Boton, Eyebrow } from '@elcamino/ui'
import type { CourseStatus } from '@elcamino/shared-types'
import {
  useStudentView,
  useAddModule,
  useAddLesson,
  useCourseAction,
  useCourseReviews,
} from './authoring-api'
import { EstadoBadge } from './estado-curso'

/**
 * Editor de curso del maestro (HU-4.3, HU-5.1, HU-5.3). Reúne la estructura
 * (módulos + lecciones), la vista de estudiante (HU-4.4) y las acciones de
 * estado. Solo edita estructura mientras el curso es DRAFT o REJECTED.
 */
export function EditorCursoPage() {
  const { id = '' } = useParams()
  const { data: curso, isPending, error } = useStudentView(id)

  if (isPending) return <Estado>Cargando…</Estado>
  if (error || !curso) return <Estado>No se pudo cargar el curso.</Estado>

  const editable = curso.status === 'DRAFT' || curso.status === 'REJECTED'

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-aire-m py-aire-m">
      <header className="flex flex-col gap-aire-xs">
        <Link
          to="/maestro/cursos"
          className="font-mono text-eyebrow uppercase tracking-label text-texto-debil no-underline hover:text-texto-tenue"
        >
          ← Mis cursos
        </Link>
        <div className="flex items-center gap-aire-s">
          <Eyebrow rule={false}>Editor</Eyebrow>
          <EstadoBadge status={curso.status} />
        </div>
        <h1 className="m-0 font-mono text-h-l font-normal text-hueso">{curso.title}</h1>
        {curso.description && (
          <p className="m-0 font-mono text-body text-texto-tenue">{curso.description}</p>
        )}
      </header>

      <NotasDeRechazo courseId={id} status={curso.status} />

      {/* Estructura: módulos y sus lecciones */}
      <section className="flex flex-col gap-aire-m">
        {curso.modules.length === 0 && (
          <p className="m-0 font-mono text-body-s text-texto-tenue">
            Este curso aún no tiene módulos.
          </p>
        )}
        {curso.modules.map((m, i) => (
          <div key={m.id} className="flex flex-col gap-aire-s rounded border border-linea bg-superficie-1 p-aire-s">
            <p className="m-0 font-mono text-eyebrow uppercase tracking-label text-texto-tenue">
              Módulo {i + 1} · {m.title}
            </p>
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {m.lessons.map((l) => (
                <li key={l.id} className="flex items-center gap-2 font-mono text-body-s text-hueso">
                  <span aria-hidden className="text-texto-debil">
                    {l.type === 'VIDEO' ? '▷' : '≡'}
                  </span>
                  {l.title}
                </li>
              ))}
              {m.lessons.length === 0 && (
                <li className="font-mono text-body-s text-texto-debil">Sin lecciones aún</li>
              )}
            </ul>
            {editable && <NuevaLeccion courseId={id} moduleId={m.id} />}
          </div>
        ))}

        {editable && <NuevoModulo courseId={id} />}
      </section>

      <AccionesDeEstado courseId={id} status={curso.status} />
    </div>
  )
}

function NuevoModulo({ courseId }: { courseId: string }) {
  const add = useAddModule(courseId)
  const [title, setTitle] = useState('')
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!title.trim()) return
        add.mutate(title.trim(), { onSuccess: () => setTitle('') })
      }}
      className="flex items-end gap-aire-s"
    >
      <div className="flex flex-1 flex-col gap-aire-xs">
        <label className="font-mono text-eyebrow uppercase tracking-label text-texto-tenue">Nuevo módulo</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título del módulo"
          className="rounded border border-linea bg-negro/30 px-aire-s py-aire-xs font-mono text-body text-hueso placeholder:text-texto-debil focus:border-hueso"
        />
      </div>
      <Boton type="submit" variante="nav" disabled={add.isPending || !title.trim()}>
        Añadir
      </Boton>
    </form>
  )
}

function NuevaLeccion({ courseId, moduleId }: { courseId: string; moduleId: string }) {
  const add = useAddLesson(courseId)
  const [abierto, setAbierto] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="self-start font-mono text-eyebrow uppercase tracking-label text-hueso underline decoration-vino underline-offset-4 hover:text-vino"
      >
        + Añadir lección
      </button>
    )
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (title.trim().length < 1 || content.trim().length < 1) return
        add.mutate(
          { moduleId, title: title.trim(), content: content.trim() },
          {
            onSuccess: () => {
              setTitle('')
              setContent('')
              setAbierto(false)
            },
          },
        )
      }}
      className="flex flex-col gap-aire-xs rounded border border-linea bg-negro/20 p-aire-s"
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título de la lección"
        className="rounded border border-linea bg-negro/30 px-aire-s py-1 font-mono text-body-s text-hueso placeholder:text-texto-debil focus:border-hueso"
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={2}
        placeholder="Contenido (texto de la lección)"
        className="resize-none rounded border border-linea bg-negro/30 px-aire-s py-1 font-mono text-body-s text-hueso placeholder:text-texto-debil focus:border-hueso"
      />
      <div className="flex gap-aire-s">
        <Boton type="submit" variante="nav" disabled={add.isPending}>
          Guardar
        </Boton>
        <Boton variante="sutil" onClick={() => setAbierto(false)}>
          Cancelar
        </Boton>
      </div>
    </form>
  )
}

function AccionesDeEstado({ courseId, status }: { courseId: string; status: CourseStatus }) {
  const { submit, publish, backToDraft } = useCourseAction(courseId)
  const err = submit.error ?? publish.error ?? backToDraft.error

  return (
    <section className="flex flex-col gap-aire-s border-t border-linea pt-aire-m">
      <div className="flex flex-wrap gap-aire-s">
        {(status === 'DRAFT' || status === 'REJECTED') && (
          <Boton onClick={() => submit.mutate()} disabled={submit.isPending}>
            {submit.isPending ? 'Enviando…' : 'Enviar a revisión'}
          </Boton>
        )}
        {status === 'REJECTED' && (
          <Boton variante="nav" onClick={() => backToDraft.mutate()} disabled={backToDraft.isPending}>
            Volver a borrador
          </Boton>
        )}
        {status === 'APPROVED' && (
          <Boton onClick={() => publish.mutate()} disabled={publish.isPending}>
            {publish.isPending ? 'Publicando…' : 'Publicar'}
          </Boton>
        )}
        {status === 'SUBMITTED' && (
          <p className="m-0 font-mono text-body-s text-aviso">Enviado. Esperando la revisión del admin.</p>
        )}
        {status === 'UNDER_REVIEW' && (
          <p className="m-0 font-mono text-body-s text-marino">Un admin lo está revisando.</p>
        )}
        {status === 'PUBLISHED' && (
          <p className="m-0 font-mono text-body-s text-exito">✓ Publicado y visible en el catálogo.</p>
        )}
      </div>
      {err instanceof Error && (
        <p role="alert" className="m-0 font-mono text-body-s text-vino">
          {err.message}
        </p>
      )}
    </section>
  )
}

/** Muestra las notas del admin cuando el curso fue rechazado (HU-5.2). */
function NotasDeRechazo({ courseId, status }: { courseId: string; status: CourseStatus }) {
  const { data: reviews } = useCourseReviews(courseId, status === 'REJECTED')
  const rechazo = reviews?.find((r) => r.decision === 'REJECTED')
  if (status !== 'REJECTED' || !rechazo) return null
  return (
    <div className="flex flex-col gap-aire-xs rounded border border-vino/50 bg-vino/[0.06] p-aire-s">
      <p className="m-0 font-mono text-eyebrow uppercase tracking-label text-vino">
        Rechazado por {rechazo.reviewerName}
      </p>
      <p className="m-0 font-mono text-body-s text-hueso">{rechazo.notes}</p>
    </div>
  )
}

const Estado = ({ children }: { children: string }) => (
  <p className="py-aire-l text-center font-mono text-body text-texto-tenue">{children}</p>
)
