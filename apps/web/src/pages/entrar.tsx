import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Navigate, useLocation } from 'react-router-dom'
import { z } from 'zod'
import { Boton, Eyebrow } from '@elcamino/ui'
import { supabase } from '../lib/supabase'
import { useSession } from '../auth/session'

const CredencialesSchema = z.object({
  email: z.string().email('Introduce un correo válido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  displayName: z.string().min(1).max(60).optional(),
})
type Credenciales = z.infer<typeof CredencialesSchema>

type Modo = 'entrar' | 'registrarse'

/**
 * HU-0.2. El registro crea la cuenta en Supabase Auth; el trigger
 * `crear_perfil_al_registrarse` inserta la fila en `profiles` con rol
 * ESTUDIANTE. El front nunca decide el rol.
 */
export function EntrarPage() {
  const [modo, setModo] = useState<Modo>('entrar')
  const [errorServidor, setErrorServidor] = useState<string | null>(null)
  const { session } = useSession()
  const location = useLocation()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Credenciales>({ resolver: zodResolver(CredencialesSchema) })

  if (session) {
    const destino = (location.state as { desde?: string } | null)?.desde ?? '/discipulado'
    return <Navigate to={destino} replace />
  }

  const enviar = async ({ email, password, displayName }: Credenciales) => {
    setErrorServidor(null)

    const { error } =
      modo === 'entrar'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { data: { display_name: displayName ?? email.split('@')[0] } },
          })

    if (error) setErrorServidor(error.message)
  }

  return (
    <main className="grid min-h-screen place-items-center bg-negro px-gutter">
      <div className="flex w-full max-w-sm flex-col gap-aire-m">
        <header className="flex flex-col gap-aire-xs">
          <Eyebrow>{modo === 'entrar' ? 'Iniciar sesión' : 'Crear cuenta'}</Eyebrow>
          <h1 className="m-0 font-mono text-h-m font-normal text-hueso">El Camino Angosto</h1>
        </header>

        <form onSubmit={handleSubmit(enviar)} className="flex flex-col gap-aire-s" noValidate>
          {modo === 'registrarse' && (
            <Campo
              id="displayName"
              label="Nombre"
              type="text"
              error={errors.displayName?.message}
              {...register('displayName')}
            />
          )}

          <Campo
            id="email"
            label="Correo"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email')}
          />

          <Campo
            id="password"
            label="Contraseña"
            type="password"
            autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
            error={errors.password?.message}
            {...register('password')}
          />

          {errorServidor && (
            <p role="alert" className="m-0 font-mono text-body-s text-vino">
              {errorServidor}
            </p>
          )}

          <Boton type="submit" disabled={isSubmitting} className="mt-aire-xs w-full">
            {isSubmitting ? 'Un momento…' : modo === 'entrar' ? 'Entrar' : 'Registrarme'}
          </Boton>
        </form>

        <Boton
          variante="sutil"
          onClick={() => {
            setModo(modo === 'entrar' ? 'registrarse' : 'entrar')
            setErrorServidor(null)
          }}
          className="self-center"
        >
          {modo === 'entrar' ? '¿No tienes cuenta? Regístrate' : 'Ya tengo cuenta'}
        </Boton>
      </div>
    </main>
  )
}

// `ComponentPropsWithRef` (no `InputHTMLAttributes`): react-hook-form pasa un
// `ref` en el objeto de `register()`. React 19 lo acepta como prop normal.
interface CampoProps extends React.ComponentPropsWithRef<'input'> {
  id: string
  label: string
  error?: string | undefined
}

const Campo = ({ id, label, error, ...props }: CampoProps) => (
  <div className="flex flex-col gap-aire-xs">
    <label htmlFor={id} className="font-mono text-eyebrow uppercase tracking-label text-texto-tenue">
      {label}
    </label>
    <input
      id={id}
      aria-invalid={Boolean(error)}
      aria-describedby={error ? `${id}-error` : undefined}
      className="rounded border border-linea bg-transparent px-aire-s py-aire-xs font-mono text-body text-hueso transition-colors duration-fade ease-camino focus:border-hueso"
      {...props}
    />
    {error && (
      <p id={`${id}-error`} role="alert" className="m-0 font-mono text-body-s text-vino">
        {error}
      </p>
    )}
  </div>
)
