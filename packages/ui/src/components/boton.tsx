import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '../lib/cn'

export type BotonVariante =
  | 'primary'
  | 'sutil'
  | 'nav'
  | 'formulario'
  | 'contorno'
  | 'pastilla'
  | 'tarjeta'

export type BotonTamano = 'normal' | 'compacto'

export interface BotonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: BotonVariante
  /**
   * `compacto` para botones que viven dentro de otra pieza —un diálogo, una
   * barra de acciones, una tarjeta estrecha— donde la escala de formulario
   * pesa demasiado. Solo cambia la métrica; el color lo sigue diciendo la
   * variante.
   */
  tamano?: BotonTamano
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
    'whitespace-nowrap rounded-full border border-vino bg-vino px-[2rem] py-[0.85rem]',
    'font-ui text-body-s font-medium tracking-boton text-hueso',
    'hover:bg-transparent hover:text-vino',
  ),
  /**
   * Acción principal de una tarjeta de cola (Revisiones, Moderación): la misma
   * píldora de `formulario`, pero en caja normal. En una tarjeta el botón
   * convive con las etiquetas de estado, que también van en caja normal; las
   * mayúsculas lo convertirían en el elemento más pesado, por encima del título
   * del curso. En los formularios sí manda `formulario`.
   */
  tarjeta: cn(
    'whitespace-nowrap rounded-full border border-vino bg-vino px-[1.6rem] py-[0.7rem]',
    'font-ui text-body-s font-medium normal-case tracking-normal text-hueso',
    // El color no se mueve al pasar el cursor: la tarjeta entera ya es el
    // objetivo y responde por su cuenta; que además parpadeara el botón sería
    // ruido. El puntero basta como señal de que se puede pulsar.
    'hover:border-vino hover:bg-vino hover:text-hueso',
  ),
  // Píldora de contorno: pareja secundaria de `formulario` (misma forma, sin relleno).
  contorno: cn(
    'whitespace-nowrap rounded-full border border-linea-fuerte bg-transparent px-[2rem] py-[0.85rem]',
    'font-ui text-body-s font-medium tracking-boton text-contenido',
    'hover:border-vino hover:text-vino',
  ),
  /**
   * Acciones dentro de una fila de lista (ver, aprobar, retirar). En la fila
   * mandan dos reglas: lo que **se puede hacer** va relleno de vino; lo que
   * **informa** va en contorno (`Chip`). Por eso esta pastilla siempre está
   * rellena y no se vacía al pasar el cursor — a diferencia de `formulario`,
   * cuyo hover invierte el relleno.
   *
   * Caja normal, no mayúsculas: la caja alta la ensancharía hasta darle el peso
   * de un botón principal. Misma métrica que un `Chip` mini, su pareja de fila.
   */
  pastilla: cn(
    'whitespace-nowrap rounded-full border border-vino bg-vino px-[0.9rem] py-[0.3rem]',
    'text-eyebrow normal-case tracking-normal text-hueso',
    'hover:border-vino hover:bg-vino hover:text-hueso',
  ),
}

/**
 * Métrica compacta. Va después de la variante para que `cn` (tailwind-merge)
 * reemplace su acolchado y su tamaño de texto; `pastilla` ya nace compacta y no
 * se toca.
 */
const tamanos: Record<BotonTamano, string> = {
  normal: '',
  compacto: 'px-[1.1rem] py-[0.45rem] text-eyebrow',
}

/**
 * Clases de una variante de botón, para los controles que no son `<button>`
 * (un enlace del router, por ejemplo). El sistema de diseño publica la receta;
 * así un enlace-botón no se maqueta a mano y `packages/ui` sigue sin conocer
 * el router (AGENTS.md §4.1).
 */
export function clasesDeBoton(
  variante: BotonVariante = 'primary',
  className?: string,
  tamano: BotonTamano = 'normal',
): string {
  return cn(base, variantes[variante], tamanos[tamano], className)
}

export const Boton = forwardRef<HTMLButtonElement, BotonProps>(function Boton(
  { variante = 'primary', tamano = 'normal', className, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={clasesDeBoton(variante, className, tamano)}
      {...props}
    />
  )
})
