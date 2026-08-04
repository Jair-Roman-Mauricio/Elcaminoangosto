import { forwardRef, type HTMLAttributes } from 'react'
import { cn } from '../lib/cn'

export type ChipTono = 'neutro' | 'acento'
export type ChipTamano = 'normal' | 'mini'

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  tono?: ChipTono
  /** `mini` para filas de lista, donde la marca acompaña y no encabeza. */
  tamano?: ChipTamano
}

/**
 * Píldora de estado: microlabel mono dentro de un contorno redondo. Es el
 * equivalente estático del `Boton` variante `contorno` y unifica los chips que
 * las páginas venían maquetando a mano (DESIGN.md §3).
 *
 * Va en **caja normal**, no en mayúsculas como el `Eyebrow`: una marca de
 * estado se lee de un vistazo dentro de una tarjeta o una fila, y la caja alta
 * la ensancha hasta darle el peso de un titular. El `tamano` solo cambia el
 * acolchado; nunca la tipografía.
 *
 * Solo tokens semánticos: se lee igual en tema claro y oscuro.
 */
const base =
  'inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border ' +
  'font-mono text-eyebrow'

/**
 * Nunca hay un tono relleno: en esta interfaz **el relleno de oro significa
 * «esto se puede pulsar»** (`Boton`). Una etiqueta rellena se lee como botón y
 * el usuario intenta hacer clic en un estado. Para señalar gravedad, el
 * contorno de acento y, si hace falta más, un punto delante del texto.
 */
const tonos: Record<ChipTono, string> = {
  /** Informativo: no reclama atención. */
  neutro: 'border-linea text-texto-tenue',
  /** Pide atención: pendiente, bloqueado, en espera. */
  acento: 'border-acento text-acento',
}

const tamanos: Record<ChipTamano, string> = {
  normal: 'px-[0.8rem] py-[0.25rem]',
  mini: 'px-[0.7rem] py-[0.2rem]',
}

export const Chip = forwardRef<HTMLSpanElement, ChipProps>(function Chip(
  { tono = 'neutro', tamano = 'normal', className, ...props },
  ref,
) {
  return <span ref={ref} className={cn(base, tonos[tono], tamanos[tamano], className)} {...props} />
})
