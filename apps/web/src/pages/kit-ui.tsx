import { useState } from 'react'
import {
  Boton,
  Card,
  Eyebrow,
  PlayPause,
  ProgressBar,
  Reveal,
  Verse,
  useReducedMotion,
} from '@elcamino/ui'

/**
 * Página de muestra del design system (HU-0.4).
 * Alternativa ligera a Storybook: se sirve en `/kit-ui` y usa los mismos
 * tokens que la app, así que cualquier deriva visual se ve aquí primero.
 */
export function KitUiPage() {
  const [reproduciendo, setReproduciendo] = useState(false)
  const [progreso, setProgreso] = useState(42)
  const reduced = useReducedMotion()

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-aire-l bg-negro px-gutter py-aire-l">
      <header className="flex flex-col gap-aire-xs">
        <Eyebrow>Design system</Eyebrow>
        <h1 className="m-0 font-mono text-h-l font-normal text-hueso">Kit de interfaz</h1>
        <p className="m-0 font-mono text-body-s text-texto-tenue">
          Tokens de <code>docs/DESIGN.md</code>. Movimiento reducido:{' '}
          <strong className="text-hueso">{reduced ? 'sí' : 'no'}</strong>
        </p>
      </header>

      <Seccion titulo="Color">
        <div className="grid grid-cols-2 gap-aire-s cine:grid-cols-4">
          <Muestra nombre="negro" clase="bg-negro border border-linea" />
          <Muestra nombre="hueso" clase="bg-hueso" />
          <Muestra nombre="vino" clase="bg-vino" />
          <Muestra nombre="marino" clase="bg-marino" />
          <Muestra nombre="superficie-1" clase="bg-superficie-1 border border-linea" />
          <Muestra nombre="superficie-2" clase="bg-superficie-2 border border-linea" />
          <Muestra nombre="exito" clase="bg-exito" />
          <Muestra nombre="aviso" clase="bg-aviso" />
        </div>
      </Seccion>

      <Seccion titulo="Tipografía">
        <p className="m-0 font-mono text-h-xl text-hueso">Título de capítulo</p>
        <p className="m-0 font-mono text-h-m text-hueso">Subtítulo</p>
        <p className="m-0 font-mono text-body text-hueso">
          Cuerpo en Space Mono, la voz por defecto del sistema.
        </p>
        <Eyebrow>Eyebrow con su regla</Eyebrow>
        <Verse referencia="Mateo 7:14">
          Angosta es la puerta, y angosto el camino que lleva a la vida.
        </Verse>
      </Seccion>

      <Seccion titulo="Botones">
        <div className="flex flex-wrap items-center gap-aire-m">
          <Boton>Primario</Boton>
          <Boton variante="nav">Nav</Boton>
          <Boton variante="sutil">Sutil</Boton>
          <Boton disabled>Deshabilitado</Boton>
        </div>
      </Seccion>

      <Seccion titulo="Controles de medios">
        <div className="flex items-center gap-aire-m">
          <PlayPause
            reproduciendo={reproduciendo}
            onToggle={() => setReproduciendo((r) => !r)}
          />
          <div className="flex-1">
            <ProgressBar value={progreso} max={180} onSeek={setProgreso} />
          </div>
        </div>
      </Seccion>

      <Seccion titulo="Tarjeta">
        <div className="grid gap-aire-m cine:grid-cols-3">
          <Reveal>
            <Card eyebrow="Discipulado · Nivel 1" titulo="La puerta angosta" meta="2 módulos" />
          </Reveal>
          <Reveal delay={0.1}>
            <Card eyebrow="Alabanza" titulo="Cristo mi refugio" meta="3:42" />
          </Reveal>
          <Reveal delay={0.2}>
            <Card
              eyebrow="Tarjeta de fe"
              titulo="Contad el costo"
              meta="Marcos Maestro"
              onClick={() => undefined}
            />
          </Reveal>
        </div>
      </Seccion>
    </main>
  )
}

const Seccion = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
  <section className="flex flex-col gap-aire-s border-t border-linea pt-aire-m">
    <h2 className="m-0 font-mono text-eyebrow uppercase tracking-label text-texto-tenue">
      {titulo}
    </h2>
    {children}
  </section>
)

const Muestra = ({ nombre, clase }: { nombre: string; clase: string }) => (
  <div className="flex flex-col gap-aire-xs">
    <div className={`h-16 rounded ${clase}`} />
    <span className="font-mono text-eyebrow uppercase tracking-label text-texto-tenue">
      {nombre}
    </span>
  </div>
)
