import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

export interface NavProps {
  marca: ReactNode
  /** Enlaces centrales. */
  children?: ReactNode
  /** Zona derecha: CTA, avatar, etc. */
  acciones?: ReactNode
  className?: string
}

/**
 * Barra fija superior. Origen: `.nav` de la landing.
 *
 * No tiene altura fija: el padding es fluido y respeta el notch
 * (`env(safe-area-inset-top)`). Ver DESIGN.md §6.
 */
export function Nav({ marca, children, acciones, className }: NavProps) {
  return (
    <nav
      className={cn(
        'fixed inset-x-0 top-0 z-30 flex items-center justify-between gap-aire-m',
        'px-gutter py-[clamp(1.1rem,2.4vw,2rem)]',
        'pt-[max(clamp(1.1rem,2.4vw,2rem),env(safe-area-inset-top))]',
        className,
      )}
    >
      <div className="font-mono text-body-s uppercase tracking-label text-contenido">{marca}</div>

      {children && (
        <div className="flex items-center gap-[clamp(1rem,2.5vw,2.25rem)]">{children}</div>
      )}

      {acciones && <div className="flex items-center gap-aire-s">{acciones}</div>}
    </nav>
  )
}

/** Enlace del nav: mono, uppercase, tenue → hueso en hover. */
export function NavLink({
  children,
  className,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      className={cn(
        'font-mono text-label uppercase tracking-label text-texto-tenue no-underline',
        'transition-colors duration-fade ease-camino hover:text-contenido',
        className,
      )}
      {...props}
    >
      {children}
    </a>
  )
}
