import { Link } from 'react-router-dom'
import { Boton, Eyebrow, Verse, Reveal } from '@elcamino/ui'

/**
 * Landing provisional. La migración fiel del recorrido cinematográfico
 * (GSAP + ScrollTrigger + Lenis, scrub de video por scroll) es HU-9.1,
 * sprint S6. El original ejecutable está en `docs/legacy-landing/`.
 */
export function LandingPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-negro px-gutter">
      <Reveal className="flex max-w-2xl flex-col items-center gap-aire-m text-center">
        <Eyebrow>Mateo 7:13–14</Eyebrow>

        <h1 className="m-0 font-mono text-h-xl font-normal leading-tight text-hueso">
          El Camino Angosto
        </h1>

        <Verse referencia="Mateo 7:14">
          Porque angosta es la puerta, y angosto el camino que lleva a la vida, y pocos son los que
          la hallan.
        </Verse>

        <div className="mt-aire-s flex flex-col items-center gap-aire-s">
          <Link to="/entrar" className="no-underline">
            <Boton>Entrar</Boton>
          </Link>
          <p className="m-0 font-mono text-eyebrow uppercase tracking-label text-texto-debil">
            Alabanza · Tarjetas de Fe · Discipulado
          </p>
        </div>
      </Reveal>
    </main>
  )
}
