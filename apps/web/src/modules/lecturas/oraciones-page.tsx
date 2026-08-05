import { useEffect, useMemo, useRef, useState } from 'react'
import { Eyebrow } from '@elcamino/ui'
import { useOraciones, type OracionGuiada } from './lecturas-api'
import { useRegistrarVisita } from '../../lib/analitica'

/**
 * Oraciones guiadas: una voz y su texto.
 *
 * El texto está en gris y se enciende línea a línea al ritmo de la locución.
 * No es adorno: quien reza acompañando necesita saber dónde va, y quien no
 * puede poner sonido lo lee igual porque la letra está toda a la vista.
 */
export function OracionesPage() {
  useRegistrarVisita('oraciones')
  const { data, isPending, isError } = useOraciones()
  const [abierta, setAbierta] = useState<OracionGuiada | null>(null)

  if (abierta) return <Rezo oracion={abierta} onVolver={() => setAbierta(null)} />

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-aire-m">
      <header className="flex flex-col gap-aire-xs">
        <Eyebrow>Oraciones guiadas</Eyebrow>
        <h1 className="m-0 font-ui text-h-l font-medium tracking-titulo text-contenido">
          Cuando no sabes qué decir
        </h1>
        <p className="m-0 max-w-prose font-ui text-body text-texto-tenue">
          Una voz que ora contigo. Solo tienes que seguirla.
        </p>
      </header>

      {isError && (
        <p className="m-0 font-ui text-body text-peligro">No se pudieron cargar las oraciones.</p>
      )}
      {isPending && <p className="m-0 font-ui text-body text-texto-tenue">Cargando…</p>}
      {!isPending && !isError && data?.length === 0 && (
        <p className="m-0 font-ui text-body text-texto-tenue">Todavía no hay oraciones.</p>
      )}

      <ul className="m-0 flex list-none flex-col gap-aire-xs p-0">
        {(data ?? []).map((oracion) => (
          <li key={oracion.id}>
            <button
              type="button"
              onClick={() => setAbierta(oracion)}
              className="flex w-full flex-col gap-aire-xs border border-linea bg-superficie-1 px-aire-m py-aire-s text-left transition-colors duration-fade ease-camino hover:border-acento"
            >
              {oracion.tema && (
                <span className="font-mono text-body-s uppercase tracking-label text-acento">
                  {oracion.tema}
                </span>
              )}
              <span className="font-serif text-h-m font-light text-contenido">{oracion.titulo}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * Reparte las líneas en el tiempo cuando no vienen marcadas.
 *
 * Por longitud del texto: una línea con el doble de letras se tarda
 * aproximadamente el doble en decir. No es exacto, pero para una locución
 * pausada cae lo bastante cerca, y es infinitamente mejor que repartir a partes
 * iguales, que desincroniza a la tercera línea.
 */
function repartirPorLongitud(lineas: string[], duracion: number): number[] {
  const total = lineas.reduce((suma, linea) => suma + Math.max(1, linea.length), 0)
  let acumulado = 0
  return lineas.map((linea) => {
    const inicio = (acumulado / total) * duracion
    acumulado += Math.max(1, linea.length)
    return inicio
  })
}

function Rezo({ oracion, onVolver }: { oracion: OracionGuiada; onVolver: () => void }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [duracion, setDuracion] = useState(0)
  const [tiempo, setTiempo] = useState(0)
  const [sonando, setSonando] = useState(false)

  const marcas = useMemo(() => {
    if (oracion.marcas && oracion.marcas.length === oracion.lineas.length) return oracion.marcas
    if (!duracion) return null
    return repartirPorLongitud(oracion.lineas, duracion)
  }, [duracion, oracion.lineas, oracion.marcas])

  // Qué línea se está diciendo ahora mismo.
  const activa = useMemo(() => {
    if (!marcas) return -1
    let actual = -1
    for (let i = 0; i < marcas.length; i += 1) if (tiempo >= marcas[i]!) actual = i
    return actual
  }, [marcas, tiempo])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const alSonar = () => setTiempo(audio.currentTime)
    const alCargar = () => setDuracion(audio.duration || 0)
    audio.addEventListener('timeupdate', alSonar)
    audio.addEventListener('loadedmetadata', alCargar)
    return () => {
      audio.removeEventListener('timeupdate', alSonar)
      audio.removeEventListener('loadedmetadata', alCargar)
    }
  }, [])

  const alternar = () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) void audio.play().then(() => setSonando(true)).catch(() => undefined)
    else {
      audio.pause()
      setSonando(false)
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-aire-l pb-aire-l">
      <button
        type="button"
        onClick={onVolver}
        className="self-start border-0 bg-transparent p-0 font-mono text-body-s uppercase tracking-label text-texto-tenue transition-colors duration-fade ease-camino hover:text-acento"
      >
        ← Volver
      </button>

      <header className="flex flex-col gap-aire-xs text-center">
        {oracion.tema && (
          <p className="m-0 font-mono text-body-s uppercase tracking-label text-acento">
            {oracion.tema}
          </p>
        )}
        <h1 className="m-0 font-serif text-[clamp(2rem,5vw,3.4rem)] font-light text-contenido">
          {oracion.titulo}
        </h1>
      </header>

      {/* El texto entero, apagado. Solo se enciende lo que se está diciendo:
          la línea anterior se queda tenue y la siguiente espera en gris, así
          que siempre se sabe de dónde se viene y hacia dónde va. */}
      <ol className="m-0 flex list-none flex-col gap-aire-s p-0 text-center">
        {oracion.lineas.map((linea, i) => (
          <li
            key={`${oracion.id}-${i}`}
            className={`font-serif text-[clamp(1.2rem,2.6vw,1.9rem)] leading-relaxed transition-all duration-[600ms] ease-camino motion-reduce:transition-none ${
              // La opacidad va aparte del color: los tokens son `var(--x)` y
              // Tailwind no sabe atenuarlos con la sintaxis `text-color/40`.
              i === activa
                ? 'scale-[1.02] text-acento opacity-100'
                : i < activa
                  ? 'text-contenido opacity-45'
                  : 'text-contenido opacity-20'
            }`}
          >
            {linea}
          </li>
        ))}
      </ol>

      <div className="flex flex-col items-center gap-aire-s">
        <button
          type="button"
          onClick={alternar}
          className="rounded-full border border-acento bg-oro brillo-oro px-[2.4rem] py-[0.9rem] font-mono text-body-s uppercase tracking-boton text-sobreoro"
        >
          {sonando ? 'Pausar' : 'Orar conmigo'}
        </button>
        {!oracion.marcas && (
          <p className="m-0 font-mono text-body-s uppercase tracking-label text-texto-debil">
            El texto se ilumina siguiendo la voz
          </p>
        )}
      </div>

      <audio ref={audioRef} src={oracion.audioUrl} preload="auto" onEnded={() => setSonando(false)} />
    </section>
  )
}
