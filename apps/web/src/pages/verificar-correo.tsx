import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Boton, Eyebrow } from '@elcamino/ui'
import { useSession } from '../auth/session'
import { navegarConTransicion } from '../components/view-transition'
import { supabase } from '../lib/supabase'
import { AuthUtilityShell } from './auth-utility-shell'

interface EstadoVerificacion {
  correo?: string
}

function obtenerMailpitLocal(): string | null {
  if (!import.meta.env.DEV) return null

  try {
    const supabaseUrl = new URL(import.meta.env.VITE_SUPABASE_URL)
    if (supabaseUrl.hostname !== '127.0.0.1' && supabaseUrl.hostname !== 'localhost') return null
    return `${supabaseUrl.protocol}//${supabaseUrl.hostname}:54324`
  } catch {
    return null
  }
}

export function VerificarCorreoPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { session } = useSession()
  const correoEstado = (location.state as EstadoVerificacion | null)?.correo
  const correo = correoEstado ?? session?.user.email ?? ''
  const confirmado = Boolean(session?.user.email_confirmed_at)
  const mailpitLocal = obtenerMailpitLocal()
  const [reenviando, setReenviando] = useState(false)
  const [reenviado, setReenviado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const errorDelEnlace = useMemo(() => {
    const parametros = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    return parametros.get('error_description')
  }, [])

  useEffect(() => {
    if (!errorDelEnlace) return
    setError('El enlace venció o ya fue utilizado. Puedes solicitar uno nuevo.')
  }, [errorDelEnlace])

  const reenviar = async () => {
    if (!correo) {
      setError('Vuelve al registro para indicar el correo que deseas confirmar.')
      return
    }

    setReenviando(true)
    setReenviado(false)
    setError(null)
    const emailRedirectTo = new URL('/verificar-correo', window.location.origin).toString()
    const { error: errorSupabase } = await supabase.auth.resend({
      type: 'signup',
      email: correo,
      options: { emailRedirectTo },
    })
    setReenviando(false)

    if (errorSupabase) {
      if (errorSupabase.status === 429 || /rate limit/i.test(errorSupabase.message)) {
        setError('Espera unos minutos antes de solicitar otro correo.')
      } else {
        setError('No pudimos reenviar el correo. Inténtalo de nuevo en un momento.')
      }
      return
    }
    setReenviado(true)
  }

  const continuar = () => {
    navegarConTransicion(() => navigate('/discipulado', { replace: true }))
  }

  return (
    <AuthUtilityShell leyenda={<>Un paso más<br />para comenzar</>}>
      <header className="flex flex-col gap-aire-xs">
        <Eyebrow>{confirmado ? 'Correo confirmado' : 'Verifica tu correo'}</Eyebrow>
        <h1 className="m-0 font-ui text-h-l font-medium tracking-titulo text-hueso">
          {confirmado ? 'Tu camino está listo' : 'Revisa tu bandeja'}
        </h1>
        <p className="m-0 font-ui text-body-s leading-relaxed text-texto-tenue">
          {confirmado
            ? 'Confirmamos que el correo te pertenece. Ya puedes entrar a la plataforma.'
            : mailpitLocal
              ? 'En desarrollo, Supabase guarda el enlace de confirmación en Mailpit en vez de enviarlo a tu bandeja real.'
            : correo
              ? <>Enviamos un enlace de confirmación a <strong className="font-medium text-hueso">{correo}</strong>. Ábrelo para activar tu cuenta.</>
              : 'Abre el enlace de confirmación que enviamos a tu correo para activar tu cuenta.'}
        </p>
      </header>

      {confirmado ? (
        <Boton variante="formulario" className="w-full" onClick={continuar}>
          Continuar
        </Boton>
      ) : (
        <div className="flex flex-col gap-aire-s">
          <p className="m-0 rounded border border-linea px-aire-s py-aire-xs font-ui text-body-s leading-relaxed text-texto-tenue" role="status">
            ✉ La cuenta permanecerá bloqueada hasta que confirmes el correo.
          </p>
          {mailpitLocal && (
            <a
              href={mailpitLocal}
              target="_blank"
              rel="noreferrer"
              className="rounded border border-vino px-aire-s py-aire-xs text-center font-mono text-eyebrow uppercase tracking-label text-hueso no-underline transition-colors duration-fade hover:bg-vino"
            >
              Abrir correo de desarrollo
            </a>
          )}
          {correo && (
            <Boton variante="formulario" className="w-full" disabled={reenviando} onClick={() => void reenviar()}>
              {reenviando ? 'Reenviando…' : 'Reenviar correo'}
            </Boton>
          )}
        </div>
      )}

      {reenviado && (
        <p role="status" className="m-0 font-ui text-body-s text-exito">
          ✓ {mailpitLocal ? 'Generamos un nuevo enlace en Mailpit.' : 'Te enviamos un nuevo enlace de confirmación.'}
        </p>
      )}
      {error && <p role="alert" className="m-0 font-ui text-body-s text-vino">{error}</p>}

      <Link to="/entrar" data-sin-transicion className={enlaceSecundario}>
        ← Volver a iniciar sesión
      </Link>
    </AuthUtilityShell>
  )
}

const enlaceSecundario =
  'relative self-center font-mono text-eyebrow uppercase tracking-label text-texto-tenue no-underline transition-colors duration-fade hover:text-hueso after:absolute after:bottom-[-0.4em] after:left-0 after:h-[2px] after:w-0 after:bg-vino after:transition-[width] after:duration-fade hover:after:w-full focus-visible:after:w-full'
