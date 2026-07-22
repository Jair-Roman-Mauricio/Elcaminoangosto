import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Boton, Field, Input, Modal, Textarea } from '@elcamino/ui'
import type { CourseStatus } from '@elcamino/shared-types'
import type { CourseModule, Lesson } from './api'
import {
  useStudentView,
  useAddModule,
  useAddLesson,
  useCourseAction,
  useCourseReviews,
  useUpdateCourse,
} from './authoring-api'
import { EstadoBadge } from './estado-curso'
import { CourseAccessBadges } from './course-access-badges'
import './editor-curso.css'

/** Plantilla de autoría que conserva la misma composición de la vista del estudiante. */
export function EditorCursoPage() {
  const { id = '' } = useParams()
  const { data: curso, isPending, error } = useStudentView(id)
  const [modalModulo, setModalModulo] = useState(false)
  const [moduloParaContenido, setModuloParaContenido] = useState<CourseModule | null>(null)
  const [editandoDescripcion, setEditandoDescripcion] = useState(false)
  const [leccionActivaId, setLeccionActivaId] = useState<string | null>(null)

  const lecciones = useMemo(
    () => curso?.modules.flatMap((modulo) => modulo.lessons) ?? [],
    [curso?.modules],
  )
  const leccionActiva = lecciones.find((leccion) => leccion.id === leccionActivaId) ?? null

  useEffect(() => {
    if (leccionActivaId || lecciones.length === 0) return
    setLeccionActivaId(lecciones[0]?.id ?? null)
  }, [leccionActivaId, lecciones])

  if (isPending) return <Estado>Cargando la plantilla…</Estado>
  if (error || !curso) return <Estado>No se pudo cargar el curso.</Estado>

  const editable = curso.status === 'DRAFT' || curso.status === 'REJECTED'
  const totalContenidos = lecciones.length

  return (
    <section className="teacher-course-editor">
      <header className="teacher-course-editor__topbar">
        <div className="teacher-course-editor__identity">
          <nav className="teacher-course-editor__breadcrumb" aria-label="Ruta del curso">
            <Link to="/maestro/cursos">Discipulado</Link>
            <span aria-hidden="true">›</span>
            <strong>{curso.title}</strong>
          </nav>
          <div className="teacher-course-editor__access-row">
            <CourseAccessBadges
              isFree={curso.isFree}
              requiredLevelRank={curso.requiredLevelRank}
            />
            <EstadoBadge status={curso.status} />
          </div>
        </div>

        <AccionesDeEstado courseId={id} status={curso.status} />
      </header>

      <NotasDeRechazo courseId={id} status={curso.status} />

      <div className="teacher-course-editor__workspace">
        <main className="teacher-course-editor__main">
          <VistaDeLeccion
            leccion={leccionActiva}
            editable={editable}
            onCrearModulo={() => setModalModulo(true)}
          />

          <DescripcionGeneral
            courseId={id}
            title={curso.title}
            description={curso.description ?? ''}
            modules={curso.modules}
            totalContenidos={totalContenidos}
            editable={editable}
            editando={editandoDescripcion}
            onEditar={() => setEditandoDescripcion(true)}
            onCerrar={() => setEditandoDescripcion(false)}
            onCrearModulo={() => setModalModulo(true)}
          />
        </main>

        <aside className="teacher-course-editor__outline" aria-label="Contenido del curso">
          <header className="teacher-course-editor__outline-header">
            <h2>Contenido del curso</h2>
            <span>0%</span>
          </header>

          <div className="teacher-course-editor__modules">
            {curso.modules.map((modulo) => (
              <ModuloDelCanvas
                key={modulo.id}
                modulo={modulo}
                leccionActivaId={leccionActivaId}
                editable={editable}
                onSeleccionar={setLeccionActivaId}
                onAgregar={() => setModuloParaContenido(modulo)}
              />
            ))}

            {curso.modules.length === 0 && (
              <div className="teacher-course-editor__outline-empty">
                <span aria-hidden="true">□</span>
                <strong>Tu curso todavía no tiene módulos</strong>
                <p>Crea la primera etapa para comenzar a organizar el recorrido.</p>
              </div>
            )}
          </div>

          {editable && (
            <footer className="teacher-course-editor__outline-footer">
              <Boton variante="formulario" onClick={() => setModalModulo(true)} className="w-full">
                + Añadir módulo
              </Boton>
            </footer>
          )}
        </aside>
      </div>

      <Modal
        abierto={modalModulo}
        onCerrar={() => setModalModulo(false)}
        titulo="Añadir módulo"
        descripcion="Crea una nueva etapa dentro del recorrido del curso."
      >
        <FormularioModulo courseId={id} onHecho={() => setModalModulo(false)} />
      </Modal>

      <Modal
        abierto={Boolean(moduloParaContenido)}
        onCerrar={() => setModuloParaContenido(null)}
        titulo="Añadir contenido"
        {...(moduloParaContenido
          ? { descripcion: `Este contenido se agregará a «${moduloParaContenido.title}».` }
          : {})}
      >
        {moduloParaContenido && (
          <FormularioContenido
            courseId={id}
            moduleId={moduloParaContenido.id}
            onHecho={() => setModuloParaContenido(null)}
          />
        )}
      </Modal>
    </section>
  )
}

