import { cn } from '../lib/cn'

export type BrandLogoLayout = 'horizontal' | 'stacked'
export type BrandLogoTone = 'light' | 'dark' | 'wine' | 'adaptive'
export type BrandLogoSize = 'sm' | 'md' | 'lg'
export type BrandLogoVariante = 'default' | 'sidebar'

export interface BrandLogoProps {
  layout?: BrandLogoLayout
  tone?: BrandLogoTone
  size?: BrandLogoSize
  variante?: BrandLogoVariante
  mostrarNombre?: boolean
  className?: string | undefined
  /** Texto alternativo cuando el logo no es puramente decorativo. */
  decorative?: boolean
}

const toneClasses: Record<BrandLogoTone, string> = {
  light: 'text-hueso',
  dark: 'text-negro',
  wine: 'text-vino',
  adaptive: 'text-contenido',
}

/**
 * Marca principal de El Camino Angosto: una puerta angosta, una cruz y dos
 * líneas que convergen en el camino. Es SVG inline para que conserve nitidez
 * en el nav, el login, el sidebar y el favicon sin depender de una imagen.
 */
export function BrandLogo({
  layout = 'horizontal',
  tone = 'light',
  size = 'md',
  variante = 'default',
  mostrarNombre = true,
  className,
  decorative = false,
}: BrandLogoProps) {
  return (
    <span
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : 'El Camino Angosto'}
      aria-hidden={decorative ? true : undefined}
      className={cn(
        'inline-flex items-center',
        layout === 'stacked' ? 'flex-col gap-aire-s text-center' : variante === 'sidebar' ? 'gap-aire-xs' : 'gap-aire-xs',
        size === 'lg' && layout === 'horizontal' ? 'gap-aire-s' : '',
        toneClasses[tone],
        className,
      )}
    >
      <svg
        viewBox="0 0 64 64"
        fill="none"
        aria-hidden="true"
        focusable="false"
        className={cn(
          'shrink-0',
          layout === 'stacked'
            ? size === 'lg'
              ? 'h-20 w-20'
              : 'h-14 w-14'
            : variante === 'sidebar'
              ? 'h-9 w-9'
              : size === 'lg'
              ? 'h-12 w-12'
              : size === 'sm'
                ? 'h-8 w-8'
                : 'h-10 w-10',
        )}
      >
        <path
          d="M10 57V27C10 12 20 5 32 5s22 7 22 22v30H42L32 46 22 57z"
          fill="currentColor"
        />
        <path d="M32 14v30M22 25h20M32 44 21 56M32 44l11 12" stroke="var(--fondo)" strokeWidth="2.8" strokeLinecap="round" />
      </svg>
      {mostrarNombre && (variante === 'sidebar' ? (
        <span className="font-ui text-body font-semibold leading-none tracking-boton">
          <span className="text-vino">El</span>CaminoAngosto
        </span>
      ) : (
        <span
          className={cn(
            'font-mono tracking-label leading-none',
            layout === 'stacked' ? 'text-h-m' : size === 'lg' ? 'text-h-m' : 'text-body',
          )}
        >
          ElCaminoAngosto
        </span>
      ))}
    </span>
  )
}

export function BrandMark({
  tone = 'light',
  className,
  decorative = false,
}: Omit<BrandLogoProps, 'layout'>) {
  return (
    <BrandLogo
      layout="horizontal"
      tone={tone}
      size="lg"
      className={className}
      decorative={decorative}
      mostrarNombre={false}
    />
  )
}
