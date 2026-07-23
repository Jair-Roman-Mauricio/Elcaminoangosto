import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Boton, Card, Field, Input, Reveal, Select } from '@elcamino/ui'
import { useMyCourses, useCreateCourse, useLevels } from './authoring-api'
import { EstadoBadge } from './estado-curso'
import { CourseAccessBadges } from './course-access-badges'

/** Principal del profesor: catálogo propio, búsqueda y creación de cursos. */
export function MisCursosPage() {
  const { data: cursos, isPending } = useMyCourses()
  const navigate = useNavigate()
  const [creando, setCreando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const cerrarCreacion = useCallback(() => setCreando(false), [])
  const cursosFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase()
    if (!cursos || !termino) return cursos ?? []
    return cursos.filter((curso) =>
      [curso.title, curso.description ?? ''].join(' ').toLowerCase().includes(termino),
    )
  }, [busqueda, cursos])

  return (
    <div className="flex w-full flex-col gap-aire-l pb-aire-m pt-0">
      <header className="flex flex-col gap-aire-m">
        <h1 className="m-0 font-mono text-h-l font-normal text-contenido">Catálogo de cursos</h1>

        <div className="flex w-full flex-col gap-aire-s sm:flex-row sm:items-center">
          <label className="relative block min-w-0 flex-1">
            <span className="sr-only">Buscar entre mis cursos</span>
            <svg
              className="pointer-events-none absolute left-aire-s top-1/2 size-5 -translate-y-1/2 text-texto-tenue"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Buscar un curso"
              className="h-14 w-full rounded-full border border-linea bg-superficie-1 pl-12 pr-aire-s font-ui text-body text-contenido outline-none transition-colors placeholder:text-texto-tenue focus:border-vino"
            />
          </label>

          <Boton
            variante="formulario"
            onClick={() => setCreando((valor) => !valor)}
            aria-expanded={creando}
            aria-controls="formulario-crear-curso"
            className="h-14 w-full shrink-0 px-aire-l sm:w-auto sm:min-w-[12rem]"
          >
            Crear curso
          </Boton>
        </div>
      </header>

      {creando && <ModalNuevoCurso onCerrar={cerrarCreacion} />}

      {isPending && <Estado>Cargando…</Estado>}
      {cursos && cursos.length === 0 && !creando && (
        <Estado>Aún no has creado cursos. Empieza con «Crear curso».</Estado>
      )}
      {cursos && cursos.length > 0 && cursosFiltrados.length === 0 && (
        <Estado>No encontramos cursos con esa búsqueda.</Estado>
      )}

      {cursosFiltrados.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))] gap-aire-m">
          {cursosFiltrados.map((c, i) => (
            <Reveal key={c.id} delay={i * 0.05}>
              <Card
                titulo={c.title}
                meta={c.description || 'Borrador sin descripción general'}
                media={<CursoMediaMaestro status={c.status} />}
                onClick={() => navigate(`/maestro/cursos/${c.id}`)}
              >
                <CourseAccessBadges
                  isFree={c.isFree}
                  requiredLevelRank={c.requiredLevelRank}
                  className="mt-aire-xs"
                />
                <div className="mt-auto flex items-center justify-between pt-aire-s">
                  <EstadoBadge status={c.status} />
                  <EditarLink slug={c.id} />
                </div>
              </Card>
            </Reveal>
          ))}
        </div>
      )}
    </div>
  )
}

function ModalNuevoCurso({ onCerrar }: { onCerrar: () => void }) {
  const dialogoRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const elementoPrevio = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const overflowPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const dialogo = dialogoRef.current
    const primerCampo = dialogo?.querySelector<HTMLInputElement>('input')
    primerCampo?.focus()

    const manejarTeclado = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        evento.preventDefault()
        onCerrar()
        return
      }

      if (evento.key !== 'Tab' || !dialogo) return
      const enfocables = Array.from(
        dialogo.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      )
      if (enfocables.length === 0) return
      const primero = enfocables[0]
      const ultimo = enfocables[enfocables.length - 1]
      if (!primero || !ultimo) return

      if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault()
        ultimo.focus()
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault()
        primero.focus()
      }
    }

    document.addEventListener('keydown', manejarTeclado)
    return () => {
      document.removeEventListener('keydown', manejarTeclado)
      document.body.style.overflow = overflowPrevio
      elementoPrevio?.focus()
    }
  }, [onCerrar])

  return createPortal(
    <div
      className="teacher-course-modal fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-negro/60 px-gutter py-aire-l backdrop-blur-sm"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget) onCerrar()
      }}
    >
      <div
        ref={dialogoRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="crear-curso-titulo"
        aria-describedby="crear-curso-descripcion"
        className="teacher-course-modal__dialog relative w-full max-w-2xl rounded-[1.5rem] border border-linea bg-superficie-1 p-aire-m text-contenido shadow-[0_1.5rem_5rem_rgb(0_0_0/0.3)] sm:p-aire-l"
      >
        <header className="mb-aire-m pr-12">
          <span className="font-mono text-eyebrow uppercase tracking-label text-vino">Nuevo curso</span>
          <h2 id="crear-curso-titulo" className="mb-0 mt-aire-xs font-mono text-h-m font-normal text-contenido">
            Crear curso
          </h2>
          <p id="crear-curso-descripcion" className="mb-0 mt-aire-xs font-mono text-body-s text-texto-tenue">
            Completa los datos iniciales para crear un borrador editable.
          </p>
        </header>

        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar el formulario"
          className="absolute right-aire-m top-aire-m grid size-10 place-items-center rounded-full border border-linea text-contenido transition-colors duration-fade hover:border-vino hover:text-vino"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
            <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        <FormularioNuevoCurso onHecho={onCerrar} />
      </div>
    </div>,
    document.body,
  )
}

