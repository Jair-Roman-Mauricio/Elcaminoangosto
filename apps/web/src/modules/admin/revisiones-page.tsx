import { useState } from 'react'
import { Boton, Eyebrow } from '@elcamino/ui'
import { useReviewQueue, useReviewActions, type AuthoringCourse } from '../discipleship/authoring-api'
import { EstadoBadge } from '../discipleship/estado-curso'

/** Cola de revisión de cursos (HU-5.2, ADMIN). */
export function RevisionesPage() {
  const { data: cola, isPending } = useReviewQueue()

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-aire-m py-aire-m">
      <header className="flex flex-col gap-aire-xs">
        <Eyebrow>Administración</Eyebrow>
        <h1 className="m-0 font-mono text-h-l font-normal text-contenido">Cursos por revisar</h1>
      </header>

      {isPending && <p className="font-mono text-body text-texto-tenue">Cargando…</p>}
      {cola && cola.length === 0 && (
        <p className="font-mono text-body text-texto-tenue">No hay cursos esperando revisión.</p>
      )}

      {cola && cola.length > 0 && (
        <div className="flex flex-col gap-aire-m">
          {cola.map((c) => (
            <FilaRevision key={c.id} curso={c} />
          ))}
        </div>
      )}
    </div>
  )
}

function FilaRevision({ curso }: { curso: AuthoringCourse }) {
  const { take, approve, reject } = useReviewActions(curso.id)
  const [rechazando, setRechazando] = useState(false)
  const [notas, setNotas] = useState('')

  const err = take.error ?? approve.error ?? reject.error

  return (
    <article className="flex flex-col gap-aire-s rounded border border-linea bg-superficie-1 p-aire-m">
      <div className="flex items-start justify-between gap-aire-s">
        <div className="flex flex-col gap-aire-xs">
          <div className="flex items-center gap-aire-s">
            <h2 className="m-0 font-mono text-h-s font-normal text-contenido">{curso.title}</h2>
            <EstadoBadge status={curso.status} />
          </div>
          {curso.description && (
            <p className="m-0 font-mono text-body-s text-texto-tenue">{curso.description}</p>
          )}
          <p className="m-0 font-mono text-eyebrow uppercase tracking-label text-texto-debil">
            {curso.requiredLevelRank ? `Nivel ${curso.requiredLevelRank}` : 'Abierto'}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-aire-s border-t border-linea pt-aire-s">
        {curso.status === 'SUBMITTED' && (
          <Boton variante="nav" onClick={() => take.mutate()} disabled={take.isPending}>
            {take.isPending ? 'Tomando…' : 'Tomar para revisar'}
          </Boton>
        )}

        {curso.status === 'UNDER_REVIEW' && !rechazando && (
          <>
            <Boton onClick={() => approve.mutate(null)} disabled={approve.isPending}>
              {approve.isPending ? 'Aprobando…' : 'Aprobar'}
            </Boton>
            <Boton variante="nav" onClick={() => setRechazando(true)}>
              Rechazar
            </Boton>
          </>
        )}
      </div>

      {rechazando && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (notas.trim().length < 1) return
            reject.mutate(notas.trim(), { onSuccess: () => setRechazando(false) })
          }}
          className="flex flex-col gap-aire-xs"
        >
          <label className="font-mono text-eyebrow uppercase tracking-label text-texto-tenue">
            Notas del rechazo (obligatorias)
          </label>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={2}
            placeholder="Qué debe corregir el maestro"
            className="resize-none rounded border border-linea bg-superficie-2 px-aire-s py-aire-xs font-mono text-body-s text-contenido placeholder:text-texto-debil focus:border-contenido"
          />
          <div className="flex gap-aire-s">
            <Boton type="submit" disabled={reject.isPending || notas.trim().length < 1}>
              {reject.isPending ? 'Rechazando…' : 'Confirmar rechazo'}
            </Boton>
            <Boton variante="sutil" onClick={() => setRechazando(false)}>
              Cancelar
            </Boton>
          </div>
        </form>
      )}

      {err instanceof Error && (
        <p role="alert" className="m-0 font-mono text-body-s text-vino">
          {err.message}
        </p>
      )}
    </article>
  )
}
