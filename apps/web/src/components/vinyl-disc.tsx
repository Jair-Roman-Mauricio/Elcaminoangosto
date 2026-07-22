import type { CSSProperties } from 'react'

type VinylDiscProps = {
  artwork: string
  color: string
  label: string
  spinning?: boolean
  className?: string
}

/** Vinilo 2D con portada impresa, surcos y centro perforado. */
export function VinylDisc({ artwork, color, label, spinning = false, className = '' }: VinylDiscProps) {
  return (
    <span
      className={`vinyl-disc${spinning ? ' is-spinning' : ''}${className ? ` ${className}` : ''}`}
      style={{ '--vinyl-color': color } as CSSProperties}
      role="img"
      aria-label={label}
    >
      <img className="vinyl-disc__artwork" src={artwork} alt="" />
      <span className="vinyl-disc__grooves" aria-hidden="true" />
      <span className="vinyl-disc__label" aria-hidden="true" />
      <span className="vinyl-disc__hole" aria-hidden="true" />
      <span className="vinyl-disc__shine" aria-hidden="true" />
    </span>
  )
}
