import { useEffect, useMemo, useRef, useState } from 'react'
import type { OracionGuiada } from './lecturas-api'
import { neonDeCategoria } from './neon-de-categoria'

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

/**
 * La oración en marcha: el fondo a pantalla completa y la letra encima.
 *
 * Solo se ve la línea que se está diciendo, con la anterior y la siguiente
 * apenas insinuadas. Es lo contrario del listado, donde el texto entero está a
 * la vista: aquí no se lee, se acompaña, y tener seis líneas delante invita a
 * ir por delante de la voz en vez de con ella.
 */
export function RezoEnMarcha({
  oracion,
  onSalir,
}: {
  oracion: OracionGuiada
  onSalir: () => void
}) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [duracion, setDuracion] = useState(0)
  const [tiempo, setTiempo] = useState(0)
  const [sonando, setSonando] = useState(false)
  const neon = neonDeCategoria(oracion.tema)

  const marcas = useMemo(() => {
    if (oracion.marcas && oracion.marcas.length === oracion.lineas.length) return oracion.marcas
    if (!duracion) return null
    return repartirPorLongitud(oracion.lineas, duracion)
  }, [duracion, oracion.lineas, oracion.marcas])

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

  // Se entra aquí para rezar, así que empieza sola. El clic que trajo hasta
  // aquí cuenta como permiso para el navegador; si aun así lo bloquea, queda el
  // botón, que es lo que se ve.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    void audio
      .play()
      .then(() => setSonando(true))
      .catch(() => setSonando(false))
  }, [])

  // El fondo acompaña a la voz: si la oración se pausa, el video también.
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (sonando) void video.play().catch(() => undefined)
    else video.pause()
  }, [sonando])

  const alternar = () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      void audio
        .play()
        .then(() => setSonando(true))
        .catch(() => undefined)
    } else {
      audio.pause()
      setSonando(false)
    }
  }

  const avance = duracion ? Math.min(100, (tiempo / duracion) * 100) : 0

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-negro"
      style={{ ['--neon' as string]: neon }}
    >
      {oracion.fondoUrl &&
        (oracion.fondoEsVideo ? (
          <video
            ref={videoRef}
            src={oracion.fondoUrl}
            muted
            loop
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <img
            src={oracion.fondoUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ))}

      {/* Dos velos: uno plano que apaga la escena y otro de color que la tiñe
          del neón de su categoría. Sin ellos la letra se pierde en cuanto el
          fondo tiene una zona clara. */}
      <span aria-hidden className="absolute inset-0 bg-negro/70" />
      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 80% at 50% 100%, rgba(var(--neon), 0.28) 0%, transparent 65%)',
        }}
      />

      <header className="relative flex items-center justify-between gap-aire-s px-gutter pt-aire-m">
        <p className="m-0 font-mono text-body-s uppercase tracking-label text-hueso/70">
          {oracion.tema ? `${oracion.tema} · ` : ''}
          {oracion.titulo}
        </p>
        <button
          type="button"
          onClick={onSalir}
          className="border-0 bg-transparent p-0 font-mono text-body-s uppercase tracking-label text-hueso/70 transition-colors duration-fade ease-camino hover:text-hueso"
        >
          Salir
        </button>
      </header>

      {/* La letra, centrada en la pantalla. */}
      <div className="relative flex flex-1 items-center justify-center px-gutter">
        <ol className="m-0 flex max-w-[38ch] list-none flex-col gap-aire-s p-0 text-center">
          {oracion.lineas.map((linea, i) => (
            <li
              key={`${oracion.id}-${i}`}
              aria-current={i === activa ? 'true' : undefined}
              className={`font-serif text-[clamp(1.4rem,3.4vw,2.6rem)] leading-[1.25] text-hueso transition-all duration-[700ms] ease-camino motion-reduce:transition-none ${
                i === activa
                  ? 'scale-[1.02] opacity-100 [text-shadow:0_0_2.4rem_rgba(var(--neon),0.85)]'
                  : Math.abs(i - activa) === 1
                    ? 'opacity-30'
                    : 'opacity-0'
              }`}
            >
              {linea}
            </li>
          ))}
        </ol>
      </div>

      <div className="relative flex flex-col items-center gap-aire-s px-gutter pb-aire-l">
        <button
          type="button"
          onClick={alternar}
          aria-label={sonando ? 'Pausar la oración' : 'Seguir orando'}
          className="grid size-16 place-items-center rounded-full border text-hueso transition-colors duration-fade ease-camino"
          style={{
            borderColor: 'rgba(var(--neon), 0.6)',
            boxShadow: '0 0 2.5rem rgba(var(--neon), 0.35)',
            background: 'rgba(var(--neon), 0.12)',
          }}
        >
          {sonando ? (
            <svg viewBox="0 0 24 24" className="size-6" fill="currentColor" aria-hidden>
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="size-6" fill="currentColor" aria-hidden>
              <path d="M8 5.5v13l11-6.5-11-6.5Z" />
            </svg>
          )}
        </button>

        {/* Cuánto queda: en una oración importa saber si va por la mitad. */}
        <div className="h-[2px] w-full max-w-md overflow-hidden bg-hueso/15">
          <span
            className="block h-full transition-[width] duration-300 ease-linear"
            style={{ width: `${avance}%`, background: 'rgb(var(--neon))' }}
          />
        </div>
      </div>

      <audio
        ref={audioRef}
        src={oracion.audioUrl}
        preload="auto"
        onEnded={() => setSonando(false)}
      />
    </div>
  )
}
