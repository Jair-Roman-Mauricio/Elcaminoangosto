import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '../lib/cn'

export type BotonVariante = 'primary' | 'sutil' | 'nav' | 'formulario'

export interface BotonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: BotonVariante
}

/**
 * Origen: `.boton`, `.boton--sutil` y `.nav__cta` de la landing.
 *
 * El hover es un **fill** hacia `vino` (no un wipe de subrayado), con la
 * transición larga y sin rebote de `--ease`. Ver DESIGN.md §5.
 */
const base =
  'inline-flex items-center justify-center font-mono uppercase no-underline ' +
  'transition-[color,background-color,border-color] duration-fade ease-camino ' +
  'motion-reduce:duration-fade-corto disabled:opacity-40 disabled:pointer-events-none'

const variantes: Record<BotonVariante, string> = {
  // El texto base usa el token temático; en hover se rellena de vino y el
  // texto pasa a `hueso` (blanco fijo sobre el acento, en ambos temas).
  primary: cn(
    'text-label tracking-boton text-contenido',
    'px-[2.4rem] py-[1.05rem] rounded',
    'border border-linea-fuerte bg-transparent',
    'hover:border-vino hover:bg-vino hover:text-hueso',
  ),
  sutil: cn(
    'text-label tracking-boton text-texto-tenue',
    'px-0 py-[0.6rem] border-0 bg-transparent',
    'underline underline-offset-[0.45em] decoration-linea',
    'hover:text-contenido hover:decoration-marino',
  ),
  nav: cn(
    'text-label tracking-boton text-contenido',
    'px-[1.1rem] py-[0.6rem] rounded',
    'border border-linea bg-transparent',
    'hover:border-vino hover:bg-vino/10',
  ),
  formulario: cn(
    'rounded-full border-vino bg-vino px-[2.4rem] py-[1.05rem]',
    'font-ui text-body-s font-medium tracking-boton text-hueso',
  ),
}

export const Boton = forwardRef<HTMLButtonElement, BotonProps>(function Boton(
  { variante = 'primary', className, type = 'button', ...props },
  ref,
) {
  return (
    <button ref={ref} type={type} className={cn(base, variantes[variante], className)} {...props} />
  )
})
