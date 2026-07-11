import type { ReactNode } from 'react'
import { cn } from '../lib/cn'
import { Eyebrow } from './eyebrow'

export interface CardProps {
  /** Categoría en eyebrow: "DISCIPULADO", "NIVEL 3", "ALABANZA"… */
  eyebrow?: string
  titulo: string
  meta?: string
  /** URL de la miniatura. Si falta, se usa `media` o un placeholder. */
  thumbnailUrl?: string
  /** Obligatorio si hay thumbnail (RNF-6). */
  thumbnailAlt?: string
  /** Contenido a medida para la mitad superior (placeholder de curso, etc.). */
  media?: ReactNode
  /** Si se pasa, la tarjeta es interactiva (rol button + teclado). */
  onClick?: (() => void) | undefined
  children?: ReactNode
  className?: string
}

/**
 * Tarjeta editorial de media (estilo catálogo): la mitad superior es la
 * imagen —a ras del borde—, la inferior la información. Base de la tarjeta de
 * curso, de canción y de fe. Jerarquía por tipografía y espacio, sin sombras
 * (DESIGN.md §8).
 */
export function Card({
  eyebrow,
  titulo,
  meta,
  thumbnailUrl,
  thumbnailAlt,
  media,
  onClick,
  children,
  className,
}: CardProps) {
  const interactiva = Boolean(onClick)

  return (
    <article
      className={cn(
        'group flex flex-col overflow-hidden rounded bg-superficie-1',
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
      {/* Mitad superior: imagen a ras del borde. */}
      <div className="aspect-[16/10] w-full overflow-hidden bg-superficie-2">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={thumbnailAlt ?? ''}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-fade ease-camino group-hover:scale-[1.03]"
          />
        ) : (
          (media ?? <PlaceholderMedia titulo={titulo} />)
        )}
      </div>

      {/* Mitad inferior: información. */}
      <div className="flex flex-1 flex-col gap-aire-xs p-aire-s">
        {eyebrow && <Eyebrow rule={false}>{eyebrow}</Eyebrow>}
        <h3 className="m-0 font-mono text-h-s font-normal leading-tight text-hueso">{titulo}</h3>
        {meta && <p className="m-0 font-mono text-body-s text-texto-tenue">{meta}</p>}
        {children}
      </div>
    </article>
  )
}

/**
 * Placeholder por defecto cuando no hay miniatura: fondo oscuro con una
 * inicial ghosteada. Usa solo tokens del sistema (nada de color extra).
 */
function PlaceholderMedia({ titulo }: { titulo: string }) {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br from-superficie-2 to-negro">
      <span
        aria-hidden
        className="select-none font-mono text-[6rem] font-bold leading-none text-hueso/[0.06]"
      >
        {titulo.trim().charAt(0).toUpperCase() || '·'}
      </span>
      <span aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-vino/40" />
    </div>
  )
}
