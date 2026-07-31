import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { useParams } from 'react-router-dom'
import { Boton, Eyebrow } from '@elcamino/ui'
import { ApiError } from '../../lib/api-client'
import { EditorLectura } from '../../components/editor-lectura'
import { IconoLeccion } from './lesson-icon'
import { GaleriaImagenes, parseGaleria } from './galeria-imagenes'
import {
  useCourse,
  useEnroll,
  useCompleteLesson,
  useGradeExam,
  type ResultadoExamen,
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
  if (!curso.enrolled) return <NoInscrito curso={curso} />

  return <Contenido curso={curso} slug={slug} />
}

function Contenido({ curso, slug }: { curso: CourseDetail; slug: string }) {
  const modulosVisuales = curso.modules
  const lecciones = modulosVisuales.flatMap((m) => m.lessons)
  const completadas = new Set(curso.completedLessonIds)
  const duracionTotal = lecciones.reduce((total, leccion) => total + (leccion.durationSeconds ?? 0), 0)
  const objetivosAprendizaje = construirObjetivos(curso)

  // Lección activa. `null` = "aún no elegida": se resuelve a la primera
  // pendiente al renderizar, sin un efecto que dependa de `lecciones`.
  const [elegidaId, setElegidaId] = useState<string | null>(null)
  const [recursosAbiertos, setRecursosAbiertos] = useState<Set<string>>(new Set())
  const [modulosAbiertos, setModulosAbiertos] = useState<Set<string>>(
    () => new Set(curso.modules.map((modulo) => modulo.id)),
  )
  const [selectorLeccion, setSelectorLeccion] = useState({ top: 0, height: 0, visible: false })
  const [pantallaCompleta, setPantallaCompleta] = useState(false)
  const listaContenidoRef = useRef<HTMLDivElement | null>(null)
  const leccionRefs = useRef(new Map<string, HTMLButtonElement>())
  const escenarioRef = useRef<HTMLElement | null>(null)
  const primeraPendiente = lecciones.find((l) => !completadas.has(l.id)) ?? lecciones[0]
  const activa =
    (elegidaId && lecciones.find((l) => l.id === elegidaId)) || primeraPendiente
  const moduloActivo = modulosVisuales.find((modulo) =>
    modulo.lessons.some((leccion) => leccion.id === activa?.id),
  )
  const completar = useCompleteLesson(slug)
  const completarAutomaticamente = () => {
    if (!activa || completadas.has(activa.id) || completar.isPending) return
    completar.mutate(activa.id)
  }

  useEffect(() => {
    document.documentElement.classList.add('course-learning-active')
    document.body.classList.add('course-learning-active')

    return () => {
      document.documentElement.classList.remove('course-learning-active')
      document.body.classList.remove('course-learning-active')
    }
  }, [])

  useEffect(() => {
    const actualizarPantallaCompleta = () => {
      setPantallaCompleta(document.fullscreenElement === escenarioRef.current)
    }

    document.addEventListener('fullscreenchange', actualizarPantallaCompleta)
    return () => document.removeEventListener('fullscreenchange', actualizarPantallaCompleta)
  }, [])

  useLayoutEffect(() => {
    const medir = () => {
      const contenedor = listaContenidoRef.current
      const filaActiva = activa ? leccionRefs.current.get(activa.id) : undefined
      const selectorVisible = Boolean(
        contenedor && filaActiva && moduloActivo && modulosAbiertos.has(moduloActivo.id),
      )

      if (!contenedor || !filaActiva || !selectorVisible) {
        setSelectorLeccion((actual) => actual.visible ? { ...actual, visible: false } : actual)
        return
      }

      const cajaContenedor = contenedor.getBoundingClientRect()
      const cajaFila = filaActiva.getBoundingClientRect()
      const siguiente = {
        top: cajaFila.top - cajaContenedor.top,
        height: cajaFila.height,
        visible: true,
      }
      setSelectorLeccion((actual) =>
        actual.top === siguiente.top &&
        actual.height === siguiente.height &&
        actual.visible === siguiente.visible
          ? actual
          : siguiente,
      )
    }

    let observador: ResizeObserver | null = null
    let segundoFrame = 0
    const primerFrame = window.requestAnimationFrame(() => {
      // El panel cambia de árbol al montarse en document.body en escritorio.
      // Medimos después de ese portal para no conservar una fila de altura cero.
      segundoFrame = window.requestAnimationFrame(() => {
        medir()
        const contenedor = listaContenidoRef.current
        const filaActiva = activa ? leccionRefs.current.get(activa.id) : undefined
        observador = new ResizeObserver(medir)
        if (contenedor) observador.observe(contenedor)
        if (filaActiva) observador.observe(filaActiva)
      })
    })
    window.addEventListener('resize', medir)

    return () => {
      window.cancelAnimationFrame(primerFrame)
      window.cancelAnimationFrame(segundoFrame)
      observador?.disconnect()
      window.removeEventListener('resize', medir)
    }
  }, [activa?.id, moduloActivo?.id, modulosAbiertos])

  const alternarModulo = (moduloId: string) => {
    setModulosAbiertos((actuales) => {
      const siguientes = new Set(actuales)
      if (siguientes.has(moduloId)) siguientes.delete(moduloId)
      else siguientes.add(moduloId)
      return siguientes
    })
  }

  const seleccionarLeccion = (leccionId: string) => {
    if (leccionId === activa?.id) return

    const doc = document as Document & {
      startViewTransition?: (update: () => void) => { finished: Promise<void> }
    }
    const reducirMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (!doc.startViewTransition || reducirMovimiento) {
      setElegidaId(leccionId)
      return
    }

    try {
      document.documentElement.dataset.lessonTransition = 'active'
      const transicion = doc.startViewTransition(() => {
        flushSync(() => setElegidaId(leccionId))
      })

      void transicion.finished.finally(() => {
        delete document.documentElement.dataset.lessonTransition
      })
    } catch {
      delete document.documentElement.dataset.lessonTransition
      setElegidaId(leccionId)
    }
  }

  const alternarPantallaCompleta = async () => {
    const escenario = escenarioRef.current
    if (!escenario) return

    try {
      if (document.fullscreenElement === escenario) await document.exitFullscreen()
      else await escenario.requestFullscreen()
    } catch {
      // La interfaz continúa siendo utilizable si el navegador bloquea la API.
    }
  }

  return (
    <div className="course-learning-main flex w-full max-w-none flex-col gap-aire-m py-aire-m">
      <div className="grid gap-aire-l cine:items-start">
        {/* Escenario estable: solo esta superficie participa en la transición
            entre lectura, video y examen. */}
        <section
          ref={escenarioRef}
          aria-label="Contenido de la lección"
          style={{ viewTransitionName: 'lesson-content' }}
          className="course-lesson-stage relative order-1 w-full cine:order-1"
        >
          {activa?.type === 'TEXT' && (
            <button
              type="button"
              onClick={() => void alternarPantallaCompleta()}
              aria-label={pantallaCompleta ? 'Salir de pantalla completa' : 'Ver en pantalla completa'}
              title={pantallaCompleta ? 'Salir de pantalla completa' : 'Pantalla completa'}
              style={{ viewTransitionName: 'lesson-fullscreen-control' }}
              className="absolute right-4 top-4 z-[30] flex size-10 items-center justify-center border border-hueso/30 bg-negro/75 text-hueso backdrop-blur-sm transition-colors hover:border-vino hover:bg-vino focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vino"
            >
              <IconoPantallaCompleta contraer={pantallaCompleta} />
            </button>
          )}

          {activa && (
            <article
              className={activa.type === 'VIDEO'
                ? 'course-video-lesson flex h-full w-full max-w-none flex-col'
                : 'mx-auto flex min-h-full w-full max-w-4xl flex-col gap-aire-l px-[clamp(1.5rem,4vw,4rem)] py-aire-m'}
            >
              {activa.type !== 'VIDEO' && (
                <div className="flex flex-col gap-aire-xs border-b border-linea pb-aire-s">
                  <Eyebrow rule={false}>{tipoLeccion(activa.type)}</Eyebrow>
                  <h2 className="m-0 font-mono text-h-l font-normal leading-tight text-contenido">{activa.title}</h2>
                </div>
              )}

              <LeccionCuerpo
                key={activa.id}
                slug={slug}
                leccion={activa}
                completada={completadas.has(activa.id)}
                onTerminar={completarAutomaticamente}
              />
            </article>
          )}
        </section>

        <section aria-labelledby="descripcion-curso" className="course-overview order-2 w-full border-t border-linea-fuerte">
          <div className="border-b border-linea">
            <div className="mx-auto flex w-full max-w-5xl items-center px-[clamp(1.5rem,4vw,4rem)] py-aire-s">
              <span className="border-b-2 border-vino pb-2 font-mono text-body-s font-semibold uppercase tracking-[0.12em] text-contenido">
                Descripción general
              </span>
            </div>
          </div>

          <div className="mx-auto flex w-full max-w-5xl flex-col gap-aire-l px-[clamp(1.5rem,4vw,4rem)] py-aire-l">
            <div className="grid gap-aire-l cine:grid-cols-[minmax(0,1.35fr)_minmax(16rem,0.65fr)]">
              <div className="flex flex-col gap-aire-s">
                <Eyebrow rule={false}>Sobre este curso</Eyebrow>
                <h3 id="descripcion-curso" className="m-0 font-mono text-h-l font-normal leading-tight text-contenido">
                  {curso.title}
                </h3>
                <p className="m-0 max-w-3xl font-ui text-body-l leading-relaxed text-texto-tenue">
                  {curso.description ?? 'Un recorrido formativo para profundizar en la fe y llevar lo aprendido a la vida diaria.'}
                </p>
              </div>

              <aside className="flex flex-col justify-center gap-2 border-l-2 border-vino pl-aire-s">
                <span className="font-mono text-eyebrow uppercase tracking-label text-vino">Propósito</span>
                <p className="m-0 font-serif text-body leading-relaxed text-contenido/[0.88]">
                  {curso.purpose ??
                    'Comprender el llamado de Jesús, examinar su significado y convertirlo en decisiones concretas para la vida cotidiana.'}
                </p>
              </aside>
            </div>

            <section aria-labelledby="objetivos-curso" className="flex flex-col gap-aire-s border-y border-linea py-aire-m">
              <div className="flex items-center gap-aire-s">
                <span aria-hidden className="h-px w-8 bg-vino" />
                <h4 id="objetivos-curso" className="m-0 font-mono text-body uppercase tracking-[0.1em] text-contenido">
                  Lo que aprenderás
                </h4>
              </div>
              <ul className="m-0 grid list-none gap-x-aire-l gap-y-aire-s p-0 sm:grid-cols-2">
                {objetivosAprendizaje.map((objetivo) => (
                  <li key={objetivo} className="flex items-start gap-3 font-ui text-body leading-relaxed text-texto-tenue">
                    <span aria-hidden className="mt-[0.45em] size-2 shrink-0 border border-vino bg-vino/15" />
                    <span>{objetivo}</span>
                  </li>
                ))}
              </ul>
            </section>

            <dl className="m-0 grid gap-aire-s border-b border-linea pb-aire-m sm:grid-cols-2 cine:grid-cols-4">
              <DatoCurso etiqueta="Módulos" valor={String(curso.modules.length)} />
              <DatoCurso etiqueta="Lecciones" valor={String(lecciones.length)} />
              <DatoCurso etiqueta="Duración estimada" valor={duracionTotal > 0 ? formatearDuracionLarga(duracionTotal) : 'A tu ritmo'} />
              <DatoCurso etiqueta="Tu avance" valor={`${Math.round(curso.progressPct)}%`} />
            </dl>

            <section aria-labelledby="recorrido-curso" className="flex flex-col gap-aire-s">
              <Eyebrow rule={false}>Tu recorrido</Eyebrow>
              <h4 id="recorrido-curso" className="sr-only">Módulos del curso</h4>
              <ol className="m-0 grid list-none gap-px border border-linea bg-linea p-0 sm:grid-cols-2">
                {modulosVisuales.map((modulo, indice) => (
                  <li key={modulo.id} className="flex items-center gap-aire-s bg-fondo px-aire-s py-aire-s">
                    <span className="font-mono text-body text-vino">{String(indice + 1).padStart(2, '0')}</span>
                    <span className="flex-1 font-ui text-body-s font-semibold text-contenido">{modulo.title}</span>
                    <span className="font-mono text-eyebrow text-texto-debil">{modulo.lessons.length} lec.</span>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </section>

        {/* En escritorio sale del árbol animado del main para que su posición
            y su scroll sean realmente independientes del documento. */}
        <PortalEnEscritorio>
          <div aria-hidden="true" className="course-learning-divider" />
          <nav aria-label="Lecciones" className="course-content-panel order-2 flex flex-col bg-superficie-1 cine:order-2">
            <div className="sticky top-0 z-20 flex items-center justify-between border-b border-linea bg-superficie-1 px-aire-s py-aire-s">
              <Eyebrow rule={false}>Contenido del curso</Eyebrow>
              <span className="font-mono text-eyebrow text-texto-tenue">{Math.round(curso.progressPct)}%</span>
            </div>

            <div ref={listaContenidoRef} className="course-content-sections relative flex w-full flex-col">
              <span
                aria-hidden="true"
                className="course-lesson-selector"
                style={{
                  height: selectorLeccion.height,
                  opacity: selectorLeccion.visible ? 1 : 0,
                  transform: `translate3d(0, ${selectorLeccion.top}px, 0)`,
                }}
              />

              {modulosVisuales.map((m) => {
                const abierto = modulosAbiertos.has(m.id)
                const completadasModulo = m.lessons.filter((leccion) => completadas.has(leccion.id)).length
                const duracionModulo = m.lessons.reduce(
                  (total, leccion) => total + (leccion.durationSeconds ?? 0),
                  0,
                )

                return (
                  <section key={m.id} className="relative z-[1] flex w-full flex-col border-b border-linea">
                    <button
                      type="button"
                      aria-expanded={abierto}
                      onClick={() => alternarModulo(m.id)}
                      className="relative z-[2] flex w-full items-center gap-aire-s bg-superficie-2 px-aire-s py-aire-s text-left transition-colors hover:bg-superficie-1"
                    >
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="truncate font-ui text-body-s font-semibold text-contenido">{m.title}</span>
                        <span className="font-mono text-eyebrow text-texto-tenue">
                          {completadasModulo} / {m.lessons.length}
                          {duracionModulo > 0 ? ` · ${formatearDuracionResumen(duracionModulo)}` : ''}
                        </span>
                      </span>
                      <svg
                        aria-hidden="true"
                        className={`size-4 shrink-0 text-contenido transition-transform duration-[520ms] ease-camino ${abierto ? 'rotate-180' : ''}`}
                        viewBox="0 0 16 16"
                        fill="none"
                      >
                        <path d="m3.5 6 4.5 4 4.5-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>

                    <div
                      className={`grid transition-[grid-template-rows,opacity] duration-[520ms] ease-camino ${abierto ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
                      aria-hidden={!abierto}
                    >
                      <div className="min-h-0 overflow-hidden">
                        <ul className="m-0 flex list-none flex-col p-0">
                          {m.lessons.map((l) => (
                            <li key={l.id} className="relative z-[1] flex flex-col">
                              <button
                                ref={(node) => {
                                  if (node) leccionRefs.current.set(l.id, node)
                                  else leccionRefs.current.delete(l.id)
                                }}
                                type="button"
                                onClick={() => seleccionarLeccion(l.id)}
                                aria-current={l.id === activa?.id ? 'step' : undefined}
                                className={[
                                  'course-lesson-link relative z-[1] flex w-full items-center gap-2 px-aire-s py-aire-xs text-left',
                                  'font-ui text-body-s transition-colors duration-fade ease-camino',
                                  l.id === activa?.id ? 'text-hueso' : 'text-texto-tenue hover:text-contenido',
                                ].join(' ')}
                              >
                                <IndicadorCompletado
                                  completado={completadas.has(l.id)}
                                  activo={l.id === activa?.id}
                                />
                                <IconoLeccion tipo={l.type} />
                                <span className="min-w-0 flex-1 truncate">{l.title}</span>
                                {l.durationSeconds ? (
                                  <span className="shrink-0 font-mono text-eyebrow text-texto-debil">
                                    {formatearDuracionResumen(l.durationSeconds)}
                                  </span>
                                ) : null}
                              </button>

                              {l.resources && l.resources.length > 0 && (
                                <>
                                  <button
                                    type="button"
                                    aria-expanded={recursosAbiertos.has(l.id)}
                                    onClick={() => setRecursosAbiertos((actuales) => {
                                      const siguiente = new Set(actuales)
                                      if (siguiente.has(l.id)) siguiente.delete(l.id)
                                      else siguiente.add(l.id)
                                      return siguiente
                                    })}
                                    className="relative z-[1] ml-10 flex items-center gap-2 self-start px-aire-s py-1 font-ui text-eyebrow text-vino transition-colors hover:text-contenido"
                                  >
                                    <IconoCarpeta />
                                    Recursos
                                    <svg aria-hidden="true" className={`size-3 transition-transform duration-fade ${recursosAbiertos.has(l.id) ? 'rotate-180' : ''}`} viewBox="0 0 16 16" fill="none">
                                      <path d="m3.5 6 4.5 4 4.5-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  </button>
                                  {recursosAbiertos.has(l.id) && (
                                    <div className="relative z-[1] ml-10 flex flex-col gap-1 border-l border-vino/50 pb-1 pl-aire-s">
                                      {l.resources.map((recurso) => (
                                        <a
                                          key={recurso.id}
                                          href={recurso.url}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="font-ui text-eyebrow text-texto-tenue no-underline hover:text-contenido"
                                        >
                                          {recurso.title}
                                        </a>
                                      ))}
                                    </div>
                                  )}
                                </>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </section>
                )
              })}
            </div>
          </nav>
        </PortalEnEscritorio>
      </div>
    </div>
  )
}

function DatoCurso({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="font-mono text-eyebrow uppercase tracking-label text-texto-debil">{etiqueta}</dt>
      <dd className="m-0 font-ui text-body font-semibold text-contenido">{valor}</dd>
    </div>
  )
}

function construirObjetivos(curso: CourseDetail): string[] {
  // Los que redactó el maestro tienen prioridad; si no hay, un respaldo genérico.
  if (curso.learningObjectives.length > 0) return curso.learningObjectives

  const objetivosBase = [
    `Interpretar el mensaje central de ${curso.title.toLocaleLowerCase('es')}.`,
    'Relacionar la enseñanza bíblica con decisiones y situaciones de la vida cotidiana.',
  ]
  const objetivosPorModulo = curso.modules.slice(0, 2).map((modulo) =>
    `Profundizar en ${modulo.title.toLocaleLowerCase('es')} mediante lecturas, reflexión y práctica.`,
  )

  return [...objetivosBase, ...objetivosPorModulo].slice(0, 4)
}

function PortalEnEscritorio({ children }: { children: ReactNode }) {
  const [destino, setDestino] = useState<HTMLElement | null>(null)

  useEffect(() => {
    const media = window.matchMedia('(min-width: 820px)')
    const actualizarDestino = () => setDestino(media.matches ? document.body : null)

    actualizarDestino()
    media.addEventListener('change', actualizarDestino)
    return () => media.removeEventListener('change', actualizarDestino)
  }, [])

  return destino ? createPortal(children, destino) : <>{children}</>
}

function LeccionCuerpo({
  slug,
  leccion,
  completada,
  onTerminar,
}: {
  slug: string
  leccion: Lesson
  completada: boolean
  onTerminar: () => void
}) {
  if (leccion.type === 'EXAM') {
    return <ExamenLeccion key={leccion.id} slug={slug} leccion={leccion} completada={completada} />
  }

  if (leccion.type === 'TEXT') {
    return <EditorLectura key={leccion.id} value={leccion.content ?? ''} editable={false} />
  }

  if (leccion.type === 'IMAGE') {
    return <GaleriaImagenes urls={parseGaleria(leccion.content)} />
  }

  return <VideoLeccion leccion={leccion} onTerminar={onTerminar} />
}

/** Evaluación real del alumno: responde y el servidor califica (HU de evaluación). */
function ExamenLeccion({
  slug,
  leccion,
  completada,
}: {
  slug: string
  leccion: Lesson
  completada: boolean
}) {
  const preguntas = leccion.questions ?? []
  const calificar = useGradeExam(slug)
  const [respuestas, setRespuestas] = useState<Record<number, number>>({})
  const [resultado, setResultado] = useState<ResultadoExamen | null>(null)

  const todasRespondidas =
    preguntas.length > 0 && preguntas.every((_, i) => respuestas[i] !== undefined)

  const enviar = () => {
    const arr = preguntas.map((_, i) => respuestas[i] ?? -1)
    calificar.mutate({ lessonId: leccion.id, respuestas: arr }, { onSuccess: setResultado })
  }

  const reintentar = () => {
    setResultado(null)
    setRespuestas({})
  }

  return (
    <div className="flex w-full max-w-3xl flex-col gap-aire-l">
      <header className="flex flex-col gap-aire-xs">
        <span className="font-mono text-eyebrow uppercase tracking-label text-vino">Evaluación</span>
        <p className="m-0 font-ui text-body-s text-texto-tenue">
          {preguntas.length} pregunta{preguntas.length === 1 ? '' : 's'} de selección única. Necesitas
          acertar al menos el 60% para aprobar.
          {completada && ' Ya la completaste; puedes repasarla.'}
        </p>
      </header>

      {preguntas.map((pregunta, i) => (
        <fieldset key={i} className="m-0 flex flex-col gap-aire-s border-0 p-0">
          <legend className="m-0 mb-aire-xs p-0 font-mono text-body font-semibold text-contenido">
            {i + 1}. {pregunta.enunciado}
          </legend>
          {pregunta.opciones.map((opcion, j) => {
            const elegida = respuestas[i] === j
            const esCorrecta = resultado?.resultados[i] && elegida
            const esFallo = resultado && elegida && !resultado.resultados[i]
            return (
              <label
                key={j}
                className={[
                  'flex cursor-pointer items-center gap-aire-s rounded border px-aire-s py-aire-xs font-ui text-body-s transition-colors',
                  esCorrecta
                    ? 'border-exito text-exito'
                    : esFallo
                      ? 'border-vino text-vino'
                      : elegida
                        ? 'border-contenido text-contenido'
                        : 'border-linea text-texto-tenue hover:border-contenido',
                ].join(' ')}
              >
                <input
                  type="radio"
                  name={`pregunta-${i}`}
                  checked={elegida}
                  disabled={Boolean(resultado)}
                  onChange={() => setRespuestas((r) => ({ ...r, [i]: j }))}
                />
                <span className="flex-1">{opcion}</span>
                {esCorrecta && <span aria-hidden="true">✓</span>}
                {esFallo && <span aria-hidden="true">✗</span>}
              </label>
            )
          })}
        </fieldset>
      ))}

      {resultado ? (
        <div className="flex flex-col gap-aire-s rounded border border-linea bg-superficie-1 p-aire-m">
          <p className="m-0 font-mono text-body font-semibold text-contenido">
            {resultado.aprobado ? '¡Aprobado!' : 'Aún no alcanzas el mínimo'} — {resultado.aciertos} de{' '}
            {resultado.total} correctas
          </p>
          {!resultado.aprobado && (
            <Boton variante="formulario" onClick={reintentar} className="self-start">
              Reintentar
            </Boton>
          )}
        </div>
      ) : (
        <Boton
          variante="formulario"
          onClick={enviar}
          disabled={!todasRespondidas || calificar.isPending}
          className="self-start"
        >
          {calificar.isPending ? 'Calificando…' : 'Enviar respuestas'}
        </Boton>
      )}
    </div>
  )
}

function VideoLeccion({ leccion, onTerminar }: { leccion: Lesson; onTerminar: () => void }) {
  const indiceMedia = (Math.max(leccion.orderIndex, 0) % 4) + 1

  return (
    <video
      aria-label="Video de la lección"
      className="h-full w-full bg-negro object-cover"
      controls
      playsInline
      preload="metadata"
      poster={`/posters/${indiceMedia}.jpg`}
      src={`/media/${indiceMedia}.mp4`}
      onEnded={onTerminar}
    >
      Tu navegador no puede reproducir este video.
    </video>
  )
}

function tipoLeccion(tipo: Lesson['type']): string {
  if (tipo === 'VIDEO') return 'Video'
  if (tipo === 'EXAM') return 'Examen'
  if (tipo === 'IMAGE') return 'Imágenes'
  return 'Lectura'
}

function NoInscrito({ curso }: { curso: CourseDetail }) {
  const enroll = useEnroll()
  return (
    <DetallePublico
      curso={curso}
      accion={
        <Boton
          onClick={() => enroll.mutate(curso.id)}
          disabled={enroll.isPending}
          className="!rounded-none !border-vino !bg-vino !px-aire-m !py-aire-xs !text-[0.6rem] !tracking-[0.12em] !text-hueso hover:!bg-vino"
        >
          {enroll.isPending ? 'Inscribiendo…' : 'Inscribirme a este curso'}
        </Boton>
      }
    />
  )
}

function Bloqueado({ curso }: { curso: CourseDetail }) {
  return (
    <DetallePublico
      curso={curso}
      bloqueado
      accion={
        <div className="border border-linea bg-superficie-2 px-aire-m py-aire-s font-mono text-eyebrow uppercase tracking-label text-texto-tenue">
          Requiere el nivel {curso.requiredLevelRank}. Sigue avanzando para desbloquearlo.
        </div>
      }
    />
  )
}

function DetallePublico({
  curso,
  accion,
  bloqueado = false,
}: {
  curso: CourseDetail
  accion: ReactNode
  bloqueado?: boolean
}) {
  useEffect(() => {
    let frame = 0
    const espera = window.setTimeout(() => {
      const inicio = window.scrollY
      const destino = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
      const diferencia = destino - inicio
      if (Math.abs(diferencia) < 4) return

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        window.scrollTo(0, destino)
        return
      }

      const comienzo = performance.now()
      const duracion = 1200
      const avanzar = (ahora: number) => {
        const progreso = Math.min(1, (ahora - comienzo) / duracion)
        const suavizado = progreso < 0.5
          ? 2 * progreso * progreso
          : 1 - ((-2 * progreso + 2) ** 2) / 2
        window.scrollTo(0, inicio + diferencia * suavizado)
        if (progreso < 1) frame = window.requestAnimationFrame(avanzar)
      }
      frame = window.requestAnimationFrame(avanzar)
    }, 820)

    return () => {
      window.clearTimeout(espera)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-aire-l py-aire-m">
      <section className="flex flex-col gap-aire-m">
        <div
          className="relative isolate flex min-h-[18rem] flex-col justify-end overflow-hidden bg-negro px-aire-m py-aire-l cine:min-h-[22rem]"
          style={{
            backgroundImage: `url('${curso.coverImageUrl ?? '/brand/paisaje.webp'}')`,
            backgroundPosition: 'center',
            backgroundSize: 'cover',
          }}
        >
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-negro via-negro/75 to-negro/10" />
          <div className="relative flex flex-wrap items-center gap-2 font-mono text-eyebrow uppercase tracking-label text-texto-tenue">
            <span className="bg-vino px-2 py-1 text-hueso">{curso.isFree ? 'Gratis' : 'Premium'}</span>
            <span className="bg-negro/70 px-2 py-1 text-hueso">{curso.requiredLevelRank ? `Nivel ${curso.requiredLevelRank}` : 'Abierto'}</span>
            {bloqueado && <span className="bg-vino px-2 py-1 text-hueso">Bloqueado</span>}
          </div>
          <div className="relative mt-aire-s flex flex-col gap-aire-s">
            <h1 className="m-0 max-w-4xl font-mono text-h-l font-normal leading-tight text-hueso cine:text-[3.5rem]">{curso.title}</h1>
            {curso.description && <p className="m-0 max-w-3xl font-ui text-body-l leading-relaxed text-hueso/80">{curso.description}</p>}
          </div>
        </div>

        <div className="w-full bg-superficie-1 shadow-2xl">
          <PresentacionCurso />
        </div>
      </section>

      <ContenidoCurso curso={curso} />

      <div id="inscripcion" className="flex flex-col gap-aire-s bg-superficie-1 p-aire-m">
        <p className="m-0 font-mono text-body-s text-texto-tenue">
          {bloqueado ? 'Este recorrido aparecerá cuando alcances el nivel requerido.' : 'Empieza hoy tu recorrido y avanza a tu propio ritmo.'}
        </p>
        {accion}
      </div>
    </div>
  )
}

function ContenidoCurso({ curso }: { curso: CourseDetail }) {
  const [abiertos, setAbiertos] = useState<Set<string>>(
    () => new Set(curso.modules[0] ? [curso.modules[0].id] : []),
  )
  const todosAbiertos = abiertos.size === curso.modules.length

  const alternarModulo = (id: string) => {
    setAbiertos((actuales) => {
      const siguiente = new Set(actuales)
      if (siguiente.has(id)) siguiente.delete(id)
      else siguiente.add(id)
      return siguiente
    })
  }

  return (
    <section className="flex flex-col gap-aire-s">
      <div className="flex flex-wrap items-end justify-between gap-aire-s">
        <div className="flex flex-col gap-1">
          <h2 className="m-0 font-mono text-h-m font-normal text-contenido">Contenido del curso</h2>
          <p className="m-0 font-mono text-body-s text-texto-tenue">
            {curso.modules.length} módulos · {curso.modules.reduce((total, modulo) => total + modulo.lessons.length, 0)} lecciones
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAbiertos(todosAbiertos ? new Set() : new Set(curso.modules.map((modulo) => modulo.id)))}
          className="font-mono text-eyebrow uppercase tracking-label text-vino underline decoration-vino underline-offset-4"
        >
          {todosAbiertos ? 'Contraer todo' : 'Expandir todo'}
        </button>
      </div>

      <div className="flex flex-col border border-linea">
        {curso.modules.map((modulo) => {
          const abierto = abiertos.has(modulo.id)
          return (
            <div key={modulo.id} className="border-b border-linea last:border-b-0">
              <button
                type="button"
                aria-expanded={abierto}
                onClick={() => alternarModulo(modulo.id)}
                className="flex w-full items-center gap-aire-s bg-superficie-2 px-aire-m py-aire-s text-left transition-colors duration-fade hover:bg-superficie-1"
              >
                <svg
                  aria-hidden="true"
                  className={`size-4 shrink-0 text-vino transition-transform duration-[520ms] ease-camino ${abierto ? 'rotate-180' : ''}`}
                  viewBox="0 0 16 16"
                  fill="none"
                >
                  <path d="m3.5 6 4.5 4 4.5-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="flex-1 font-ui text-body font-semibold text-contenido">{modulo.title}</span>
                <span className="font-mono text-eyebrow text-texto-tenue">{modulo.lessons.length} lecciones</span>
              </button>
              <div
                className={`grid transition-[grid-template-rows,opacity] duration-[520ms] ease-camino ${abierto ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
                aria-hidden={!abierto}
              >
                <div className="min-h-0 overflow-hidden">
                  <ul className="m-0 flex list-none flex-col divide-y divide-linea p-0">
                    {modulo.lessons.map((leccion) => (
                      <li key={leccion.id} className="flex items-center gap-aire-s px-aire-m py-aire-s">
                        <IconoLeccion tipo={leccion.type} />
                        <span className="flex-1 font-ui text-body-s text-contenido">{leccion.title}</span>
                        <span className="font-mono text-eyebrow text-texto-tenue">
                          {tipoLeccion(leccion.type)}{leccion.durationSeconds ? ` · ${formatearDuracion(leccion.durationSeconds)}` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function IndicadorCompletado({ completado, activo }: { completado: boolean; activo: boolean }) {
  const clase = completado
    ? activo
      ? 'border-hueso bg-hueso text-vino'
      : 'border-vino bg-vino text-hueso'
    : activo
      ? 'border-hueso/80 bg-transparent text-transparent'
      : 'border-texto-debil bg-transparent text-transparent'

  return (
    <span
      aria-hidden="true"
      className={`flex size-5 shrink-0 items-center justify-center border-2 transition-colors duration-fade ${clase}`}
    >
      {completado && (
        <svg className="size-3.5" viewBox="0 0 16 16" fill="none">
          <path d="m3.25 8.25 3 3 6.5-6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  )
}


function IconoCarpeta() {
  return (
    <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none">
      <path d="M3.5 6.5h6l2 2h9v9.5a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18V6.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M3.5 9h17" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function IconoPantallaCompleta({ contraer }: { contraer: boolean }) {
  return contraer ? (
    <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24" fill="none">
      <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24" fill="none">
      <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function formatearDuracion(segundos: number): string {
  const minutos = Math.floor(segundos / 60)
  const restantes = segundos % 60
  return `${minutos}:${String(restantes).padStart(2, '0')}`
}

function formatearDuracionResumen(segundos: number): string {
  const minutosTotales = Math.max(1, Math.ceil(segundos / 60))
  if (minutosTotales < 60) return `${minutosTotales} min`

  const horas = Math.floor(minutosTotales / 60)
  const minutos = minutosTotales % 60
  return minutos > 0 ? `${horas} h ${minutos} min` : `${horas} h`
}

function formatearDuracionLarga(segundos: number): string {
  return formatearDuracionResumen(segundos)
}

function PresentacionCurso() {
  return (
    <div className="relative aspect-video overflow-hidden bg-negro">
      <video
        className="h-full w-full object-cover"
        controls
        preload="metadata"
        poster="/posters/1.jpg"
        src="/media/1.mp4"
      >
        Tu navegador no admite la reproducción de video.
      </video>
      <span className="pointer-events-none absolute left-aire-s top-aire-s bg-negro/75 px-2 py-1 font-mono text-eyebrow uppercase tracking-label text-hueso">
        Presentación del curso
      </span>
    </div>
  )
}

const Estado = ({ children }: { children: string }) => (
  <p className="py-aire-l text-center font-mono text-body text-texto-tenue">{children}</p>
)
