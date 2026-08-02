import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Boton, Field, Input, Modal, Select, Textarea } from '@elcamino/ui'
import { subirMedioReanudable, leerDuracionVideo, encolarProcesado } from '../../lib/media-upload'
import { subirImagenPublica } from '../../lib/image-upload'
import { GaleriaImagenes, parseGaleria } from './galeria-imagenes'
import { EditorLectura } from '../../components/editor-lectura'
import { IconoLeccion } from './lesson-icon'
import type { CourseStatus } from '@elcamino/shared-types'
import type { CourseModule, Lesson } from './api'
import {
  useStudentView,
  useAddModule,
  useAddLesson,
  useCourseReviews,
  useUpdateCourse,
  useCourseAction,
  usePublishWithKey,
  useObservations,
  useModerationLog,
  type ModerationAction,
  type Observation,
  type ObservationResource,
} from './authoring-api'
import { MarcaModeracion } from './marca-moderacion'
import { ApiError } from '../../lib/api-client'
import './editor-curso.css'

/** Plantilla de autoría que conserva la misma composición de la vista del estudiante. */
export function EditorCursoPage() {
  const { id = '' } = useParams()
  const { data: curso, isPending, error } = useStudentView(id)
  const [modalModulo, setModalModulo] = useState(false)
  const [modalEnviar, setModalEnviar] = useState(false)
  // El panel «Añadir contenido» vive en la URL (?contenido=<moduleId>): así el
  // breadcrumb del layout muestra la miga «Contenido» y navega de vuelta.
  const [searchParams, setSearchParams] = useSearchParams()
  const abrirContenido = (moduleId: string) => setSearchParams({ contenido: moduleId })
  const cerrarContenido = () => setSearchParams({})
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

  const contenidoId = searchParams.get('contenido')
  const moduloParaContenido = contenidoId
    ? (curso.modules.find((modulo) => modulo.id === contenidoId) ?? null)
    : null

  return (
    <section className="teacher-course-editor">
      <NotasDeRechazo courseId={id} status={curso.status} />
      <IndicacionesDeRevision courseId={id} lecciones={lecciones} />
      <EstadoDeModeracion courseId={id} blocked={curso.blocked} lecciones={lecciones} />

      {moduloParaContenido ? (
        // Vista de «Añadir contenido» a pantalla completa: ocupa todo el canvas,
        // sin la columna del índice, en vez de un modal o media pantalla.
        <PanelContenido
          courseId={id}
          modulo={moduloParaContenido}
          onHecho={cerrarContenido}
          onCancelar={cerrarContenido}
        />
      ) : (
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
              learningObjectives={curso.learningObjectives}
              purpose={curso.purpose}
              coverImageUrl={curso.coverImageUrl}
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
                  onAgregar={() => abrirContenido(modulo.id)}
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
              <footer className="teacher-course-editor__outline-footer flex flex-col gap-aire-xs">
                <Boton variante="formulario" onClick={() => setModalModulo(true)} className="w-full">
                  + Añadir módulo
                </Boton>
                <Boton variante="formulario" onClick={() => setModalEnviar(true)} className="w-full">
                  Enviar a revisión
                </Boton>
              </footer>
            )}
          </aside>
        </div>
      )}

      <Modal
        abierto={modalModulo}
        onCerrar={() => setModalModulo(false)}
        titulo="Añadir módulo"
        descripcion="Crea una nueva etapa dentro del recorrido del curso."
      >
        <FormularioModulo courseId={id} onHecho={() => setModalModulo(false)} />
      </Modal>

      <ModalEnviarRevision
        courseId={id}
        abierto={modalEnviar}
        onCerrar={() => setModalEnviar(false)}
      />
    </section>
  )
}

/**
 * Modal de envío: publicar directamente con una llave del admin, o enviar a
 * revisión con normalidad si no se tiene código.
 */
