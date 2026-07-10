import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { useReducedMotion } from '../lib/use-reduced-motion'

const EASE = [0.22, 0.61, 0.36, 1] as const

export interface RevealProps {
  children: ReactNode
  /** Retardo en segundos, para escalonar bloques. */
  delay?: number
  className?: string
}

/**
 * Reveal on scroll: fade + translateY con la curva del sistema.
 * Origen: la entrada de `.overlay__inner` en la landing.
 *
 * Con `prefers-reduced-motion` el contenido aparece ya montado, sin animar.
 */
export function Reveal({ children, delay = 0, className }: RevealProps) {
  const reduced = useReducedMotion()

  if (reduced) return <div className={className}>{children}</div>

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.9, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  )
}
