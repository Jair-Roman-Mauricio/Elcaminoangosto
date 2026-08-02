import { forwardRef } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { clasesDeBoton, type BotonVariante } from '@elcamino/ui'

export interface BotonEnlaceProps extends LinkProps {
  variante?: BotonVariante
}

/**
 * Enlace del router con la apariencia de un `Boton`. Componente de la app (sabe
 * de rutas) que reutiliza la receta del sistema de diseño, en vez de repetir
 * las clases de la píldora en cada página (AGENTS.md §4.1).
 */
export const BotonEnlace = forwardRef<HTMLAnchorElement, BotonEnlaceProps>(function BotonEnlace(
  { variante = 'formulario', className, ...props },
  ref,
) {
  return <Link ref={ref} className={clasesDeBoton(variante, className)} {...props} />
})
