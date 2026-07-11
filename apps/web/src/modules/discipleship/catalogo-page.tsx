import { useNavigate } from 'react-router-dom'
import { Card, Eyebrow, Reveal } from '@elcamino/ui'
import { useCatalog, useEnroll, type CatalogItem } from './api'

/**
 * Catálogo de cursos por nivel (HU-4.1). Los cursos de nivel superior se
 * muestran bloqueados con su motivo, no se ocultan.
 */
export function CatalogoPage() {
  const { data: cursos, isPending, isError } = useCatalog()

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-aire-l py-aire-m">
      <header className="flex flex-col gap-aire-xs">
        <Eyebrow>Discipulado</Eyebrow>
        <h1 className="m-0 font-mono text-h-l font-normal text-contenido">Catálogo de cursos</h1>
        <p className="m-0 font-mono text-body text-texto-tenue">
          Cursos de tu nivel y anteriores. Los de nivel superior se desbloquean al avanzar.
        </p>
      </header>

      {isPending && <Estado>Cargando el catálogo…</Estado>}
      {isError && <Estado>No se pudo cargar el catálogo.</Estado>}

      {cursos && cursos.length === 0 && <Estado>Aún no hay cursos publicados.</Estado>}

      {cursos && cursos.length > 0 && (
        <div className="grid gap-aire-m sm:grid-cols-2 md:grid-cols-3">
          {cursos.map((c, i) => (
            <Reveal key={c.id} delay={i * 0.05}>
              <CursoCard curso={c} />
            </Reveal>
          ))}
        </div>
      )}
    </div>
  )
}

function CursoCard({ curso }: { curso: CatalogItem }) {
  const navigate = useNavigate()
  const enroll = useEnroll()

  const nivel = curso.requiredLevelRank ? `Nivel ${curso.requiredLevelRank}` : 'Abierto'
  const abrir = () => navigate(`/discipulado/${curso.slug}`)

  return (
    <Card
      titulo={curso.title}
      meta={`${curso.teacherName} · ${curso.lessonCount} lecciones`}
      media={<CursoMedia nivel={nivel} bloqueado={!curso.unlocked} />}
      onClick={curso.unlocked ? abrir : undefined}
      className={curso.unlocked ? '' : 'opacity-70'}
    >
      {curso.description && (
        <p className="m-0 line-clamp-2 font-mono text-body-s text-texto-tenue">{curso.description}</p>
      )}

      {!curso.unlocked && curso.lockedReason && (
        <p className="m-0 mt-auto flex items-center gap-2 pt-aire-xs font-mono text-eyebrow uppercase tracking-label text-aviso">
          <span aria-hidden>🔒</span> {curso.lockedReason}
        </p>
      )}

      {curso.unlocked && (
        <div className="mt-auto pt-aire-xs">
          {curso.enrolled ? (
            <button
              type="button"
              onClick={abrir}
              className="font-mono text-eyebrow uppercase tracking-label text-exito"
            >
              Inscrito · Continuar →
            </button>
          ) : (
            <button
              type="button"
              disabled={enroll.isPending}
              onClick={(e) => {
                e.stopPropagation()
                enroll.mutate(curso.id, { onSuccess: abrir })
              }}
              className="font-mono text-eyebrow uppercase tracking-label text-contenido underline decoration-vino underline-offset-4 hover:text-vino disabled:opacity-50"
            >
              {enroll.isPending ? 'Inscribiendo…' : 'Inscribirme'}
            </button>
          )}
        </div>
      )}
    </Card>
  )
}

/** Placeholder de la mitad superior mientras los cursos no traen miniatura. */
function CursoMedia({ nivel, bloqueado }: { nivel: string; bloqueado: boolean }) {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br from-marino/40 via-superficie-2 to-negro">
      {/* Cruz bajo arco, el motivo de la marca. */}
      <svg viewBox="0 0 48 48" fill="none" aria-hidden className="h-14 w-14 text-contenido/[0.18]">
        <path d="M10 46V20a14 14 0 0 1 28 0v26" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" />
        <path d="M24 12v26M16 21h16" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" />
      </svg>
      <span className="absolute left-aire-s top-aire-s font-mono text-eyebrow uppercase tracking-label text-contenido/70">
        {nivel}
      </span>
      {bloqueado && (
        <span aria-hidden className="absolute right-aire-s top-aire-s text-body">
          🔒
        </span>
      )}
    </div>
  )
}

const Estado = ({ children }: { children: string }) => (
  <p className="py-aire-l text-center font-mono text-body text-texto-tenue">{children}</p>
)
