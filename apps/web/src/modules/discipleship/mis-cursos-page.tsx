import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Boton, Card, Eyebrow, Reveal } from '@elcamino/ui'
import { useMyCourses, useCreateCourse } from './authoring-api'
import { EstadoBadge } from './estado-curso'

/** Mis cursos (HU-4.3, MAESTRO): lista con estado + crear borrador. */
export function MisCursosPage() {
  const { data: cursos, isPending } = useMyCourses()
  const [creando, setCreando] = useState(false)

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-aire-l py-aire-m">
      <header className="flex items-end justify-between gap-aire-m">
        <div className="flex flex-col gap-aire-xs">
          <Eyebrow>Discipulado</Eyebrow>
          <h1 className="m-0 font-mono text-h-l font-normal text-contenido">Mis cursos</h1>
        </div>
        <Boton onClick={() => setCreando((v) => !v)}>
          {creando ? 'Cancelar' : 'Nuevo curso'}
        </Boton>
      </header>

      {creando && <FormularioNuevoCurso onHecho={() => setCreando(false)} />}

      {isPending && <Estado>Cargando…</Estado>}
      {cursos && cursos.length === 0 && !creando && (
        <Estado>Aún no has creado cursos. Empieza con «Nuevo curso».</Estado>
      )}

      {cursos && cursos.length > 0 && (
        <div className="grid gap-aire-m sm:grid-cols-2 md:grid-cols-3">
          {cursos.map((c, i) => (
            <Reveal key={c.id} delay={i * 0.05}>
              <Card
                titulo={c.title}
                meta={c.requiredLevelRank ? `Nivel ${c.requiredLevelRank}` : 'Abierto'}
                media={<CursoMediaMaestro status={c.status} />}
                onClick={() => undefined}
              >
                <div className="mt-auto flex items-center justify-between pt-aire-xs">
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
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const navigate = useNavigate()

  const enviar = (e: React.FormEvent) => {
    e.preventDefault()
    if (title.trim().length < 3) return
    crear.mutate(
      { title: title.trim(), description: description.trim() || null },
      {
        onSuccess: (curso) => {
          onHecho()
          navigate(`/maestro/cursos/${curso.id}`)
        },
      },
    )
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-aire-s rounded border border-linea bg-superficie-1 p-aire-m">
      <Campo label="Título del curso" valor={title} onChange={setTitle} placeholder="Mínimo 3 caracteres" />
      <div className="flex flex-col gap-aire-xs">
        <label className="font-mono text-eyebrow uppercase tracking-label text-texto-tenue">Descripción</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="resize-none rounded border border-linea bg-superficie-2 px-aire-s py-aire-xs font-mono text-body text-contenido placeholder:text-texto-debil focus:border-contenido"
          placeholder="De qué trata el curso"
        />
      </div>
      {crear.isError && <p className="m-0 font-mono text-body-s text-vino">No se pudo crear el curso.</p>}
      <Boton type="submit" disabled={crear.isPending || title.trim().length < 3}>
        {crear.isPending ? 'Creando…' : 'Crear borrador'}
      </Boton>
    </form>
  )
}

function Campo({
  label,
  valor,
  onChange,
  placeholder,
}: {
  label: string
  valor: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div className="flex flex-col gap-aire-xs">
      <label className="font-mono text-eyebrow uppercase tracking-label text-texto-tenue">{label}</label>
      <input
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded border border-linea bg-superficie-2 px-aire-s py-aire-xs font-mono text-body text-contenido placeholder:text-texto-debil focus:border-contenido"
      />
    </div>
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
