import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CHAPTERS, CIERRE, VIDEOS_INMEDIATOS } from './chapters'
import { useEscena } from './use-escena'
import { useSession } from '../auth/session'
import { BrandLogo } from '@elcamino/ui/static'
import './landing.css'

/**
 * EL CAMINO — landing.
 *
 * Migración fiel de `docs/legacy-landing/` a React (HU-9.1). El diseño no se
 * ha tocado: mismos videos, mismos versículos, mismos scrims y la misma curva
 * de easing. Lo único añadido es la entrada a la plataforma.
 *
 * El scroll mueve el `currentTime` de cada video; ninguno se reproduce solo.
 * Ver `use-escena.ts`.
 */
export function LandingPage() {
  const [root, setRoot] = useState<HTMLDivElement | null>(null)
  useEscena({ root })

  // Si ya hay sesión, la nav ofrece entrar en vez de registrarse.
  const { session } = useSession()

  return (
    // La landing es inmersiva y siempre oscura, al margen del tema de la app.
    <div ref={setRoot} data-theme="dark" className="landing-root min-h-screen bg-negro">
      {/* ══ ESCENARIO DE VIDEO: 4 capas fijas apiladas, solo una visible ══ */}
      <div className="stage" aria-hidden="true">
        {CHAPTERS.map((c, i) => (
          <div
            key={c.numero}
            className={`video-layer${i === 0 ? ' is-active' : ''}`}
            data-video={i}
            style={{ backgroundImage: `url('${c.poster}')` }}
          >
            {/* Los videos NO se reproducen solos: el scroll mueve su
                currentTime. Por eso no llevan `loop` ni `autoplay`.
                Los diferidos guardan su ruta en `data-src`. */}
            <Video chapterIndex={i} src={c.video} poster={c.poster} />
          </div>
        ))}
        <div className="stage-vignette" />
      </div>

      {/* ══ OVERLAYS DE TEXTO ══ */}
      <div className="overlays">
        {CHAPTERS.map((c, i) => (
          <section
            key={c.numero}
            className="overlay"
            data-pos={c.pos}
            data-step={i}
            aria-label={`Capítulo ${c.numero}`}
          >
            <div className="overlay__scrim" />
            <div className="overlay__stack">
              <div className="overlay__inner">
                <p className="overlay__label">
                  Capítulo {c.numero} — {c.lugar}
                </p>
                <h2 className="overlay__title">{c.titulo}</h2>
              </div>
              <div className="overlay__inner">
                <p className="overlay__verse">{c.verso}</p>
                <p className="overlay__ref">{c.ref}</p>
              </div>
            </div>
          </section>
        ))}

        {/* El cierre reutiliza el último video y añade el CTA. */}
        <section className="overlay" data-pos="center" data-step={4} aria-label="Cierre">
          <div className="overlay__scrim" />
          <div className="overlay__stack">
            <div className="overlay__inner">
              <p className="overlay__label">{CIERRE.label}</p>
              <h2 className="overlay__title">{CIERRE.titulo}</h2>
              <p className="overlay__verse">{CIERRE.verso}</p>
              <div className="overlay__actions">
                <Link className="boton" to={CIERRE.cta.to}>
                  {CIERRE.cta.texto}
                </Link>
                <Link className="boton boton--sutil" to={CIERRE.ctaSecundario.to}>
                  {CIERRE.ctaSecundario.texto}
                </Link>
                <p className="overlay__pie">{CIERRE.pie}</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ══ NAV ══ */}
      <header className="nav">
        <a className="nav__brand" href="#top" aria-label="Ir al inicio del recorrido">
          <BrandLogo layout="horizontal" tone="light" size="md" decorative />
        </a>
        <nav className="nav__links">
          {/* El registro vive en el cierre del recorrido, no aquí: quien llega
              a la landing todavía no ha visto por qué debería registrarse. */}
          <Link className="nav__cta" to={session ? '/discipulado' : '/entrar'}>
            {session ? 'Entrar' : 'Iniciar sesión'}
          </Link>
        </nav>
      </header>

      {/* ══ CONTADOR DE CAPÍTULOS ══ */}
      <aside className="counter" aria-hidden="true">
        {CHAPTERS.map((c, i) => (
          <span key={c.numero} style={{ display: 'contents' }}>
            {i > 0 && <span className="counter__dot" />}
            <span className="counter__item" data-step={i}>
              {c.numero}
            </span>
          </span>
        ))}
      </aside>

      {/* ══ INDICADOR DE SCROLL (solo hero) ══ */}
      <div className="scroll-hint" data-hint>
        <span>Desliza</span>
        <span className="scroll-hint__line" />
      </div>

      {/* ══ RECORRIDO: secciones vacías que dirigen el scroll ══ */}
      <main id="top" className="recorrido">
        {CHAPTERS.map((c, i) => (
          <section key={c.numero} className="chapter" data-step={i} />
        ))}
        <section className="chapter chapter--cierre" id="cierre" data-step={4} />
      </main>
    </div>
  )
}

/**
 * Los dos primeros videos traen `src` y se precargan. Los otros dos guardan la
 * ruta en `data-src` hasta que el usuario se acerca (`cargarVideo` en la escena).
 */
function Video({
  chapterIndex,
  src,
  poster,
}: {
  chapterIndex: number
  src: string
  poster: string
}) {
  const ref = useRef<HTMLVideoElement>(null)
  const inmediato = chapterIndex < VIDEOS_INMEDIATOS

  // `src` en el JSX haría que React lo restaurara al re-renderizar, pisando el
  // que `cargarVideo` asigna. Se aplica una sola vez, imperativamente.
  useEffect(() => {
    const v = ref.current
    if (v && inmediato && !v.src) v.src = src
  }, [inmediato, src])

  return (
    <video
      ref={ref}
      {...(inmediato ? {} : { 'data-src': src })}
      poster={poster}
      preload={inmediato ? 'auto' : 'none'}
      muted
      playsInline
      disablePictureInPicture
    />
  )
}