function EditarLink({ slug }: { slug: string }) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        navigate(`/maestro/cursos/${slug}`)
      }}
      className="font-mono text-eyebrow uppercase tracking-label text-contenido underline decoration-vino underline-offset-4 hover:text-vino"
    >
      Abrir →
    </button>
  )
}

function FormularioNuevoCurso({ onHecho }: { onHecho: () => void }) {
  const crear = useCreateCourse()
  const niveles = useLevels()
  const [title, setTitle] = useState('')
  const [requiredLevelId, setRequiredLevelId] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    if (requiredLevelId || !niveles.data?.length) return
    const nivelInicial = niveles.data.find((nivel) => nivel.rank === 1) ?? niveles.data[0]
    if (nivelInicial) setRequiredLevelId(nivelInicial.id)
  }, [niveles.data, requiredLevelId])

  const enviar = (e: React.FormEvent) => {
    e.preventDefault()
    if (title.trim().length < 3 || !requiredLevelId) return
    crear.mutate(
      {
        title: title.trim(),
        description: null,
        requiredLevelId,
        isFree: true,
        plannedModules: 0,
      },
      {
        onSuccess: (curso) => {
          onHecho()
          navigate(`/maestro/cursos/${curso.id}`)
        },
      },
    )
  }

  return (
    <form
      id="formulario-crear-curso"
      onSubmit={enviar}
      className="flex flex-col gap-aire-s"
    >
      <Field label="Título del curso" htmlFor="nuevo-titulo">
        <Input
          id="nuevo-titulo"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Mínimo 3 caracteres"
        />
      </Field>
      <Field
        label="Nivel necesario"
        htmlFor="nuevo-nivel"
        hint="Los estudiantes deberán haber alcanzado este nivel para abrir el curso."
      >
        <Select
          id="nuevo-nivel"
          value={requiredLevelId}
          onChange={(event) => setRequiredLevelId(event.target.value)}
          disabled={niveles.isPending || niveles.isError}
        >
          <option value="" disabled>
            {niveles.isPending ? 'Cargando niveles…' : 'Selecciona un nivel'}
          </option>
          {niveles.data?.map((nivel) => (
            <option key={nivel.id} value={nivel.id}>
              Nivel {nivel.rank} · {nivel.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="flex items-center justify-between gap-aire-s rounded border border-linea bg-superficie-2 px-aire-s py-aire-xs">
        <span className="font-mono text-body-s text-texto-tenue">
          Todos los borradores nuevos se crean con acceso gratuito.
        </span>
        <span className="shrink-0 rounded-sm bg-vino px-3 py-1 font-mono text-eyebrow font-bold uppercase tracking-label text-hueso">
          Gratis
        </span>
      </div>
      {niveles.isError && (
        <p role="alert" className="m-0 font-mono text-body-s text-vino">
          No se pudieron cargar los niveles disponibles.
        </p>
      )}
      {crear.isError && <p className="m-0 font-mono text-body-s text-vino">No se pudo crear el curso.</p>}
      <Boton
        type="submit"
        variante="formulario"
        className="mt-aire-xs w-full"
        disabled={crear.isPending || title.trim().length < 3 || !requiredLevelId}
      >
        {crear.isPending ? 'Creando…' : 'Crear borrador'}
      </Boton>
    </form>
  )
}

function CursoMediaMaestro({ status }: { status: string }) {
  return (
    <div className="relative flex h-full w-full items-center justify-center bg-gradient-to-br from-marino/30 via-superficie-2 to-negro">
      <svg viewBox="0 0 48 48" fill="none" aria-hidden className="h-12 w-12 text-contenido/[0.15]">
        <path d="M10 46V20a14 14 0 0 1 28 0v26" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" />
        <path d="M24 12v26M16 21h16" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" />
      </svg>
      <span className="sr-only">{status}</span>
    </div>
  )
}

const Estado = ({ children }: { children: string }) => (
  <p className="py-aire-l text-center font-mono text-body text-texto-tenue">{children}</p>
)
