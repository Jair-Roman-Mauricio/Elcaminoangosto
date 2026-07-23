import { forwardRef, useState, type ComponentPropsWithoutRef } from 'react'
import { Field, Input } from '@elcamino/ui'

interface PasswordFieldProps extends Omit<ComponentPropsWithoutRef<typeof Input>, 'type'> {
  id: string
  label: string
  error?: string | undefined
}

/** Campo de contraseña con control accesible para mostrar u ocultar el valor. */
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(function PasswordField(
  { id, label, error, autoComplete, placeholder, ...props },
  ref,
) {
  const [visible, setVisible] = useState(false)

  return (
    <Field label={label} htmlFor={id} error={error} errorId={error ? `${id}-error` : undefined}>
      <div className="relative">
        <Input
          {...props}
          ref={ref}
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={[
            'w-full rounded-none border-0 border-b px-0 py-aire-xs pr-12',
            'font-ui text-body text-hueso placeholder:text-texto-debil',
            'hover:border-linea-fuerte focus:border-hueso',
            error ? 'border-vino' : 'border-linea',
          ].join(' ')}
        />
        <button
          type="button"
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 grid w-11 place-items-center border-0 bg-transparent text-texto-tenue transition-colors duration-fade hover:text-hueso focus-visible:text-hueso"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setVisible((actual) => !actual)}
        >
          <EyeIcon crossed={visible} />
        </button>
      </div>
    </Field>
  )
})

function EyeIcon({ crossed }: { crossed: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
      <path
        d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.8" stroke="currentColor" strokeWidth="1.6" />
      {crossed && (
        <path d="m4 4 16 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      )}
    </svg>
  )
}
