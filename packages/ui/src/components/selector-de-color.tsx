import { cn } from '../lib/cn'

export interface ColorDeMarca {
  /** Valor hexadecimal que se guarda. */
  valor: string
  /** Nombre legible: lo que se lee y lo que oye un lector de pantalla. */
  nombre: string
}

/**
 * Paleta de la marca (DESIGN.md §2) más los tonos de materia que acompañan a
 * los acentos: madera, piedra y tinta. Son los colores con los que ya está
 * pintada la plataforma, así que cualquiera de ellos combina.
 */
export const COLORES_DE_MARCA: ColorDeMarca[] = [
  { valor: '#0a0a0a', nombre: 'Negro' },
  { valor: '#111114', nombre: 'Tinta' },
  { valor: '#e3ac33', nombre: 'Oro' },
  { valor: '#0c1322', nombre: 'Noche' },
  { valor: '#173f65', nombre: 'Azul profundo' },
  { valor: '#2e7d5b', nombre: 'Verde' },
  { valor: '#8f6f45', nombre: 'Madera' },
  { valor: '#c9862b', nombre: 'Ámbar' },
  { valor: '#f7f6f2', nombre: 'Hueso' },
]

export interface SelectorDeColorProps {
  /** Hexadecimal seleccionado, o `null` si no hay ninguno. */
  valor: string | null
  onCambiar: (valor: string) => void
  disabled?: boolean
  /** Se anuncia al grupo de opciones. */
  etiqueta: string
  className?: string
}

/**
 * Elige un color de la paleta de la marca. Sustituye a escribir un hexadecimal
 * a mano: quien publica contenido no tiene por qué saber que `#8f6f45` es
 * madera, ni acertar un color que combine con el resto de la plataforma.
 *
 * Es un grupo de radios de verdad (`role="radiogroup"`), así que funciona con
 * teclado y se anuncia bien; el color va en el fondo de cada opción y el nombre
 * en su `title` y en el texto accesible.
 */
export function SelectorDeColor({
  valor,
  onCambiar,
  disabled = false,
  etiqueta,
  className,
}: SelectorDeColorProps) {
  return (
    <div
      role="radiogroup"
      aria-label={etiqueta}
      className={cn('flex flex-wrap items-center gap-aire-xs', className)}
    >
      {COLORES_DE_MARCA.map((color) => {
        const activo = valor?.toLowerCase() === color.valor.toLowerCase()
        return (
          <button
            key={color.valor}
            type="button"
            role="radio"
            aria-checked={activo}
            aria-label={color.nombre}
            title={color.nombre}
            disabled={disabled}
            onClick={() => onCambiar(color.valor)}
            className={cn(
              'size-8 rounded-full border transition-[box-shadow,border-color] duration-fade ease-camino',
              'disabled:cursor-not-allowed disabled:opacity-40',
              // El anillo marca la selección sin depender del color elegido,
              // que puede ser casi idéntico al fondo (hueso sobre blanco).
              activo
                ? 'border-acento shadow-[0_0_0_3px_color-mix(in_srgb,var(--acento)_28%,transparent)]'
                : 'border-linea-fuerte hover:border-acento',
            )}
            style={{ background: color.valor }}
          />
        )
      })}
    </div>
  )
}
