import type { ReactNode } from 'react'
import { cn } from '../lib/cn'
import { Eyebrow } from './eyebrow'

export interface CardProps {
  /** Categoría en eyebrow: "DISCIPULADO", "NIVEL 3", "ALABANZA"… */
  eyebrow?: string
  titulo: string
  meta?: string
  /** URL de la miniatura. Si falta, se reserva el hueco (evita CLS). */
  thumbnailUrl?: string
  /** Obligatorio si hay thumbnail (RNF-6). */
  thumbnailAlt?: string
  /** Si se pasa, la tarjeta es interactiva (rol button + teclado). */
  onClick?: (() => void) | undefined
  children?: ReactNode
  className?: string
}

/**
 * Tarjeta editorial. Base de: tarjeta de curso, de canción y de fe.
 * Jerarquía por tipografía y espacio; sin sombras (DESIGN.md §8).
 */
export function Card({
  eyebrow,
  titulo,
  meta,
  thumbnailUrl,
  thumbnailAlt,
  onClick,
  children,
  className,
}: CardProps) {
  const interactiva = Boolean(onClick)

  return (
    <article
      className={cn(
        'group flex flex-col gap-aire-s rounded bg-superficie-1 p-aire-s',
        'border border-linea transition-colors duration-fade ease-camino',
        interactiva && 'cursor-pointer hover:border-linea-fuerte',
        className,
      )}
      {...(interactiva
        ? {
            role: 'button',
            tabIndex: 0,
            onClick,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick?.()
              }
            },
          }
        : {})}
    >
      <div className="aspect-video w-full overflow-hidden rounded bg-superficie-2">
        {thumbnailUrl && (
          <img
            src={thumbnailUrl}
            alt={thumbnailAlt ?? ''}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        )}
      </div>

      <div className="flex flex-col gap-aire-xs">
        {eyebrow && <Eyebrow rule={false}>{eyebrow}</Eyebrow>}
        <h3 className="m-0 font-mono text-h-s font-normal text-hueso">{titulo}</h3>
        {meta && <p className="m-0 font-mono text-body-s text-texto-tenue">{meta}</p>}
        {children}
      </div>
    </article>
  )
}
