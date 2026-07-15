import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { z } from 'zod'
import type { AuthError } from '@supabase/supabase-js'
import { BrandLogo, Boton, Eyebrow, Field, Input, Verse } from '@elcamino/ui'
import { supabase } from '../lib/supabase'
import { useSession, usePerfil } from '../auth/session'
import { PageTransition, navegarConTransicion } from '../components/page-transition'
import { PanelCurvo } from './panel-curvo'

/** Curva del sistema (DESIGN.md §5). */
const EASE = [0.22, 0.61, 0.36, 1] as const

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
 *
 * El fondo es la fotografía limpia (`/brand/paisaje.jpg`). La banda oscura y
 * su curva **no vienen en la imagen**: se dibujan con `PanelCurvo`, así se
 * adaptan a cualquier ancho y el formulario nunca se queda sin sitio.
 *
 * Bajo `md` (991px) el panel desaparece: la foto pasa a fondo a pantalla
 * completa con un velo vertical, y el formulario se apoya encima.
 */
/** Aviso tras un registro que exige confirmar el correo (si estuviera activa). */
type Aviso = { tipo: 'exito' | 'confirmar'; texto: string } | null

/** ¿El error de signUp indica que el correo ya está registrado? */
function esCorreoExistente(error: AuthError): boolean {
  return (
    error.code === 'user_already_exists' ||
    error.code === 'email_exists' ||
    /already registered|already been registered/i.test(error.message)
  )
}

/** Traduce los errores de Supabase Auth a mensajes claros en español. */
function mensajeDeError(error: AuthError): string {
  const code = error.code ?? ''
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(error.message)) {
    return 'Correo o contraseña incorrectos. Revisa tus datos.'
  }
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(error.message)) {
    return 'Tu correo aún no está confirmado. Escríbenos si el problema persiste.'
  }
  if (error.status === 429 || /rate limit/i.test(error.message)) {
    return 'Demasiados intentos. Espera un momento y vuelve a probar.'
  }
  if (code === 'weak_password' || /password should be/i.test(error.message)) {
    return 'La contraseña es demasiado débil. Usa al menos 8 caracteres.'
  }
  return 'No se pudo completar. Inténtalo de nuevo en un momento.'
}

