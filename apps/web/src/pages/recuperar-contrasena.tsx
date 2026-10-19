import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Boton, Eyebrow, Field, Input } from '@elcamino/ui'
import { PasswordField } from '../components/password-field'
import { authClient, type FalloDeAuth } from '../lib/auth-client'
import { AuthUtilityShell } from './auth-utility-shell'

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function RecuperarContrasenaPage() {
  const [email, setEmail] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const solicitarEnlace = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const correo = email.trim().toLowerCase()
    if (!EMAIL_VALIDO.test(correo)) {
      setError('Introduce un correo válido.')
      return
    }

    setEnviando(true)
    setError(null)
    const { error: errorServidor } = await authClient.requestPasswordReset(correo)
    setEnviando(false)

    if (errorServidor) {
      setError(mensajeRecuperacion(errorServidor))
      return
    }
    setEnviado(true)
  }

  return (
    <AuthUtilityShell leyenda={<>Siempre puedes<br />volver al camino</>}>
      <header className="flex flex-col gap-aire-xs">
        <Eyebrow>Recuperar contraseña</Eyebrow>
        <h1 className="m-0 font-ui text-h-l font-medium tracking-titulo text-hueso">
          Vuelve a tu camino
        </h1>
        <p className="m-0 font-ui text-body-s leading-relaxed text-texto-tenue">
          Escribe el correo asociado a tu cuenta y te enviaremos un enlace seguro.
        </p>
      </header>

      {enviado ? (
        <div className="flex flex-col gap-aire-s" role="status">
          <p className="m-0 rounded border border-exito/40 px-aire-s py-aire-xs font-ui text-body-s text-exito">
            ✓ Si existe una cuenta con ese correo, recibirás las instrucciones en unos minutos.
          </p>
          <Boton variante="formulario" className="w-full" onClick={() => setEnviado(false)}>
            Reenviar enlace
          </Boton>
        </div>
      ) : (
        <form className="flex flex-col gap-aire-s" noValidate onSubmit={(event) => void solicitarEnlace(event)}>
          <CampoCorreo email={email} error={error} onChange={setEmail} />
          <Boton variante="formulario" type="submit" disabled={enviando} className="mt-aire-xs w-full">
            {enviando ? 'Enviando…' : 'Enviar enlace'}
          </Boton>
        </form>
      )}

      <Link to="/entrar" data-sin-transicion className={enlaceSecundario}>
        ← Volver a iniciar sesión
      </Link>
    </AuthUtilityShell>
  )
}

export function RestablecerContrasenaPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token')
  // El enlace del correo trae el token; sin él no hay nada que restablecer.
  const [estadoEnlace, setEstadoEnlace] = useState<'listo' | 'invalido'>(token ? 'listo' : 'invalido')
  const [password, setPassword] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const actualizar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== confirmacion) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setGuardando(true)
    const { error: errorServidor } = await authClient.resetPassword(token ?? '', password)
    if (errorServidor) {
      setGuardando(false)
      // 400: el enlace venció o ya se usó.
      if (errorServidor.status === 400) setEstadoEnlace('invalido')
      else setError(mensajeRecuperacion(errorServidor))
      return
    }

    await authClient.signOut()
    navigate('/entrar?clave=actualizada', { replace: true })
  }

  return (
    <AuthUtilityShell leyenda={<>Siempre puedes<br />volver al camino</>}>
      <header className="flex flex-col gap-aire-xs">
        <Eyebrow>Nueva contraseña</Eyebrow>
        <h1 className="m-0 font-ui text-h-l font-medium tracking-titulo text-hueso">
          Protege tu cuenta
        </h1>
      </header>

      {estadoEnlace === 'invalido' && (
        <div className="flex flex-col gap-aire-s">
          <p role="alert" className="m-0 font-ui text-body-s leading-relaxed text-peligro">
            El enlace venció o no es válido. Solicita uno nuevo para continuar.
          </p>
          <Link to="/recuperar" data-sin-transicion className={enlaceSecundario}>Solicitar otro enlace →</Link>
        </div>
      )}

      {estadoEnlace === 'listo' && (
        <form className="flex flex-col gap-aire-s" noValidate onSubmit={(event) => void actualizar(event)}>
          <PasswordField
            id="new-password"
            label="Nueva contraseña"
            value={password}
            autoComplete="new-password"
            placeholder="Mínimo 8 caracteres"
            onChange={(event) => setPassword(event.target.value)}
          />
          <PasswordField
            id="confirm-password"
            label="Confirmar contraseña"
            value={confirmacion}
            autoComplete="new-password"
            placeholder="Repite la contraseña"
            onChange={(event) => setConfirmacion(event.target.value)}
          />
          {error && <p role="alert" className="m-0 font-ui text-body-s text-peligro">{error}</p>}
          <Boton variante="formulario" type="submit" disabled={guardando} className="mt-aire-xs w-full">
            {guardando ? 'Actualizando…' : 'Actualizar contraseña'}
          </Boton>
        </form>
      )}

      <Link to="/entrar" data-sin-transicion className={enlaceSecundario}>← Volver a iniciar sesión</Link>
    </AuthUtilityShell>
  )
}

function CampoCorreo({
  email,
  error,
  onChange,
}: {
  email: string
  error: string | null
  onChange: (email: string) => void
}) {
  return (
    <Field label="Correo" htmlFor="recovery-email" error={error ?? undefined} errorId={error ? 'recovery-email-error' : undefined}>
      <Input
        id="recovery-email"
        type="email"
        value={email}
        autoComplete="email"
        placeholder="tu@correo.com"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? 'recovery-email-error' : undefined}
        className={[
          'w-full rounded-none border-0 border-b px-0 py-aire-xs',
          'font-ui text-body text-hueso placeholder:text-texto-debil',
          'hover:border-linea-fuerte focus:border-hueso',
          error ? 'border-peligro' : 'border-linea',
        ].join(' ')}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  )
}

function mensajeRecuperacion(error: FalloDeAuth): string {
  if (error.status === 429) {
    return 'Has solicitado demasiados enlaces. Espera unos minutos e inténtalo de nuevo.'
  }
  if (error.status === 422 || error.status === 400) {
    return 'La contraseña no es válida. Usa al menos 8 caracteres.'
  }
  return 'No pudimos completar la solicitud. Inténtalo nuevamente.'
}

const enlaceSecundario =
  'relative self-center font-mono text-eyebrow uppercase tracking-label text-texto-tenue no-underline transition-colors duration-fade hover:text-hueso after:absolute after:bottom-[-0.4em] after:left-0 after:h-[2px] after:w-0 after:bg-oro after:transition-[width] after:duration-fade hover:after:w-full focus-visible:after:w-full'
