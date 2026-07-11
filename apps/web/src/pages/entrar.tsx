import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { z } from 'zod'
import { Boton, Eyebrow, Verse } from '@elcamino/ui'
import { supabase } from '../lib/supabase'
import { useSession } from '../auth/session'
import { PageTransition } from '../components/page-transition'
import { PanelCurvo, FONDO_PANEL } from './panel-curvo'

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

export function EntrarPage() {
  // La landing enlaza a `/entrar?registro=1` desde su CTA de cierre.
  const [params] = useSearchParams()
  const [modo, setModo] = useState<Modo>(params.has('registro') ? 'registrarse' : 'entrar')
  const [errorServidor, setErrorServidor] = useState<string | null>(null)
  const [aviso, setAviso] = useState<Aviso>(null)
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
    setAviso(null)

    if (modo === 'entrar') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setErrorServidor(error.message)
      return
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName ?? email.split('@')[0] } },
    })
    if (error) {
      setErrorServidor(error.message)
      return
    }

    // Con auto-confirmación, `signUp` devuelve sesión y el SessionProvider
    // redirige solo; mostramos un éxito breve por si la redirección tarda.
    // Sin sesión, la confirmación por correo está activa: hay que avisar.
    if (data.session) {
      setAviso({ tipo: 'exito', texto: '¡Cuenta creada! Entrando…' })
    } else {
      setAviso({
        tipo: 'confirmar',
        texto: `Te enviamos un correo a ${email}. Confírmalo para entrar.`,
      })
    }
  }

  const esRegistro = modo === 'registrarse'

  return (
    <div className="relative min-h-screen overflow-hidden bg-negro">
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
          <MarcaCruz className="h-10 w-10 text-texto-tenue md:h-14 md:w-14" />

          <h1 className="m-0 font-mono text-h-m font-normal uppercase leading-tight tracking-label text-hueso md:text-h-l">
            {/* El salto solo existe en escritorio; el espacio que lo precede
                mantiene «El Camino Angosto» en una línea cuando se oculta. */}
            El Camino <br className="hidden md:block" />
            Angosto
          </h1>

          <span aria-hidden className="h-px w-12 bg-vino md:w-16" />

          <p className="m-0 hidden font-mono text-eyebrow uppercase leading-relaxed tracking-label text-texto-tenue md:block">
            Camina con
            <br />
            un corazón nuevo
          </p>

          <div className="mt-aire-m hidden max-w-xs md:block">
            <Verse referencia="Juan 14:6">«Yo soy el camino, la verdad y la vida.»</Verse>
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
                  <h2 className="m-0 font-mono text-h-m font-normal text-hueso">
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
                  className="self-end font-mono text-eyebrow uppercase tracking-label text-texto-tenue no-underline underline-offset-[0.45em] transition-colors duration-fade ease-camino hover:text-hueso hover:underline hover:decoration-marino"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              )}

              {errorServidor && (
                <p role="alert" className="m-0 font-mono text-body-s text-vino">
                  {errorServidor}
                </p>
              )}

              {aviso && (
                <p
                  role="status"
                  className={[
                    'm-0 rounded border px-aire-s py-aire-xs font-mono text-body-s',
                    aviso.tipo === 'exito'
                      ? 'border-exito/40 text-exito'
                      : 'border-linea text-texto-tenue',
                  ].join(' ')}
                >
                  {aviso.tipo === 'exito' ? '✓ ' : '✉ '}
                  {aviso.texto}
                </p>
              )}

              <Boton type="submit" disabled={isSubmitting} className="mt-aire-xs w-full">
                {isSubmitting ? 'Un momento…' : esRegistro ? 'Registrarme' : 'Entrar'}
              </Boton>
            </form>

            <div className="flex flex-col items-center gap-aire-xs">
              <p className="m-0 font-mono text-eyebrow uppercase tracking-label text-texto-debil">
                {esRegistro ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'}
              </p>
              <Boton
                variante="sutil"
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
              className="self-center font-mono text-eyebrow uppercase tracking-label text-texto-debil no-underline transition-colors duration-fade ease-camino hover:text-texto-tenue"
            >
              ← Volver al recorrido
            </Link>
          </div>
        </PageTransition>
      </main>
    </div>
  )
}

/** Cruz bajo un arco. Trazo, no relleno: hereda `currentColor`. */
function MarcaCruz({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden focusable="false" className={className}>
      <path
        d="M10 46V20a14 14 0 0 1 28 0v26"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
      <path d="M24 12v26M16 21h16" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" />
    </svg>
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
      style={{ backgroundColor: `${FONDO_PANEL}b3` }}
      className={[
        'rounded border px-aire-s py-aire-xs',
        'font-mono text-body text-hueso placeholder:text-texto-debil',
        'transition-colors duration-fade ease-camino',
        // Foco: outline hueso, nunca glow (DESIGN.md §2).
        error ? 'border-vino' : 'border-linea hover:border-linea-fuerte',
      ].join(' ')}
      {...props}
    />
    {error && (
      <p id={`${id}-error`} role="alert" className="m-0 font-mono text-body-s text-vino">
        {error}
      </p>
    )}
  </div>
)
