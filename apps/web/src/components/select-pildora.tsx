import { forwardRef, type SelectHTMLAttributes } from 'react'
import { cn } from '@elcamino/ui'

export type SelectPildoraTono = 'acento' | 'contorno'

export interface SelectPildoraProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** `acento` para el dato que gobierna la fila; `contorno` para el secundario. */
  tono?: SelectPildoraTono
}

/**
 * Select en forma de píldora para editar un dato **dentro de una fila de tabla**
 * (el rol o el nivel de un usuario). Es un `<select>` nativo —teclado, búsqueda
 * por letra y hoja nativa en móvil— con la flecha propia, porque `appearance:
 * none` se lleva la del sistema.
 *
 * Vive en la app y no en `packages/ui` porque es un control de tabla de datos,
 * no una pieza del sistema de diseño; si aparece un tercer uso, se sube.
 */
const base =
  'w-full cursor-pointer appearance-none rounded-full py-[0.35rem] pl-[1.1rem] pr-[2.2rem] ' +
  'font-mono text-body-s outline-none transition-colors duration-fade ease-camino ' +
  'disabled:cursor-not-allowed disabled:opacity-60'

const tonos: Record<SelectPildoraTono, string> = {
  acento: 'border border-acento bg-oro brillo-oro text-sobreoro',
  contorno: 'border border-linea-fuerte bg-transparent text-contenido hover:border-acento',
}

export const SelectPildora = forwardRef<HTMLSelectElement, SelectPildoraProps>(
  function SelectPildora({ tono = 'acento', className, children, ...props }, ref) {
    return (
      <span className="relative inline-block w-fit">
        <select ref={ref} className={cn(base, tonos[tono], className)} {...props}>
          {children}
        </select>
        <svg
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute right-[0.9rem] top-1/2 size-3.5 -translate-y-1/2',
            tono === 'acento' ? 'text-hueso' : 'text-texto-tenue',
          )}
          viewBox="0 0 24 24"
          fill="none"
        >
          <path
            d="m6 9 6 6 6-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    )
  },
)
