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
        <h1 className="m-0 font-mono text-h-l font-normal text-hueso">Catálogo de cursos</h1>
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

  const eyebrow = [
    curso.requiredLevelRank ? `Nivel ${curso.requiredLevelRank}` : 'Abierto',
    curso.isFree ? 'Gratis' : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const abrir = () => navigate(`/discipulado/${curso.slug}`)

  return (
    <Card
      eyebrow={eyebrow}
      titulo={curso.title}
      meta={`${curso.teacherName} · ${curso.lessonCount} lecciones`}
      onClick={curso.unlocked ? abrir : undefined}
      className={curso.unlocked ? '' : 'opacity-60'}
    >
      {curso.description && (
        <p className="m-0 line-clamp-2 font-mono text-body-s text-texto-tenue">{curso.description}</p>
      )}

      {!curso.unlocked && curso.lockedReason && (
        <p className="m-0 flex items-center gap-2 font-mono text-eyebrow uppercase tracking-label text-aviso">
          <span aria-hidden>🔒</span> {curso.lockedReason}
        </p>
      )}

      {curso.unlocked && (
        <div className="mt-aire-xs">
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
              className="font-mono text-eyebrow uppercase tracking-label text-hueso underline decoration-vino underline-offset-4 hover:text-vino disabled:opacity-50"
            >
              {enroll.isPending ? 'Inscribiendo…' : 'Inscribirme'}
            </button>
          )}
        </div>
      )}
    </Card>
  )
}

const Estado = ({ children }: { children: string }) => (
  <p className="py-aire-l text-center font-mono text-body text-texto-tenue">{children}</p>
)
