import { cn } from '@elcamino/ui'

interface CourseAccessBadgesProps {
  isFree: boolean
  requiredLevelRank: number | null
  className?: string
}

/** Etiquetas de acceso compartidas por la tarjeta y el canvas del maestro. */
export function CourseAccessBadges({
  isFree,
  requiredLevelRank,
  className,
}: CourseAccessBadgesProps) {
  return (
    <div
      className={cn('flex flex-wrap items-center gap-2', className)}
      role="group"
      aria-label="Condiciones de acceso"
    >
      {isFree && (
        <span className="rounded-sm bg-vino px-3 py-1.5 font-mono text-eyebrow font-bold uppercase tracking-label text-hueso">
          Gratis
        </span>
      )}
      <span className="rounded-sm bg-marino/25 px-3 py-1.5 font-mono text-eyebrow font-bold uppercase tracking-label text-contenido">
        {requiredLevelRank ? `Nivel ${requiredLevelRank}` : 'Abierto'}
      </span>
    </div>
  )
}
