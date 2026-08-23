import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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

/** `m:ss`, que es como se lee el tiempo en un reproductor. */
function reloj(segundos: number): string {
  if (!Number.isFinite(segundos) || segundos < 0) return '0:00'
  const m = Math.floor(segundos / 60)
  const s = Math.floor(segundos % 60)
  return `${m}:${String(s).padStart(2, '0')}`
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
  const marcoRef = useRef<HTMLDivElement>(null)
  const listaRef = useRef<HTMLOListElement>(null)
  /** Cuánto hay que subir la letra para que la línea que suena quede al centro. */
  const [desplazamiento, setDesplazamiento] = useState(0)
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

  /**
   * Sube la letra para que la línea que suena quede siempre en el centro.
   *
   * Las demás siguen en el documento —invisibles, pero ocupando su sitio— para
   * que quien use lector de pantalla tenga la oración entera. El precio es que
   * la lista mide lo que miden sus 59 líneas, mucho más que la pantalla: sin
   * mover nada, lo que se veía era un trozo cualquiera del medio y la línea
   * activa quedaba fuera, a veces cortada contra el borde de abajo.
   */
  useLayoutEffect(() => {
    const marco = marcoRef.current
    const lista = listaRef.current
    if (!marco || !lista) return

    const encuadrar = () => {
      // Antes de la primera marca aún no suena ninguna: se encuadra la primera.
      const item = lista.children[Math.max(0, activa)] as HTMLElement | undefined
      if (!item) return
      setDesplazamiento(marco.clientHeight / 2 - (item.offsetTop + item.offsetHeight / 2))
    }
    encuadrar()

    // Y otra vez cada vez que cambie el tamaño de algo. La cuenta se hace en
    // píxeles, así que deja de valer en cuanto la pantalla gira, la ventana
    // cambia o la tipografía termina de cargar y las líneas se reparten de otro
    // modo: sin esto, al pasar a móvil la letra se iba a cuatro mil píxeles de
    // donde debía y no se veía ninguna.
    const observador = new ResizeObserver(encuadrar)
    observador.observe(marco)
    observador.observe(lista)
    return () => observador.disconnect()
  }, [activa, oracion.lineas])

  /** Ir a un punto de la oración: volver a oír un verso es media oración. */
  const irA = (segundos: number) => {
    const audio = audioRef.current
    if (!audio || !Number.isFinite(segundos)) return
    audio.currentTime = Math.min(Math.max(0, segundos), duracion || 0)
    setTiempo(audio.currentTime)
  }

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

  // Al `body`, y no donde cae en el árbol, por una razón muy concreta: la
  // pantalla entrante vive dentro de `.page-transition`, que anima con
  // `transform` y `fill-mode: both`, así que conserva un `translate3d(0,0,0)`
  // para siempre. Un elemento con `transform` pasa a ser el bloque contenedor
  // de los `fixed` que lleva dentro, y ese envoltorio no mide nada porque su
  // único hijo estaba fuera de flujo. Resultado: este `fixed inset-0` medía
  // CERO píxeles de alto. De ahí salían los tres fallos a la vez —el fondo
  // invisible (`h-full` de cero), la letra descolocada y los mandos fuera de
  // la pantalla—, porque no había altura que repartir. El feed ya esquivaba
  // esto con un portal por lo mismo.
  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-negro"
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

      {/* Dos velos: uno que apaga la escena y otro de color que la tiñe del neón
          de su categoría. Sin ellos la letra se pierde en cuanto el fondo tiene
          una zona clara.

          El primero era plano al 70 % y se comía la imagen entera: en una foto
          nocturna —y casi todas lo son aquí— sus zonas más claras caían a
          17/255, indistinguibles del negro de detrás. Ahora aprieta arriba y
          abajo, que es donde van la cabecera y los mandos, y afloja en la
          franja central, donde el fondo es lo único que hay que mirar. La letra
          se defiende con su propia sombra. */}
      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.42) 24%, ' +
            'rgba(0,0,0,0.42) 68%, rgba(0,0,0,0.88) 100%)',
        }}
      />
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

      {/* La letra. `min-h-0` es lo que permite que este hueco encoja en vez de
          crecer con sus 59 líneas: sin él empujaba los mandos fuera de la
          pantalla y no había manera de parar la oración. */}
      <div ref={marcoRef} className="relative min-h-0 flex-1 overflow-hidden">
        <ol
          ref={listaRef}
          className="absolute inset-x-0 top-0 m-0 mx-auto flex max-w-[38ch] list-none flex-col gap-aire-s p-0 px-gutter text-center transition-transform duration-[700ms] ease-camino motion-reduce:transition-none"
          style={{ transform: `translateY(${desplazamiento}px)` }}
        >
          {oracion.lineas.map((linea, i) => (
            <li
              key={`${oracion.id}-${i}`}
              aria-current={i === activa ? 'true' : undefined}
              className={`font-serif text-[clamp(1.4rem,3.4vw,2.6rem)] leading-[1.25] text-hueso [text-shadow:0_0.2rem_1.2rem_rgba(0,0,0,0.85)] transition-all duration-[700ms] ease-camino motion-reduce:transition-none ${
                i === activa
                  ? 'scale-[1.02] opacity-100 [text-shadow:0_0.2rem_1.2rem_rgba(0,0,0,0.85),0_0_2.4rem_rgba(var(--neon),0.85)]'
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

        {/* Cuánto queda, y por dónde volver: en una oración importa saber si va
            por la mitad, y volver a oír un verso es media oración. La barra era
            solo un dibujo; ahora se puede llevar donde uno quiera, con el
            teclado también, que para eso es un control de verdad. */}
        <div className="flex w-full max-w-md items-center gap-aire-xs">
          <span className="font-mono text-body-s tabular-nums text-hueso/50">
            {reloj(tiempo)}
          </span>
          <div className="relative flex-1">
            <div className="h-[2px] w-full overflow-hidden bg-hueso/15">
              <span
                className="block h-full transition-[width] duration-300 ease-linear"
                style={{ width: `${avance}%`, background: 'rgb(var(--neon))' }}
              />
            </div>
            <input
              type="range"
              min={0}
              max={duracion || 0}
              step={0.1}
              value={tiempo}
              onChange={(e) => irA(Number(e.target.value))}
              aria-label="Ir a un punto de la oración"
              // Invisible y encima de la barra: se ve el trazo del diseño y se
              // maneja como un control nativo, con foco y flechas incluidos.
              className="absolute inset-x-0 top-1/2 h-6 w-full -translate-y-1/2 cursor-pointer appearance-none bg-transparent opacity-0"
            />
          </div>
          <span className="font-mono text-body-s tabular-nums text-hueso/50">
            {reloj(duracion)}
          </span>
        </div>
      </div>

      <audio
        ref={audioRef}
        src={oracion.audioUrl}
        preload="auto"
        onEnded={() => setSonando(false)}
      />
    </div>,
    document.body,
  )
}