export function EntrarPage() {
  // La landing enlaza a `/entrar?registro=1` desde su CTA de cierre.
  const [params] = useSearchParams()
  const [modo, setModo] = useState<Modo>(params.has('registro') ? 'registrarse' : 'entrar')
  const [errorServidor, setErrorServidor] = useState<string | null>(null)
  const [aviso, setAviso] = useState<Aviso>(null)
  const { session } = useSession()
  const { data: perfil } = usePerfil()
  const location = useLocation()
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Credenciales>({ resolver: zodResolver(CredencialesSchema) })

  const transiciónEnCurso = useRef(false)
  useEffect(() => {
    if (!session || transiciónEnCurso.current) return
    const desde = (location.state as { desde?: string } | null)?.desde
    const destino = desde ?? (perfil ? (perfil.role === 'ADMIN' ? '/admin' : '/discipulado') : null)
    if (!destino) return
    transiciónEnCurso.current = true
    navegarConTransicion(() => navigate(destino, { replace: true }))
  }, [location.state, navigate, perfil, session])

  // Tras iniciar sesión se conserva el fondo oscuro mientras el perfil termina
  // de cargar y la transición hacia la plataforma puede comenzar. El registro
  // usa su propia transición directa y no pasa por este estado.
  if (session && modo === 'entrar') {
    return <div className="min-h-screen bg-negro" />
  }

  const enviar = async ({ email, password, displayName }: Credenciales) => {
    setErrorServidor(null)
    setAviso(null)
    const correo = email.trim().toLowerCase()

    if (modo === 'entrar') {
      const { error } = await supabase.auth.signInWithPassword({ email: correo, password })
      if (error) setErrorServidor(mensajeDeError(error))
      return
    }

    const { data, error } = await supabase.auth.signUp({
      email: correo,
      password,
      options: { data: { display_name: displayName ?? correo.split('@')[0] } },
    })
    if (error) {
      // Si el correo ya existe, no es un fallo: se lleva al usuario a iniciar
      // sesión con ese mismo correo, en vez de dejarlo atascado creando cuentas.
      if (esCorreoExistente(error)) {
        setModo('entrar')
        setAviso({
          tipo: 'confirmar',
          texto: `Ya tienes una cuenta con ${correo}. Inicia sesión con tu contraseña.`,
        })
        return
      }
      setErrorServidor(mensajeDeError(error))
      return
    }

    // Con auto-confirmación, `signUp` devuelve sesión y enviamos explícitamente
    // al usuario a la plataforma; mostramos un éxito breve por si tarda.
    // Sin sesión, la confirmación por correo está activa: hay que avisar.
    if (data.session) {
      setAviso({ tipo: 'exito', texto: '¡Cuenta creada! Entrando…' })
      // El registro termina en la plataforma, igual que un inicio de sesión.
      // No dependemos de la URL de redirección de Supabase (que puede apuntar
      // al site_url `/`): la cuenta nueva siempre empieza en Discipulado.
      navegarConTransicion(() => navigate('/discipulado', { replace: true }))
    } else {
      setAviso({
        tipo: 'confirmar',
        texto: `Te enviamos un correo a ${correo}. Confírmalo para entrar.`,
      })
    }
  }

  const esRegistro = modo === 'registrarse'

  return (
    // El login es inmersivo sobre una foto oscura: siempre oscuro, al margen
    // del tema de la app. `data-theme="dark"` hace que sus tokens (líneas,
    // texto tenue) resuelvan en oscuro aunque el tema activo sea claro.
    <div data-theme="dark" className="relative min-h-screen overflow-hidden bg-negro">
      {/* Fotografía limpia, sin textos ni banda quemada. En móvil se encuadra
          sobre el sendero; en escritorio, sobre el valle. */}
      <img
        src="/brand/paisaje.jpg"
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover object-[47%_42%] md:object-center"
        fetchPriority="high"
      />

      {/* Móvil: velo vertical bajo el formulario. Nunca un velo plano sobre
          toda la foto (DESIGN.md §8). */}
      <div
        aria-hidden
        className="absolute inset-0 md:hidden"
        style={{
          background: `linear-gradient(to bottom, rgba(10,10,10,0.25) 0%, rgba(10,10,10,0.62) 34%, rgba(10,10,10,0.88) 68%, rgba(10,10,10,0.95) 100%)`,
        }}
      />

      {/* Escritorio: la banda oscura, dibujada por código. */}
      <PanelCurvo className="absolute inset-y-0 right-0 hidden h-full w-[56%] md:block xl:w-[50%]" />

      {/* La columna del formulario arranca en el 62%: es donde el vértice de
          la curva deja la banda oscura más estrecha (44% + 32.9%·56% = 62.4%).
          Centrarlo en la mitad derecha lo dejaría pisando el valle iluminado. */}
      <main className="relative grid min-h-screen grid-cols-1 content-center md:grid-cols-[62%_38%] md:content-stretch">
        {/* Marca sobre la fotografía. Antes venía quemada en el archivo; ahora
            es texto real: escala, se traduce y la lee un lector de pantalla.
            Un ÚNICO bloque para los dos layouts: duplicarlo metía dos <h1> en
            el documento. En móvil encabeza la columna; en escritorio ocupa su
            propia columna sobre el paisaje. */}
        <div className="flex flex-col items-center justify-center gap-aire-s px-gutter pt-aire-l text-center md:min-h-screen md:gap-aire-m md:pt-0">
          <BrandLogo layout="horizontal" tone="light" size="lg" />

          <span aria-hidden className="h-px w-12 bg-vino md:w-16" />

          <p className="m-0 hidden font-mono text-eyebrow uppercase leading-relaxed tracking-label text-texto-tenue md:block">
            Camina con
            <br />
            un corazón nuevo
          </p>

          <div className="mt-aire-m hidden max-w-xs md:block">
            <Verse variante="login" referencia="Juan 14:6">
              «Yo soy el camino, la verdad y la vida.»
            </Verse>
          </div>
        </div>

        <PageTransition className="flex items-center justify-center px-gutter py-aire-l md:min-h-screen">
          <div className="flex w-full max-w-sm flex-col gap-aire-m">
            {/* El encabezado hace crossfade al alternar registro/login. */}
            <header className="flex flex-col gap-aire-xs">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={modo}
                  className="flex flex-col gap-aire-xs"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3, ease: EASE }}
                >
                  <Eyebrow>{esRegistro ? 'Crear cuenta' : 'Iniciar sesión'}</Eyebrow>
                  <h2 className="m-0 font-ui text-h-l font-medium tracking-titulo text-hueso">
                    {esRegistro ? 'Comienza tu camino' : 'Continúa tu camino'}
                  </h2>
                </motion.div>
              </AnimatePresence>
            </header>

            <form onSubmit={handleSubmit(enviar)} className="flex flex-col gap-aire-s" noValidate>
              {/* El campo Nombre se expande/colapsa suavemente al cambiar de modo. */}
              <AnimatePresence initial={false}>
                {esRegistro && (
                  <motion.div
                    key="displayName"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: EASE }}
                    className="overflow-hidden"
                  >
                    <Campo
                      id="displayName"
                      label="Nombre"
                      type="text"
                      autoComplete="name"
                      placeholder="Cómo quieres que te llamemos"
                      error={errors.displayName?.message}
                      {...register('displayName')}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <Campo
                id="email"
                label="Correo"
                type="email"
                autoComplete="email"
                placeholder="tu@correo.com"
                error={errors.email?.message}
                {...register('email')}
              />

              <Campo
                id="password"
                label="Contraseña"
                type="password"
                autoComplete={esRegistro ? 'new-password' : 'current-password'}
                placeholder={esRegistro ? 'Mínimo 8 caracteres' : '••••••••'}
                error={errors.password?.message}
                {...register('password')}
              />

              {!esRegistro && (
                <Link
                  to="/recuperar"
                  className="relative self-end font-mono text-eyebrow uppercase tracking-label text-texto-tenue no-underline transition-colors duration-fade ease-camino hover:text-hueso after:absolute after:bottom-[-0.4em] after:left-0 after:h-[2px] after:w-0 after:bg-vino after:transition-[width] after:duration-fade after:ease-camino hover:after:w-full focus-visible:after:w-full"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              )}

              {errorServidor && (
                <p role="alert" className="m-0 font-ui text-body-s text-vino">
                  {errorServidor}
                </p>
              )}

              {aviso && (
                <p
                  role="status"
                  className={[
                    'm-0 rounded border px-aire-s py-aire-xs font-ui text-body-s',
                    aviso.tipo === 'exito'
                      ? 'border-exito/40 text-exito'
                      : 'border-linea text-texto-tenue',
                  ].join(' ')}
                >
                  {aviso.tipo === 'exito' ? '✓ ' : '✉ '}
                  {aviso.texto}
                </p>
              )}

              <Boton
                variante="formulario"
                type="submit"
                disabled={isSubmitting || Boolean(session)}
                className="mt-aire-xs w-full"
              >
                {isSubmitting || session ? 'Un momento…' : esRegistro ? 'Registrarme' : 'Entrar'}
              </Boton>
            </form>

            <div className="flex flex-col items-center gap-aire-xs">
              <p className="m-0 font-mono text-eyebrow uppercase tracking-label text-texto-debil">
                {esRegistro ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'}
              </p>
              <Boton
                variante="sutil"
                className="relative no-underline after:absolute after:bottom-[0.35rem] after:left-0 after:h-[2px] after:w-0 after:bg-vino after:transition-[width] after:duration-fade after:ease-camino hover:after:w-full focus-visible:after:w-full"
                onClick={() => {
                  setModo(esRegistro ? 'entrar' : 'registrarse')
                  setErrorServidor(null)
                  setAviso(null)
                }}
              >
                {esRegistro ? 'Iniciar sesión' : 'Regístrate ahora'}
              </Boton>
            </div>

            <Link
              to="/"
              className="relative self-center font-mono text-eyebrow uppercase tracking-label text-texto-debil no-underline transition-colors duration-fade ease-camino hover:text-texto-tenue after:absolute after:bottom-[-0.4em] after:left-0 after:h-[2px] after:w-0 after:bg-vino after:transition-[width] after:duration-fade after:ease-camino hover:after:w-full focus-visible:after:w-full"
            >
              ← Volver al recorrido
            </Link>
          </div>
        </PageTransition>
      </main>
    </div>
  )
}

// `ComponentPropsWithRef` (no `InputHTMLAttributes`): react-hook-form pasa un
// `ref` en el objeto de `register()`. React 19 lo acepta como prop normal.
interface CampoProps extends React.ComponentPropsWithRef<typeof Input> {
  id: string
  label: string
  error?: string | undefined
}

const Campo = ({ id, label, error, ...props }: CampoProps) => (
  <Field label={label} htmlFor={id} error={error} errorId={error ? `${id}-error` : undefined}>
    <Input
      id={id}
      aria-invalid={Boolean(error)}
      aria-describedby={error ? `${id}-error` : undefined}
      className={[
        'rounded-none border-0 border-b px-0 py-aire-xs',
        'font-ui text-body text-hueso placeholder:text-texto-debil',
        'hover:border-linea-fuerte focus:border-hueso',
        error ? 'border-vino' : 'border-linea',
      ].join(' ')}
      {...props}
    />
  </Field>
)
