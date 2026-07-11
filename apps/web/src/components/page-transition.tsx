import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

/** Curva única del sistema: ease-out lento, sin rebote (DESIGN.md §5). */
const EASE = [0.22, 0.61, 0.36, 1] as const

/**
 * Anima la entrada de una pantalla al montarse: fade + leve translateY.
 * Da la sensación de transición al pasar de la landing al login y del login a
 * la plataforma.
 *
 * `MotionConfig reducedMotion="user"` (en main.tsx) neutraliza el movimiento
 * para quien lo pida (RNF-6): el contenido aparece sin desplazarse.
 */
export function PageTransition({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}
