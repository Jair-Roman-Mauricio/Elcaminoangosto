import { forwardRef, type ReactNode } from 'react'
import { cn } from '../lib/cn'

/**
 * Controles de formulario reutilizables y theme-aware (DESIGN.md §6).
 * Un solo lugar define el estilo: borde `linea`, fondo transparente, foco al
 * color de contenido. Adaptan al tema (claro/oscuro) sin tocar cada página.
 */

const controlBase = cn(
  'w-full rounded border bg-transparent px-aire-s py-aire-xs',
  'font-mono text-body text-contenido placeholder:text-texto-debil',
  'transition-colors duration-fade ease-camino',
  // Foco visible al color de contenido; error en vino.
  'focus:border-contenido focus:outline-none',
  'aria-[invalid=true]:border-vino',
)

export interface FieldProps {
  label?: string
  htmlFor?: string
  error?: string | undefined
  /** Texto de ayuda bajo la etiqueta. */
  hint?: string
  children: ReactNode
  className?: string
}

/** Envoltorio etiqueta + control + error. Estructura accesible consistente. */
export function Field({ label, htmlFor, error, hint, children, className }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-aire-xs', className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="font-mono text-eyebrow uppercase tracking-label text-texto-tenue"
        >
          {label}
        </label>
      )}
      {hint && <p className="m-0 font-mono text-body-s text-texto-debil">{hint}</p>}
      {children}
      {error && (
        <p role="alert" className="m-0 font-mono text-body-s text-vino">
          {error}
        </p>
      )}
    </div>
  )
}

export type InputProps = React.ComponentPropsWithRef<'input'>

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(controlBase, className)} {...props} />
})

export type TextareaProps = React.ComponentPropsWithRef<'textarea'>

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, ...props },
  ref,
) {
  return <textarea ref={ref} className={cn(controlBase, 'resize-none', className)} {...props} />
})

export type SelectProps = React.ComponentPropsWithRef<'select'>

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, ...props },
  ref,
) {
  // El select nativo necesita fondo opaco para que el desplegable se lea bien.
  return (
    <select
      ref={ref}
      className={cn(controlBase, 'cursor-pointer bg-superficie-1', className)}
      {...props}
    />
  )
})
