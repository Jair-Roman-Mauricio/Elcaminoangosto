import { motion } from 'framer-motion'
import { cn } from '../lib/cn'
import { useReducedMotion } from '../lib/use-reduced-motion'

/** Curva única del sistema: ease-out lento, sin rebote (DESIGN.md §5). */
const EASE = [0.22, 0.61, 0.36, 1] as const

export interface PlayPauseProps {
  reproduciendo: boolean
  onToggle: () => void
  /** Diámetro en px. */
  size?: number
  className?: string
}

/**
 * Morph play ⇄ pause. Reutilizable en la player bar (música) y en el feed.
 * Las dos barras de "pause" se separan y la punta del triángulo se retrae.
 */
export function PlayPause({ reproduciendo, onToggle, size = 44, className }: PlayPauseProps) {
  const reduced = useReducedMotion()
  const transition = reduced ? { duration: 0 } : { duration: 0.35, ease: EASE }

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={reproduciendo ? 'Pausar' : 'Reproducir'}
      aria-pressed={reproduciendo}
      className={cn(
        'grid place-items-center rounded-full border border-linea-fuerte',
        'transition-colors duration-fade ease-camino hover:border-vino hover:bg-vino',
        className,
      )}
      style={{ width: size, height: size }}
    >
      <motion.svg
        width={size * 0.4}
        height={size * 0.4}
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden
        transition={transition}
      >
        {/* Izquierda: barra de pause ⇄ mitad superior del triángulo */}
        <motion.path
          animate={{ d: reproduciendo ? 'M5 3 H9 V21 H5 Z' : 'M5 3 L20 12 L20 12 L5 12 Z' }}
          transition={transition}
        />
        {/* Derecha: barra de pause ⇄ mitad inferior del triángulo */}
        <motion.path
          animate={{ d: reproduciendo ? 'M15 3 H19 V21 H15 Z' : 'M5 12 L20 12 L20 12 L5 21 Z' }}
          transition={transition}
        />
      </motion.svg>
    </button>
  )
}

export interface ProgressBarProps {
  /** Segundos reproducidos. */
  value: number
  /** Duración total en segundos. */
  max: number
  onSeek?: (seconds: number) => void
  className?: string
}

export function ProgressBar({ value, max, onSeek, className }: ProgressBarProps) {
  const pct = max > 0 ? (value / max) * 100 : 0

  return (
    <input
      type="range"
      min={0}
      max={max || 1}
      step={0.1}
      value={value}
      disabled={!onSeek}
      onChange={(e) => onSeek?.(Number(e.target.value))}
      aria-label="Progreso"
      aria-valuetext={`${formatTime(value)} de ${formatTime(max)}`}
      className={cn('h-1 w-full cursor-pointer appearance-none rounded bg-linea', className)}
      style={{
        background: `linear-gradient(to right, var(--vino) ${pct}%, var(--linea) ${pct}%)`,
      }}
    />
  )
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