function VistaDeLeccion({
  leccion,
  editable,
  onCrearModulo,
}: {
  leccion: Lesson | null
  editable: boolean
  onCrearModulo: () => void
}) {
  return (
    <section className="teacher-course-editor__lesson-stage" aria-label="Vista previa de la lección">
      {leccion ? (
        <article className="teacher-course-editor__lesson">
          <span className="teacher-course-editor__eyebrow">
            {leccion.type === 'VIDEO' ? 'Video' : leccion.type === 'EXAM' ? 'Evaluación' : 'Lectura'}
          </span>
          <h1>{leccion.title}</h1>
          <div className="teacher-course-editor__rule" />
          {leccion.type === 'TEXT' ? (
            <p className="teacher-course-editor__lesson-copy">
              {leccion.content || 'Este contenido todavía no tiene texto.'}
            </p>
          ) : (
            <div className="teacher-course-editor__media-placeholder">
              <span aria-hidden="true">▷</span>
              <p>La vista previa del recurso aparecerá aquí.</p>
            </div>
          )}
        </article>
      ) : (
        <div className="teacher-course-editor__lesson-empty">
          <span className="teacher-course-editor__eyebrow">Plantilla del contenido</span>
          <h1>El lienzo está vacío</h1>
          <p>Cuando agregues una lectura, video o evaluación podrás previsualizarla en este espacio.</p>
          {editable && (
            <Boton variante="nav" onClick={onCrearModulo}>
              Crear primer módulo
            </Boton>
          )}
        </div>
      )}
    </section>
  )
}

