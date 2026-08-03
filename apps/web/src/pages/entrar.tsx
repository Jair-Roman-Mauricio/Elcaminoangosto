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
import { PageTransition } from '../components/page-transition'
import { navegarConTransicion } from '../components/view-transition'
import { PasswordField } from '../components/password-field'
import { PanelCurvo } from './panel-curvo'

/** Curva del sistema (DESIGN.md §5). */
const EASE = [0.22, 0.61, 0.36, 1] as const

const CredencialesSchema = z.object({
  email: z.string().email('Introduce un correo válido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
})
type Credenciales = z.infer<typeof CredencialesSchema>

/**
 * Entrada de la administración. No hay registro: la plataforma es abierta y
 * nadie más necesita una cuenta. Quien administra sí puede recuperar su
 * contraseña por correo.
 *
 * El fondo es la fotografía limpia (`/brand/paisaje.webp`). La banda oscura y
 * su curva **no vienen en la imagen**: se dibujan con `PanelCurvo`, así se
 * adaptan a cualquier ancho y el formulario nunca se queda sin sitio.
 *
 * Bajo `md` (991px) el panel desaparece: la foto pasa a fondo a pantalla
 * completa con un velo vertical, y el formulario se apoya encima.
 */
/** Aviso breve sobre el formulario (por ejemplo tras cambiar la contraseña). */
type Aviso = { tipo: 'exito' | 'confirmar'; texto: string } | null

/** Mensaje legible para el visitante; nunca el texto crudo del proveedor. */
function mensajeDeError(error: AuthError): string {
  if (error.code === 'invalid_credentials' || /invalid login/i.test(error.message)) {
    return 'Correo o contraseña incorrectos.'
  }
  if (error.code === 'email_not_confirmed' || /email not confirmed/i.test(error.message)) {
    return 'Esta cuenta todavía no ha confirmado su correo.'
  }
  if (error.status === 429) return 'Demasiados intentos. Espera un momento y vuelve a probar.'
  return 'No se pudo entrar. Inténtalo de nuevo en un momento.'
}

export function EntrarPage() {
  const [params] = useSearchParams()
  const [errorServidor, setErrorServidor] = useState<string | null>(null)
  const [aviso, setAviso] = useState<Aviso>(
    params.get('clave') === 'actualizada'
      ? { tipo: 'exito', texto: 'Contraseña actualizada. Ya puedes iniciar sesión.' }
      : null,
  )
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
    // Sin perfil todavía no se sabe si es admin; se espera a tenerlo.
    if (!perfil) return
    transiciónEnCurso.current = true
    navegarConTransicion(() =>
      navigate(desde ?? (perfil.role === 'ADMIN' ? '/admin/contenido' : '/alabanza'), {
        replace: true,
      }),
    )
  }, [location.state, navigate, perfil, session])

  // Mientras el perfil termina de cargar se conserva el fondo oscuro, para que
  // la transición hacia la plataforma no parpadee.
  if (session) {
    return <div className="min-h-screen bg-negro" />
  }

  const enviar = async ({ email, password }: Credenciales) => {
    setErrorServidor(null)
    setAviso(null)
    const correo = email.trim().toLowerCase()

    const { error } = await supabase.auth.signInWithPassword({ email: correo, password })
    if (error) setErrorServidor(mensajeDeError(error))
  }

  return (
    // El login es inmersivo sobre una foto oscura: siempre oscuro, al margen
    // del tema de la app. `data-theme="dark"` hace que sus tokens (líneas,
    // texto tenue) resuelvan en oscuro aunque el tema activo sea claro.
    <div data-theme="dark" className="relative min-h-screen overflow-hidden bg-negro">
      {/* Fotografía limpia, sin textos ni banda quemada. En móvil se encuadra
          sobre el sendero; en escritorio, sobre el valle. */}
      <img
        src="/brand/paisaje.webp"
        alt=""
        aria-hidden
        width={1535}
        height={1024}
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
            <header className="flex flex-col gap-aire-xs">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  className="flex flex-col gap-aire-xs"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3, ease: EASE }}
                >
                  <Eyebrow>Administración</Eyebrow>
                  <h2 className="m-0 font-ui text-h-l font-medium tracking-titulo text-hueso">
                    Entra a administrar
                  </h2>
                </motion.div>
              </AnimatePresence>
            </header>

            <form onSubmit={handleSubmit(enviar)} className="flex flex-col gap-aire-s" noValidate>
              <Campo
                id="email"
                label="Correo"
                type="email"
                autoComplete="email"
                placeholder="tu@correo.com"
                error={errors.email?.message}
                {...register('email')}
              />

              <PasswordField
                id="password"
                label="Contraseña"
                autoComplete="current-password"
                placeholder="••••••••"
                error={errors.password?.message}
                {...register('password')}
              />

              <Link
                  to="/recuperar"
                  data-sin-transicion
                  className="relative self-end font-mono text-eyebrow uppercase tracking-label text-texto-tenue no-underline transition-colors duration-fade ease-camino hover:text-hueso after:absolute after:bottom-[-0.4em] after:left-0 after:h-[2px] after:w-0 after:bg-vino after:transition-[width] after:duration-fade after:ease-camino hover:after:w-full focus-visible:after:w-full"
                >
                  ¿Olvidaste tu contraseña?
                </Link>

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
                {isSubmitting || session ? 'Un momento…' : 'Entrar'}
              </Boton>
            </form>

            <Link
              to="/"
              className="relative self-center font-mono text-eyebrow uppercase tracking-label text-texto-debil no-underline transition-colors duration-fade ease-camino hover:text-texto-tenue after:absolute after:bottom-[-0.4em] after:left-0 after:h-[2px] after:w-0 after:bg-vino after:transition-[width] after:duration-fade after:ease-camino hover:after:w-full focus-visible:after:w-full"
            >
              ← Volver a la plataforma
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
