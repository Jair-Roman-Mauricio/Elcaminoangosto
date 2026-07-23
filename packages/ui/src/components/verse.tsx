import { cn } from '../lib/cn'

export interface VerseProps {
  children: string
  /** Referencia bíblica, p. ej. "Mateo 7:13–14". */
  referencia?: string
  className?: string
  /** Tratamiento de alto contraste para fotografías de fondo. */
  variante?: 'default' | 'login'
}

/**
 * Versículo. **El único lugar donde se usa el serif** (DESIGN.md §8).
 * Origen: `.overlay__verse` + `.overlay__ref` de la landing.
 */
export function Verse({ children, referencia, className, variante = 'default' }: VerseProps) {
  return (
    <figure className={cn('m-0 flex flex-col gap-aire-s', className)}>
      <blockquote
        className={cn(
          'm-0 font-serif text-verse font-light',
          variante === 'login'
            ? 'text-hueso underline decoration-vino decoration-2 underline-offset-[0.22em]'
            : 'text-contenido/[0.88]',
        )}
      >
        {children}
      </blockquote>
      {referencia && (
        <figcaption className="font-mono text-eyebrow uppercase tracking-label text-texto-tenue">
          {referencia}
        </figcaption>
      )}
    </figure>
  )
}