function ModalEnviarRevision({
  courseId,
  abierto,
  onCerrar,
}: {
  courseId: string
  abierto: boolean
  onCerrar: () => void
}) {
  const publicarConLlave = usePublishWithKey(courseId)
  const { submit } = useCourseAction(courseId)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  const mensaje = (e: unknown, fallback: string) =>
    setError(e instanceof ApiError ? e.message : fallback)

  const conCodigo = () => {
    setError(null)
    publicarConLlave.mutate(code.trim(), {
      onSuccess: onCerrar,
      onError: (e) => mensaje(e, 'No se pudo publicar con el código.'),
    })
  }
  const aRevision = () => {
    setError(null)
    submit.mutate(undefined, {
      onSuccess: onCerrar,
      onError: (e) => mensaje(e, 'No se pudo enviar a revisión.'),
    })
  }

  const ocupado = publicarConLlave.isPending || submit.isPending

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Enviar a revisión"
      descripcion="Publica tu curso para que los estudiantes lo vean."
    >
      <div className="flex flex-col gap-aire-m">
        <div className="flex flex-col gap-aire-s">
          <Field
            label="¿Tienes un código de publicación?"
            htmlFor="codigo-publicacion"
            hint="Un código del administrador publica tu curso al instante, sin revisión."
          >
            <Input
              id="codigo-publicacion"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="XXXX-XXXX-XXXX"
              autoComplete="off"
              disabled={ocupado}
            />
          </Field>
          <Boton
            variante="formulario"
            onClick={conCodigo}
            disabled={!code.trim() || ocupado}
            className="self-start"
          >
            {publicarConLlave.isPending ? 'Publicando…' : 'Publicar con código'}
          </Boton>
        </div>

        <div className="flex flex-col gap-aire-s border-t border-linea pt-aire-m">
          <p className="m-0 font-mono text-body-s text-texto-tenue">
            ¿No tienes código? Envíalo a revisión y un administrador lo aprobará.
          </p>
          <Boton
            variante="contorno"
            onClick={aRevision}
            disabled={ocupado}
            className="self-start"
          >
            {submit.isPending ? 'Enviando…' : 'Enviar a revisión'}
          </Boton>
        </div>

        {error && <ErrorFormulario>{error}</ErrorFormulario>}
      </div>
    </Modal>
  )
}

/**
 * Vista de «Añadir contenido» dentro del área principal (no un modal): ocupa el
 * lienzo, con su cabecera y un botón para volver al editor.
 */
function PanelContenido({
  courseId,
  modulo,
  onHecho,
  onCancelar,
}: {
  courseId: string
  modulo: CourseModule
  onHecho: () => void
  onCancelar: () => void
}) {
  return (
    <section className="teacher-course-editor__lesson-stage" aria-label="Añadir contenido">
      <div className="teacher-course-editor__content-form">
        <div className="mb-aire-m flex flex-col gap-aire-xs">
          <span className="teacher-course-editor__eyebrow">Nuevo contenido</span>
          <h1 className="m-0 font-mono text-h-m font-normal text-contenido">Añadir contenido</h1>
          <p className="m-0 font-mono text-body-s text-texto-tenue">
            Este contenido se agregará a «{modulo.title}».
          </p>
        </div>

        <FormularioContenido
          courseId={courseId}
          moduleId={modulo.id}
          onHecho={onHecho}
          onCancelar={onCancelar}
        />
      </div>
    </section>
  )
}