function DescripcionGeneral({
  courseId,
  title,
  description,
  modules,
  totalContenidos,
  editable,
  editando,
  onEditar,
  onCerrar,
  onCrearModulo,
}: {
  courseId: string
  title: string
  description: string
  modules: CourseModule[]
  totalContenidos: number
  editable: boolean
  editando: boolean
  onEditar: () => void
  onCerrar: () => void
  onCrearModulo: () => void
}) {
  return (
    <section className="teacher-course-editor__overview" aria-labelledby="descripcion-general">
      <header className="teacher-course-editor__overview-tab">
        <span>Descripción general</span>
      </header>

      <div className="teacher-course-editor__overview-body">
        <div className="teacher-course-editor__overview-intro">
          <div className="teacher-course-editor__about">
            <span className="teacher-course-editor__overview-label">Sobre este curso</span>
            <h2 id="descripcion-general">{title}</h2>

            {editando ? (
              <FormularioDescripcion
                courseId={courseId}
                descripcion={description}
                onCerrar={onCerrar}
              />
            ) : description ? (
              <div className="teacher-course-editor__description-copy">
                <p>{description}</p>
                {editable && (
                  <Boton variante="sutil" onClick={onEditar}>Editar descripción</Boton>
                )}
              </div>
            ) : (
              <button
                type="button"
                className="teacher-course-editor__description-empty"
                onClick={onEditar}
                disabled={!editable}
              >
                <span>+ Añadir descripción general</span>
                <small>Explica de qué trata el curso y qué encontrará el estudiante.</small>
              </button>
            )}
          </div>

          <aside className="teacher-course-editor__purpose">
            <span>Propósito</span>
            <p>{description || 'El propósito aparecerá cuando redactes la descripción general.'}</p>
          </aside>
        </div>

        <section className="teacher-course-editor__learning" aria-labelledby="aprendizajes-editor">
          <h3 id="aprendizajes-editor"><span aria-hidden="true" /> Lo que aprenderás</h3>
          {modules.length > 0 ? (
            <ul>
              {modules.slice(0, 4).map((modulo) => (
                <li key={modulo.id}>
                  <span aria-hidden="true" />
                  Profundizar en {modulo.title.toLocaleLowerCase('es')} mediante sus contenidos.
                </li>
              ))}
            </ul>
          ) : (
            <p>Los aprendizajes se construirán a medida que añadas módulos al curso.</p>
          )}
        </section>

        <dl className="teacher-course-editor__metrics">
          <DatoCurso etiqueta="Módulos" valor={String(modules.length)} />
          <DatoCurso etiqueta="Lecciones" valor={String(totalContenidos)} />
          <DatoCurso etiqueta="Duración estimada" valor="A tu ritmo" />
          <DatoCurso etiqueta="Vista previa" valor="0%" />
        </dl>

        <section className="teacher-course-editor__journey" aria-labelledby="recorrido-editor">
          <h3 id="recorrido-editor">Tu recorrido</h3>
          {modules.length > 0 ? (
            <ol>
              {modules.map((modulo, indice) => (
                <li key={modulo.id}>
                  <span>{String(indice + 1).padStart(2, '0')}</span>
                  <strong>{modulo.title}</strong>
                  <small>{modulo.lessons.length} lec.</small>
                </li>
              ))}
            </ol>
          ) : editable ? (
            <button type="button" onClick={onCrearModulo} className="teacher-course-editor__journey-empty">
              + Añadir el primer módulo al recorrido
            </button>
          ) : (
            <p className="teacher-course-editor__muted">Este curso aún no tiene módulos.</p>
          )}
        </section>
      </div>
    </section>
  )
}

function DatoCurso({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <dt>{etiqueta}</dt>
      <dd>{valor}</dd>
    </div>
  )
}

function ModuloDelCanvas({
  modulo,
  leccionActivaId,
  editable,
  onSeleccionar,
  onAgregar,
}: {
  modulo: CourseModule
  leccionActivaId: string | null
  editable: boolean
  onSeleccionar: (id: string) => void
  onAgregar: () => void
}) {
  return (
    <section className="teacher-course-editor__module">
      <header>
        <span>
          <strong>{modulo.title}</strong>
          <small>0 / {modulo.lessons.length}</small>
        </span>
        <Chevron />
      </header>
      <ol>
        {modulo.lessons.map((leccion) => (
          <li key={leccion.id}>
            <button
              type="button"
              className={leccion.id === leccionActivaId ? 'is-active' : undefined}
              onClick={() => onSeleccionar(leccion.id)}
              aria-current={leccion.id === leccionActivaId ? 'true' : undefined}
            >
              <span className="teacher-course-editor__lesson-check" aria-hidden="true" />
              <span className="teacher-course-editor__lesson-icon" aria-hidden="true">
                {leccion.type === 'VIDEO' ? '▻' : leccion.type === 'EXAM' ? '☑' : '▤'}
              </span>
              <span>{leccion.title}</span>
            </button>
          </li>
        ))}
      </ol>
      {editable && (
        <button type="button" onClick={onAgregar} className="teacher-course-editor__add-content">
          + Añadir contenido
        </button>
      )}
    </section>
  )
}

function Chevron() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="m3.5 9.5 4.5-4 4.5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function FormularioModulo({ courseId, onHecho }: { courseId: string; onHecho: () => void }) {
  const add = useAddModule(courseId)
  const [title, setTitle] = useState('')

  const enviar = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!title.trim()) return
    add.mutate(title.trim(), { onSuccess: onHecho })
  }

  return (
    <form onSubmit={enviar} className="teacher-course-editor__modal-form">
      <Field label="Título del módulo" htmlFor="titulo-modulo">
        <Input
          id="titulo-modulo"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Ej. El llamado"
        />
      </Field>
      {add.isError && <ErrorFormulario>No se pudo añadir el módulo.</ErrorFormulario>}
      <div className="teacher-course-editor__form-actions">
        <Boton type="submit" variante="formulario" disabled={add.isPending || !title.trim()}>
          {add.isPending ? 'Añadiendo…' : 'Añadir módulo'}
        </Boton>
      </div>
    </form>
  )
}

