import type { ReactNode } from 'react'

/**
 * Entrada compositada de una pantalla. Se limita a opacity + transform para no
 * crear máscaras de pintura completa ni mantener Framer en el shell inicial.
 */
export function PageTransition({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={['page-transition', className].filter(Boolean).join(' ')}>{children}</div>
}