export function VistaDeLeccion({
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
            {leccion.type === 'VIDEO'
              ? 'Video'
              : leccion.type === 'EXAM'
                ? 'Evaluación'
                : leccion.type === 'IMAGE'
                  ? 'Imágenes'
                  : 'Lectura'}
          </span>
          <h1>{leccion.title}</h1>
          <div className="teacher-course-editor__rule" />
          {leccion.type === 'TEXT' ? (
            leccion.content ? (
              <EditorLectura value={leccion.content} editable={false} />
            ) : (
              <p className="teacher-course-editor__lesson-copy">
                Este contenido todavía no tiene texto.
              </p>
            )
          ) : leccion.type === 'IMAGE' ? (
            <GaleriaImagenes urls={parseGaleria(leccion.content)} />
          ) : leccion.type === 'VIDEO' ? (
            leccion.videoUrl ? (
              <video
                key={leccion.id}
                controls
                preload="metadata"
                className="w-full rounded bg-negro"
                src={leccion.videoUrl}
              />
            ) : (
              <div className="teacher-course-editor__media-placeholder">
                <span aria-hidden="true">▷</span>
                <p>El video se está procesando. Podrás reproducirlo aquí en unos momentos.</p>
              </div>
            )
          ) : leccion.questions && leccion.questions.length > 0 ? (
            <ol className="m-0 flex list-none flex-col gap-aire-m p-0">
              {leccion.questions.map((pregunta, i) => (
                <li key={i} className="flex flex-col gap-aire-xs">
                  <strong className="font-mono text-body text-contenido">
                    {i + 1}. {pregunta.enunciado}
                  </strong>
                  <ul className="m-0 flex list-none flex-col gap-1 p-0">
                    {pregunta.opciones.map((opcion, j) => (
                      <li
                        key={j}
                        className={`flex items-center gap-aire-xs font-ui text-body-s ${
                          pregunta.correcta === j ? 'text-exito' : 'text-texto-tenue'
                        }`}
                      >
                        <span aria-hidden="true">{pregunta.correcta === j ? '✓' : '○'}</span>
                        {opcion}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          ) : (
            <div className="teacher-course-editor__media-placeholder">
              <span aria-hidden="true">☑</span>
              <p>La evaluación aparecerá aquí.</p>
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
  learningObjectives,
  purpose,
  coverImageUrl,
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
  learningObjectives: string[]
  purpose: string | null
  coverImageUrl: string | null
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
        <PortadaEditor courseId={courseId} coverImageUrl={coverImageUrl} editable={editable} />

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
              <div className="flex flex-col items-start gap-aire-s">
                <p className="m-0 font-mono text-body-s text-texto-tenue">
                  Explica de qué trata el curso y qué encontrará el estudiante.
                </p>
                <Boton variante="formulario" onClick={onEditar} disabled={!editable}>
                  + Añadir descripción general
                </Boton>
              </div>
            )}
          </div>

          <aside className="teacher-course-editor__purpose">
            <span>Propósito</span>
            <PropositoEditor courseId={courseId} proposito={purpose} editable={editable} />
          </aside>
        </div>

        <AprendizajesEditor courseId={courseId} objetivos={learningObjectives} editable={editable} />

        <dl className="teacher-course-editor__metrics">
          <DatoCurso etiqueta="Módulos" valor={String(modules.length)} />
          <DatoCurso etiqueta="Lecciones" valor={String(totalContenidos)} />
          <DatoCurso etiqueta="Duración estimada" valor="A tu ritmo" />
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

/** Imagen de portada del curso: la sube el maestro (bucket público). */
function PortadaEditor({
  courseId,
  coverImageUrl,
  editable,
}: {
  courseId: string
  coverImageUrl: string | null
  editable: boolean
}) {
  const actualizar = useUpdateCourse(courseId)
  const [subiendo, setSubiendo] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const elegir = async (e: FormEvent<HTMLInputElement>) => {
    const el = e.currentTarget
    const file = el.files?.[0]
    el.value = ''
    if (!file) return
    setSubiendo(true)
    try {
      const url = await subirImagenPublica(file)
      actualizar.mutate({ coverImageUrl: url })
    } catch {
      // subida fallida: la interfaz sigue usable
    } finally {
      setSubiendo(false)
    }
  }

  const ocupado = subiendo || actualizar.isPending

  return (
    <div className="mb-aire-m flex flex-col gap-aire-s">
      <span className="teacher-course-editor__overview-label">Portada</span>
      <div className="relative aspect-[16/6] w-full overflow-hidden rounded bg-superficie-2">
        {coverImageUrl ? (
          <img src={coverImageUrl} alt="Portada del curso" className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center font-mono text-body-s text-texto-tenue">
            Sin portada
          </div>
        )}
      </div>
      {editable && (
        <>
          <input
            ref={input}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={elegir}
          />
          <div className="flex flex-wrap gap-aire-s">
            <Boton variante="contorno" onClick={() => input.current?.click()} disabled={ocupado}>
              {ocupado ? 'Subiendo…' : coverImageUrl ? 'Cambiar portada' : '+ Añadir portada'}
            </Boton>
            {coverImageUrl && (
              <Boton
                variante="sutil"
                onClick={() => actualizar.mutate({ coverImageUrl: null })}
                disabled={ocupado}
              >
                Quitar
              </Boton>
            )}
          </div>
        </>
      )}
    </div>
  )
}

/** «Propósito» del curso, editable en línea por el maestro. */
function PropositoEditor({
  courseId,
  proposito,
  editable,
}: {
  courseId: string
  proposito: string | null
  editable: boolean
}) {
  const actualizar = useUpdateCourse(courseId)
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState(proposito ?? '')

  const guardar = () => {
    actualizar.mutate(
      { purpose: valor.trim() || null },
      { onSuccess: () => setEditando(false) },
    )
  }

  if (editando) {
    return (
      <div className="flex flex-col gap-aire-s">
        <Textarea
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          rows={4}
          autoFocus
          placeholder="¿Para qué es este curso? Qué busca lograr en el estudiante."
        />
        {/* Apilados y a ancho completo: mismo largo en esta columna estrecha. */}
        <div className="flex flex-col gap-aire-xs">
          <Boton
            variante="formulario"
            onClick={guardar}
            disabled={actualizar.isPending}
            className="w-full"
          >
            {actualizar.isPending ? 'Guardando…' : 'Guardar'}
          </Boton>
          <Boton variante="contorno" onClick={() => setEditando(false)} className="w-full">
            Cancelar
          </Boton>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-start gap-aire-s">
      <p className="m-0">{proposito || 'El propósito aparecerá cuando lo redactes.'}</p>
      {editable && (
        <Boton
          variante="formulario"
          onClick={() => {
            setValor(proposito ?? '')
            setEditando(true)
          }}
        >
          {proposito ? 'Editar propósito' : '+ Añadir propósito'}
        </Boton>
      )}
    </div>
  )
}

/** «Lo que aprenderás»: lista de objetivos que redacta el propio maestro. */
function AprendizajesEditor({
  courseId,
  objetivos,
  editable,
}: {
  courseId: string
  objetivos: string[]
  editable: boolean
}) {
  const actualizar = useUpdateCourse(courseId)
  const [nuevo, setNuevo] = useState('')

  const agregar = () => {
    const valor = nuevo.trim()
    if (!valor) return
    actualizar.mutate({ learningObjectives: [...objetivos, valor] })
    setNuevo('')
  }
  const quitar = (indice: number) =>
    actualizar.mutate({ learningObjectives: objetivos.filter((_, i) => i !== indice) })

  return (
    <section className="teacher-course-editor__learning" aria-labelledby="aprendizajes-editor">
      <h3 id="aprendizajes-editor">
        <span aria-hidden="true" /> Lo que aprenderás
      </h3>

      {objetivos.length > 0 ? (
        <ul>
          {objetivos.map((objetivo, indice) => (
            <li key={indice}>
              <span className="teacher-course-editor__bullet" aria-hidden="true" />
              <span className="teacher-course-editor__obj-text">{objetivo}</span>
              {editable && (
                <button
                  type="button"
                  aria-label={`Quitar «${objetivo}»`}
                  onClick={() => quitar(indice)}
                  className="teacher-course-editor__obj-quitar"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        !editable && <p>El maestro aún no ha añadido objetivos de aprendizaje.</p>
      )}

      {editable && (
        <div className="mt-aire-s flex items-center gap-aire-s">
          <Input
            value={nuevo}
            onChange={(e) => setNuevo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                agregar()
              }
            }}
            placeholder="Ej. Comprender qué significa entrar por la puerta angosta"
            disabled={actualizar.isPending}
          />
          <Boton
            variante="formulario"
            onClick={agregar}
            disabled={!nuevo.trim() || actualizar.isPending}
            className="shrink-0"
          >
            Añadir
          </Boton>
        </div>
      )}
    </section>
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
  const [abierto, setAbierto] = useState(true)

  return (
    <section className="teacher-course-editor__module">
      <button
        type="button"
        className="teacher-course-editor__module-header"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
      >
        <span>
          <strong>{modulo.title}</strong>
          <small>0 / {modulo.lessons.length}</small>
        </span>
        <Chevron abierto={abierto} />
      </button>

      <div
        className={`grid transition-[grid-template-rows] duration-[420ms] ease-camino ${
          abierto ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
        aria-hidden={!abierto}
      >
        <div className="min-h-0 overflow-hidden">
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
                  <IconoLeccion tipo={leccion.type} className="size-5 shrink-0" />
                  <span className="truncate">{leccion.title}</span>
                  <MarcaEnElIndice estado={leccion.moderationStatus} />
                </button>
              </li>
            ))}
          </ol>
          {editable && (
            <button type="button" onClick={onAgregar} className="teacher-course-editor__add-content">
              + Añadir contenido
            </button>
          )}
        </div>
      </div>
    </section>
  )
}

/**
 * Marca de moderación dentro del índice del canvas (HU-7.2). No usa el `Chip`
 * compartido a propósito: la fila se rellena de vino al pasar el cursor o al
 * estar activa, y esta marca hereda ese color con `currentColor` para no
 * volverse ilegible. Fuera del índice va `MarcaModeracion`.
 */
function MarcaEnElIndice({ estado }: { estado: Lesson['moderationStatus'] }) {
  if (!estado || estado === 'APPROVED') return null
  const bloqueado = estado === 'BLOCKED'
  return (
    <span
      className={`teacher-course-editor__lesson-flag${bloqueado ? ' is-blocked' : ''}`}
      title={
        bloqueado
          ? 'Bloqueado por moderación: corrígelo'
          : 'Pendiente de verificación del administrador'
      }
    >
      {bloqueado ? 'Bloqueado' : 'Pendiente'}
    </span>
  )
}

function Chevron({ abierto }: { abierto: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={`transition-transform duration-[420ms] ease-camino ${abierto ? '' : 'rotate-180'}`}
    >
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

interface PreguntaBorrador {
  enunciado: string
  opciones: string[]
  correcta: number
}

const nuevaPregunta = (): PreguntaBorrador => ({ enunciado: '', opciones: ['', ''], correcta: 0 })

/** Constructor de una evaluación: preguntas con opciones y su respuesta correcta. */
function ConstructorEvaluacion({
  value,
  onChange,
  disabled,
}: {
  value: PreguntaBorrador[]
  onChange: (p: PreguntaBorrador[]) => void
  disabled: boolean
}) {
  const editar = (i: number, cambio: Partial<PreguntaBorrador>) =>
    onChange(value.map((p, idx) => (idx === i ? { ...p, ...cambio } : p)))

  const editarOpcion = (i: number, j: number, texto: string) =>
    editar(i, { opciones: value[i]!.opciones.map((o, k) => (k === j ? texto : o)) })

  return (
    <div className="flex flex-col gap-aire-s">
      {value.map((pregunta, i) => (
        <div key={i} className="flex flex-col gap-aire-xs rounded border border-linea bg-superficie-1 p-aire-s">
          <div className="flex items-center justify-between gap-aire-s">
            <span className="font-mono text-eyebrow uppercase tracking-label text-texto-tenue">
              Pregunta {i + 1}
            </span>
            {value.length > 1 && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                className="font-mono text-body-s text-texto-tenue transition-colors hover:text-vino"
                aria-label={`Quitar pregunta ${i + 1}`}
              >
                ✕
              </button>
            )}
          </div>

          <Input
            value={pregunta.enunciado}
            onChange={(e) => editar(i, { enunciado: e.target.value })}
            placeholder="Enunciado de la pregunta"
            disabled={disabled}
          />

          <span className="font-mono text-eyebrow uppercase tracking-label text-texto-debil">
            Opciones (marca la correcta)
          </span>
          {pregunta.opciones.map((opcion, j) => (
            <div key={j} className="flex items-center gap-aire-xs">
              <input
                type="radio"
                name={`correcta-${i}`}
                checked={pregunta.correcta === j}
                onChange={() => editar(i, { correcta: j })}
                disabled={disabled}
                aria-label={`Marcar opción ${j + 1} como correcta`}
              />
              <Input
                value={opcion}
                onChange={(e) => editarOpcion(i, j, e.target.value)}
                placeholder={`Opción ${j + 1}`}
                disabled={disabled}
                className="flex-1"
              />
              {pregunta.opciones.length > 2 && (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    const opciones = pregunta.opciones.filter((_, k) => k !== j)
                    editar(i, {
                      opciones,
                      correcta: pregunta.correcta >= opciones.length ? 0 : pregunta.correcta,
                    })
                  }}
                  className="shrink-0 font-mono text-body-s text-texto-tenue transition-colors hover:text-vino"
                  aria-label={`Quitar opción ${j + 1}`}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          {pregunta.opciones.length < 6 && (
            <Boton
              variante="sutil"
              disabled={disabled}
              onClick={() => editar(i, { opciones: [...pregunta.opciones, ''] })}
              className="self-start"
            >
              + Añadir opción
            </Boton>
          )}
        </div>
      ))}

      <Boton
        variante="contorno"
        disabled={disabled}
        onClick={() => onChange([...value, nuevaPregunta()])}
        className="self-start"
      >
        + Añadir pregunta
      </Boton>
    </div>
  )
}

/** Sube y ordena las imágenes de una galería (lección IMAGE). */
function GaleriaUploader({
  imagenes,
  onChange,
  subiendo,
  onSubiendo,
  disabled,
}: {
  imagenes: string[]
  onChange: (urls: string[]) => void
  subiendo: boolean
  onSubiendo: (v: boolean) => void
  disabled: boolean
}) {
  const elegir = async (e: FormEvent<HTMLInputElement>) => {
    const input = e.currentTarget
    const files = Array.from(input.files ?? [])
    input.value = ''
    if (files.length === 0) return
    onSubiendo(true)
    try {
      const urls: string[] = []
      for (const file of files) urls.push(await subirImagenPublica(file))
      onChange([...imagenes, ...urls])
    } catch {
      // Alguna subida falló (permiso/tamaño); las ya añadidas se conservan.
    } finally {
      onSubiendo(false)
    }
  }

  const ocupado = subiendo || disabled

  return (
    <div className="flex flex-col gap-aire-s">
      {imagenes.length > 0 && (
        <ul className="m-0 grid list-none grid-cols-3 gap-aire-xs p-0 cine:grid-cols-4">
          {imagenes.map((url, i) => (
            <li key={i} className="relative">
              <img
                src={url}
                alt={`Imagen ${i + 1}`}
                className="aspect-square w-full rounded object-cover"
              />
              <button
                type="button"
                aria-label={`Quitar imagen ${i + 1}`}
                disabled={ocupado}
                onClick={() => onChange(imagenes.filter((_, idx) => idx !== i))}
                className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-negro/70 font-mono text-body-s text-hueso transition-colors hover:bg-vino"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <label className="inline-flex w-fit cursor-pointer items-center gap-aire-xs rounded border border-linea bg-superficie-2 px-aire-s py-aire-xs font-mono text-eyebrow uppercase tracking-label text-contenido transition-colors hover:border-vino">
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          hidden
          disabled={ocupado}
          onChange={elegir}
        />
        {subiendo ? 'Subiendo…' : imagenes.length > 0 ? '+ Añadir más' : '+ Subir imágenes'}
      </label>
    </div>
  )
}

type TipoContenido = 'TEXT' | 'VIDEO' | 'EXAM' | 'IMAGE'

const TIPOS_CONTENIDO: {
  value: TipoContenido
  label: string
  descripcion: string
  proximamente?: boolean
}[] = [
  { value: 'TEXT', label: 'Lectura', descripcion: 'Contenido de texto para el estudiante' },
  { value: 'VIDEO', label: 'Video', descripcion: 'Un video que el estudiante podrá reproducir' },
  { value: 'IMAGE', label: 'Imágenes', descripcion: 'Una galería de imágenes para el estudiante' },
  {
    value: 'EXAM',
    label: 'Evaluación',
    descripcion: 'Preguntas de selección única para evaluar al estudiante',
  },
]

function FormularioContenido({
  courseId,
  moduleId,
  onHecho,
  onCancelar,
}: {
  courseId: string
  moduleId: string
  onHecho: () => void
  onCancelar: () => void
}) {
  const add = useAddLesson(courseId)
  const [tipo, setTipo] = useState<TipoContenido>('TEXT')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [imagenes, setImagenes] = useState<string[]>([])
  const [subiendoImg, setSubiendoImg] = useState(false)
  const [preguntas, setPreguntas] = useState<PreguntaBorrador[]>([nuevaPregunta()])
  const [pct, setPct] = useState(0)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const descripcion = TIPOS_CONTENIDO.find((t) => t.value === tipo)?.descripcion ?? ''
  const ocupado = add.isPending || subiendo || subiendoImg

  const examenValido =
    preguntas.length > 0 &&
    preguntas.every(
      (p) =>
        p.enunciado.trim() &&
        p.opciones.filter((o) => o.trim()).length >= 2 &&
        p.opciones[p.correcta]?.trim(),
    )

  const valido =
    Boolean(title.trim()) &&
    (tipo === 'TEXT'
      ? Boolean(content.trim())
      : tipo === 'VIDEO'
        ? Boolean(file)
        : tipo === 'IMAGE'
          ? imagenes.length > 0
          : examenValido)

  const enviar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    if (!valido || ocupado) return

    if (tipo === 'TEXT') {
      add.mutate(
        { moduleId, title: title.trim(), type: 'TEXT', content: content.trim() },
        { onSuccess: onHecho, onError: () => setError('No se pudo añadir el contenido.') },
      )
      return
    }

    if (tipo === 'IMAGE') {
      add.mutate(
        { moduleId, title: title.trim(), type: 'IMAGE', content: JSON.stringify(imagenes) },
        { onSuccess: onHecho, onError: () => setError('No se pudo crear la galería.') },
      )
      return
    }

    if (tipo === 'EXAM') {
      // Normaliza: quita opciones vacías y reubica el índice correcto.
      const limpias = preguntas.map((p) => {
        const opciones = p.opciones.map((o) => o.trim()).filter(Boolean)
        const textoCorrecto = p.opciones[p.correcta]?.trim() ?? ''
        return {
          enunciado: p.enunciado.trim(),
          opciones,
          correcta: Math.max(0, opciones.indexOf(textoCorrecto)),
        }
      })
      add.mutate(
        { moduleId, title: title.trim(), type: 'EXAM', questions: limpias },
        { onSuccess: onHecho, onError: () => setError('No se pudo crear la evaluación.') },
      )
      return
    }

    // VIDEO: se sube el archivo al enviar y luego se crea la lección con su medio.
    if (tipo === 'VIDEO' && file) {
      try {
        setSubiendo(true)
        setPct(0)
        const duracion = await leerDuracionVideo(file)
        // Sin bloquear en el procesado: si la cola está caída, no perdemos el video.
        const assetId = await subirMedioReanudable(file, 'VIDEO', 'course-media', setPct, {
          procesar: false,
        })
        add.mutate(
          { moduleId, title: title.trim(), type: 'VIDEO', mediaAssetId: assetId, durationSeconds: duracion },
          {
            onSuccess: () => {
              void encolarProcesado(assetId) // transcodificación en segundo plano
              onHecho()
            },
            onError: () => setError('El video se subió, pero no se pudo guardar la lección.'),
          },
        )
      } catch {
        setError('No se pudo subir el video. Revisa el archivo e inténtalo de nuevo.')
      } finally {
        setSubiendo(false)
      }
    }
  }

  return (
    <form onSubmit={enviar} className="teacher-course-editor__modal-form">
      <Field label="Tipo de contenido" htmlFor="tipo-contenido" hint={descripcion}>
        <Select
          id="tipo-contenido"
          value={tipo}
          disabled={ocupado}
          onChange={(event) => setTipo(event.target.value as TipoContenido)}
        >
          {TIPOS_CONTENIDO.map((t) => (
            <option key={t.value} value={t.value} disabled={t.proximamente}>
              {t.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Título del contenido" htmlFor="titulo-contenido">
        <Input
          id="titulo-contenido"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Ej. Entrad por la puerta angosta"
          disabled={ocupado}
        />
      </Field>

      {tipo === 'TEXT' && (
        <Field label="Texto de la lectura">
          <EditorLectura value={content} onChange={setContent} editable={!ocupado} />
        </Field>
      )}

      {tipo === 'VIDEO' && (
        <Field
          label="Archivo de video"
          htmlFor="video-contenido"
          hint="MP4 o MOV. Se subirá al guardar y quedará disponible tras la aprobación del curso."
        >
          <input
            id="video-contenido"
            type="file"
            accept="video/mp4,video/quicktime"
            disabled={ocupado}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="w-full font-mono text-body-s text-texto-tenue file:mr-aire-s file:cursor-pointer file:rounded file:border file:border-linea file:bg-superficie-2 file:px-aire-s file:py-aire-xs file:font-mono file:text-eyebrow file:uppercase file:tracking-label file:text-contenido hover:file:border-vino"
          />
        </Field>
      )}

      {tipo === 'IMAGE' && (
        <Field
          label="Imágenes de la galería"
          hint="PNG, JPG o WebP (máx. 5 MB cada una). El estudiante las verá en orden."
        >
          <GaleriaUploader
            imagenes={imagenes}
            onChange={setImagenes}
            subiendo={subiendoImg}
            onSubiendo={setSubiendoImg}
            disabled={add.isPending}
          />
        </Field>
      )}

      {tipo === 'EXAM' && (
        <Field label="Preguntas de la evaluación">
          <ConstructorEvaluacion value={preguntas} onChange={setPreguntas} disabled={ocupado} />
        </Field>
      )}

      {subiendo && (
        <div className="flex flex-col gap-aire-xs" aria-live="polite">
          <div className="h-1 w-full overflow-hidden rounded bg-superficie-2">
            <div
              className="h-full bg-vino transition-[width] duration-fade ease-camino"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="font-mono text-eyebrow uppercase tracking-label text-texto-tenue">
            Subiendo video… {pct}%
          </span>
        </div>
      )}

      {error && <ErrorFormulario>{error}</ErrorFormulario>}

      <div className="teacher-course-editor__form-actions">
        <Boton type="button" variante="contorno" onClick={onCancelar} disabled={ocupado}>
          Cancelar
        </Boton>
        <Boton type="submit" variante="formulario" disabled={!valido || ocupado}>
          {subiendo ? `Subiendo… ${pct}%` : add.isPending ? 'Guardando…' : 'Guardar contenido'}
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
        <Boton variante="contorno" onClick={onCerrar}>Cancelar</Boton>
        <Boton type="submit" variante="formulario" disabled={actualizar.isPending}>
          {actualizar.isPending ? 'Guardando…' : 'Guardar'}
        </Boton>
      </div>
      {actualizar.isError && <ErrorFormulario>No se pudo actualizar la descripción.</ErrorFormulario>}
    </form>
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

const ETIQUETA_RECURSO: Record<ObservationResource, string> = {
  COVER: 'Portada',
  DESCRIPTION: 'Descripción general',
  PURPOSE: 'Propósito',
  OBJECTIVES: 'Lo que aprenderás',
  MODULE: 'Módulo',
  LESSON: 'Contenido',
  COURSE: 'Curso',
}

/**
 * Indicaciones de cambio que el admin dejó en la revisión, agrupadas por recurso.
 * El profesor las ve en su editor para saber qué corregir (HU-5.2).
 */
function IndicacionesDeRevision({
  courseId,
  lecciones,
}: {
  courseId: string
  lecciones: Lesson[]
}) {
  const { data: observaciones } = useObservations(courseId)
  const obs = observaciones ?? []
  if (obs.length === 0) return null

  const nombreRecurso = (o: Observation) => {
    if (o.resourceType === 'LESSON' && o.resourceId) {
      const l = lecciones.find((x) => x.id === o.resourceId)
      return l ? `Contenido · ${l.title}` : 'Contenido'
    }
    return ETIQUETA_RECURSO[o.resourceType]
  }

  return (
    <div className="teacher-course-editor__rejection">
      <strong>Indicaciones de la revisión ({obs.length})</strong>
      <ul className="m-0 mt-aire-xs flex list-none flex-col gap-aire-xs p-0">
        {obs.map((o) => (
          <li key={o.id} className="flex flex-col gap-[0.1rem]">
            <span className="font-mono text-eyebrow uppercase tracking-label text-vino">
              {nombreRecurso(o)}
            </span>
            <span className="font-ui text-body-s text-contenido">{o.note}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Estado de moderación del curso publicado (HU-7.2). El profesor necesita saber
 * qué contenido no ve el alumno todavía: lo nuevo espera verificación y lo
 * bloqueado hay que corregirlo.
 */
function EstadoDeModeracion({
  courseId,
  blocked,
  lecciones,
}: {
  courseId: string
  blocked: boolean
  lecciones: Lesson[]
}) {
  const pendientes = lecciones.filter((l) => l.moderationStatus === 'PENDING')
  const bloqueadas = lecciones.filter((l) => l.moderationStatus === 'BLOCKED')
  if (!blocked && pendientes.length === 0 && bloqueadas.length === 0) return null

  return (
    <div className="teacher-course-editor__rejection">
      <strong>
        {blocked ? 'El administrador bloqueó este curso' : 'Contenido en revisión de moderación'}
      </strong>
      <p>
        {blocked
          ? 'Los estudiantes no pueden acceder al curso mientras esté bloqueado. Corrige lo señalado y avisa al administrador.'
          : 'Lo que añadas o cambies en un curso publicado lo verifica el administrador antes de que lo vean los estudiantes.'}
      </p>
      {(pendientes.length > 0 || bloqueadas.length > 0) && (
        <ul className="m-0 mt-aire-xs flex list-none flex-col gap-aire-xs p-0">
          {bloqueadas.map((l) => (
            <ContenidoModerado key={l.id} leccion={l} estado="BLOCKED" />
          ))}
          {pendientes.map((l) => (
            <ContenidoModerado key={l.id} leccion={l} estado="PENDING" />
          ))}
        </ul>
      )}

      <BitacoraDelMaestro courseId={courseId} />
    </div>
  )
}

function ContenidoModerado({
  leccion,
  estado,
}: {
  leccion: Lesson
  estado: 'PENDING' | 'BLOCKED'
}) {
  return (
    <li className="flex flex-wrap items-center gap-aire-xs font-ui text-body-s text-contenido">
      <MarcaModeracion estado={estado} tamano="mini" />
      <span>{leccion.title}</span>
      <span className="text-texto-tenue">
        {estado === 'BLOCKED'
          ? '— corrígelo para que vuelva a publicarse.'
          : '— esperando verificación del administrador.'}
      </span>
    </li>
  )
}

const FORMATO_FECHA_MODERACION = new Intl.DateTimeFormat('es-PE', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

const ACCION_MODERACION: Record<ModerationAction, string> = {
  LESSON_APPROVED: 'Aprobó un contenido',
  LESSON_PENDING: 'Devolvió un contenido a pendiente',
  LESSON_BLOCKED: 'Bloqueó un contenido',
  COURSE_BLOCKED: 'Bloqueó el curso',
  COURSE_UNBLOCKED: 'Reactivó el curso',
}

/**
 * Qué decidió el administrador y cuándo (HU-7.2). El maestro dueño lee la misma
 * bitácora que el admin: sin esto, un bloqueo sería un mensaje sin remitente.
 */
function BitacoraDelMaestro({ courseId }: { courseId: string }) {
  const { data: entradas } = useModerationLog(courseId)
  if (!entradas || entradas.length === 0) return null

  return (
    <details className="mt-aire-xs">
      <summary className="w-fit cursor-pointer font-mono text-eyebrow uppercase tracking-label text-texto-tenue hover:text-vino">
        Decisiones del administrador ({entradas.length})
      </summary>
      <ol className="m-0 mt-aire-xs flex list-none flex-col gap-aire-xs p-0">
        {entradas.map((e) => (
          <li key={e.id} className="flex flex-wrap items-baseline gap-aire-xs font-ui text-body-s text-texto-tenue">
            <span className="text-contenido">{ACCION_MODERACION[e.action]}</span>
            {e.lessonTitle && <span className="font-mono">«{e.lessonTitle}»</span>}
            <span>· {FORMATO_FECHA_MODERACION.format(new Date(e.createdAt))}</span>
          </li>
        ))}
      </ol>
    </details>
  )
}

function ErrorFormulario({ children }: { children: string }) {
  return <p role="alert" className="teacher-course-editor__error">{children}</p>
}

const Estado = ({ children }: { children: string }) => (
  <p className="py-aire-l text-center font-mono text-body text-texto-tenue">{children}</p>
)
