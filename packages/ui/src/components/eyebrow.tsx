import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

export interface EyebrowProps {
  children: ReactNode
  /** La regla de 2.5rem que la landing dibuja tras el label. */
  rule?: boolean
  className?: string
}

/**
 * Microlabel mono en mayúsculas — la firma visual del sistema (DESIGN.md §3).
 * Origen: `.overlay__label` de la landing (`CAPÍTULO 01 — EL DESIERTO`).
 */
export function Eyebrow({ children, rule = true, className }: EyebrowProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-3 font-mono text-eyebrow uppercase text-texto-tenue',
        className,
      )}
    >
      {children}
      {rule && <span aria-hidden className="h-px w-10 bg-linea-fuerte" />}
    </span>
  )
}