function FormularioContenido({
  courseId,
  moduleId,
  onHecho,
}: {
  courseId: string
  moduleId: string
  onHecho: () => void
}) {
  const add = useAddLesson(courseId)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  const enviar = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!title.trim() || !content.trim()) return
    add.mutate(
      { moduleId, title: title.trim(), content: content.trim() },
      { onSuccess: onHecho },
    )
  }

  return (
    <form onSubmit={enviar} className="teacher-course-editor__modal-form">
      <div className="teacher-course-editor__content-type">
        <span aria-hidden="true">▤</span>
        <div>
          <strong>Lectura</strong>
          <small>Contenido de texto para el estudiante</small>
        </div>
      </div>
      <Field label="Título del contenido" htmlFor="titulo-contenido">
        <Input
          id="titulo-contenido"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Ej. Entrad por la puerta angosta"
        />
      </Field>
      <Field label="Texto de la lectura" htmlFor="texto-contenido">
        <Textarea
          id="texto-contenido"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={7}
          placeholder="Escribe aquí el contenido que leerá el estudiante"
        />
      </Field>
      {add.isError && <ErrorFormulario>No se pudo añadir el contenido.</ErrorFormulario>}
      <div className="teacher-course-editor__form-actions">
        <Boton
          type="submit"
          variante="formulario"
          disabled={add.isPending || !title.trim() || !content.trim()}
        >
          {add.isPending ? 'Guardando…' : 'Guardar contenido'}
        </Boton>
      </div>
    </form>
  )
}

function FormularioDescripcion({
  courseId,
  descripcion,
  onCerrar,
}: {
  courseId: string
  descripcion: string
  onCerrar: () => void
}) {
  const actualizar = useUpdateCourse(courseId)
  const [valor, setValor] = useState(descripcion)

  const enviar = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    actualizar.mutate(
      { description: valor.trim() || null },
      { onSuccess: onCerrar },
    )
  }

  return (
    <form onSubmit={enviar} className="teacher-course-editor__description-form">
      <Textarea
        value={valor}
        onChange={(event) => setValor(event.target.value)}
        rows={5}
        aria-label="Descripción general del curso"
        placeholder="Explica qué aprenderá el estudiante y cuál será el recorrido."
        autoFocus
      />
      <div className="teacher-course-editor__form-actions">
        <Boton variante="sutil" onClick={onCerrar}>Cancelar</Boton>
        <Boton type="submit" variante="formulario" disabled={actualizar.isPending}>
          {actualizar.isPending ? 'Guardando…' : 'Guardar descripción'}
        </Boton>
      </div>
      {actualizar.isError && <ErrorFormulario>No se pudo actualizar la descripción.</ErrorFormulario>}
    </form>
  )
}

function AccionesDeEstado({ courseId, status }: { courseId: string; status: CourseStatus }) {
  const { submit, publish, backToDraft } = useCourseAction(courseId)
  const err = submit.error ?? publish.error ?? backToDraft.error

  return (
    <div className="teacher-course-editor__status-actions">
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
      {status === 'SUBMITTED' && <p>Enviado. Esperando la revisión del administrador.</p>}
      {status === 'UNDER_REVIEW' && <p>Un administrador está revisando este curso.</p>}
      {status === 'PUBLISHED' && <p>Publicado y visible en el catálogo.</p>}
      {err instanceof Error && <ErrorFormulario>{err.message}</ErrorFormulario>}
    </div>
  )
}

function NotasDeRechazo({ courseId, status }: { courseId: string; status: CourseStatus }) {
  const { data: reviews } = useCourseReviews(courseId, status === 'REJECTED')
  const rechazo = reviews?.find((review) => review.decision === 'REJECTED')
  if (status !== 'REJECTED' || !rechazo) return null
  return (
    <div className="teacher-course-editor__rejection">
      <strong>Correcciones solicitadas por {rechazo.reviewerName}</strong>
      <p>{rechazo.notes}</p>
    </div>
  )
}

function ErrorFormulario({ children }: { children: string }) {
  return <p role="alert" className="teacher-course-editor__error">{children}</p>
}

const Estado = ({ children }: { children: string }) => (
  <p className="py-aire-l text-center font-mono text-body text-texto-tenue">{children}</p>
)
