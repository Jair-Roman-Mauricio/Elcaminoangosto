import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BrandLogo } from '@elcamino/ui/static'
import { useRegistrarVisita } from '../lib/analitica'

/** Un plano de la historia: su video, cuándo entra y lo que se lee encima. */
interface Escena {
  video: string
  /** Segundo de la narración en el que empieza su frase. */
  desde: number
  /** Frase que aparece sobre el plano. El primero entra en silencio. */
  mensaje: string | null
  /** Referencia bíblica, cuando la frase la tiene. */
  referencia?: string
}

const plano = (
  n: number,
  desde: number,
  mensaje: string | null,
  referencia?: string,
): Escena => ({
  video: `/videos-lading/plano-${String(n).padStart(2, '0')}.mp4`,
  desde,
  mensaje,
  ...(referencia ? { referencia } : {}),
})

/**
 * Nueve planos, de las manos a las manos.
 *
 * El recorrido es circular a propósito: empieza en las marcas de los clavos,
 * atraviesa la herida hacia su historia y vuelve a la misma mano, ya abierta y
 * a plena luz. Quien llega hasta el final ha dado la vuelta entera.
 */
const ESCENAS: Escena[] = [
  plano(1, 0, null),
  plano(2, 9.92, 'Por sus heridas, fuimos sanados', 'Isaías 53:5'),
  plano(3, 20.27, 'Vino a caminar donde tú caminas'),
  plano(4, 29.36, 'Se detuvo por uno'),
  plano(5, 38.83, 'Aun la tormenta lo obedece', 'Marcos 4:39'),
  plano(6, 48.6, 'Cargó lo que no le tocaba'),
  plano(7, 55.63, 'Pero el domingo llegó'),
  plano(8, 65.24, 'El camino se recorre juntos', 'Mateo 7:14'),
  plano(9, 73.4, 'Su mano sigue abierta'),
]

const ULTIMA = ESCENAS.length - 1

/** Dónde termina de hablar. Lo que sigue es el paso a la plataforma. */
const FIN_NARRACION = 82.28
/** Todos los planos duran lo mismo de origen. */
const DURACION_PLANO = 10
/**
 * Hasta dónde se puede acelerar un plano sin que se note.
 *
 * La frase de la cruz dura siete segundos sobre un plano de diez: encajarlo
 * exigiría un x1.42 y unos pies arrastrando un madero a esa velocidad dejan de
 * pesar. Pasado el tope, en vez de correr más se entra al plano más tarde: lo
 * que no puede perderse es el final, donde está lo que el plano venía a decir.
 */
const RITMO_MAXIMO = 1.25

/**
 * Cómo se reproduce un plano para que su final caiga justo con su frase.
 *
 * Se ajusta el ritmo, y si hiciera falta correr demasiado se recorta por el
 * principio. Nunca por el final: ahí está la piedra que se mueve y la mano que
 * se abre, que es lo que el plano vino a contar.
 */
function encaje(segundos: number): { ritmo: number; desde: number } {
  const ritmo = Math.min(RITMO_MAXIMO, DURACION_PLANO / segundos)
  return { ritmo, desde: Math.max(0, DURACION_PLANO - segundos * ritmo) }
}

/**
 * Landing: la historia se cuenta sola.
 *
 * No hay secciones que recorrer ni nada que buscar. Se entra, se mira y, si
 * algo de lo que se ve mueve, se pasa.
 *
 * **La voz gobierna el tiempo.** Cada plano dura lo que dura su frase, y el
 * video se repite debajo hasta que termina. Al revés —el video mandando— las
 * frases largas se cortaban a media palabra, que es justo donde una promesa
 * deja de sonar a promesa.
 */
export function LandingCinematica() {
  useRegistrarVisita('landing')
  const [iniciado, setIniciado] = useState(false)
  const [escena, setEscena] = useState(0)
  const [terminado, setTerminado] = useState(false)
  const navegar = useNavigate()
  const vozRef = useRef<HTMLAudioElement | null>(null)
  const videosRef = useRef<(HTMLVideoElement | null)[]>([])

  const irA = useCallback((indice: number) => {
    const destino = Math.max(0, Math.min(ULTIMA, indice))
    // Saltar de plano mueve la narración con él: si no, la voz seguiría
    // contando otra cosa sobre la imagen nueva.
    const voz = vozRef.current
    if (voz) voz.currentTime = ESCENAS[destino]!.desde
    setEscena(destino)
  }, [])

  /**
   * Una sola narración para los nueve planos.
   *
   * Antes había una pista por plano y cada empalme era una costura que había
   * que disimular con desvanecidos. Con una sola toma no hay nada que empalmar:
   * la voz no se entera de que la imagen cambia.
   *
   * Y pasa a ser el reloj. El tiempo lo lleva ella —`timeupdate` contra los
   * cortes que Whisper encontró en la propia grabación—, así que la imagen no
   * puede desfasarse de lo que se está diciendo.
   */
  useEffect(() => {
    const voz = new Audio('/videos-lading/audio-completo.mp3')
    voz.preload = 'auto'
    vozRef.current = voz
    return () => {
      voz.pause()
      voz.src = ''
    }
  }, [])

  /** La narración manda: el plano es el que corresponde al segundo en curso. */
  useEffect(() => {
    const voz = vozRef.current
    if (!iniciado || !voz) return

    const alAvanzar = () => {
      const t = voz.currentTime
      let corresponde = 0
      for (let i = ESCENAS.length - 1; i >= 0; i -= 1) {
        if (t >= ESCENAS[i]!.desde) {
          corresponde = i
          break
        }
      }
      setEscena((actual) => (actual === corresponde ? actual : corresponde))
    }

    voz.addEventListener('timeupdate', alAvanzar)
    voz.addEventListener('ended', () => setTerminado(true))
    void voz.play().catch(() => undefined)
    return () => voz.removeEventListener('timeupdate', alAvanzar)
  }, [iniciado])

  /**
   * Cada plano se ajusta para que su final caiga con el final de su frase.
   *
   * Sin bucle: el de la tumba volvería a cerrar la piedra y el del camino
   * saltaría hacia atrás en la subida. Un plano que se repite deshace lo que
   * acaba de contar.
   */
  useEffect(() => {
    if (!iniciado) return
    const video = videosRef.current[escena]
    if (!video) return
    const hasta = escena < ULTIMA ? ESCENAS[escena + 1]!.desde : FIN_NARRACION
    const { ritmo, desde } = encaje(hasta - ESCENAS[escena]!.desde)
    video.playbackRate = ritmo
    video.currentTime = desde
    void video.play().catch(() => undefined)
  }, [escena, iniciado])

  /**
   * Terminada la historia, se pasa a la plataforma sin preguntar.
   *
   * El botón de cierre sobraba: quien ha llegado hasta el último plano ya
   * decidió. El segundo de espera es para que la última frase termine de caer
   * y la mano abierta se quede un instante en pantalla; sin él, el corte pisa
   * el final.
   */
  useEffect(() => {
    if (!terminado) return
    // Quien ha visto la historia entera llega con el recorrido pedido. Quien
    // pulsó «Entrar» para saltársela no: si tuvo prisa para la historia, la
    // tendrá para el tutorial.
    const paso = window.setTimeout(() => navegar('/tarjetas', { state: { recorrido: true } }), 1200)
    return () => window.clearTimeout(paso)
  }, [terminado, navegar])

  /**
   * Un gesto adelanta un plano.
   *
   * El bloqueo por silencio es por el trackpad: un deslizamiento manda decenas
   * de eventos y su inercia sigue empujando después de levantar los dedos.
   */
  useEffect(() => {
    if (!iniciado) return
    let ultimoEvento = 0
    let bloqueado = false

    const avanzar = (direccion: number) =>
      setEscena((actual) => {
        const siguiente = Math.max(0, Math.min(ULTIMA, actual + direccion))
        const voz = vozRef.current
        if (voz && siguiente !== actual) voz.currentTime = ESCENAS[siguiente]!.desde
        return siguiente
      })

    const alRodar = (evento: WheelEvent) => {
      if (Math.abs(evento.deltaY) <= Math.abs(evento.deltaX)) return
      evento.preventDefault()
      const ahora = evento.timeStamp
      if (ahora - ultimoEvento > 150) bloqueado = false
      ultimoEvento = ahora
      if (bloqueado) return
      bloqueado = true
      avanzar(Math.sign(evento.deltaY))
    }

    const alTeclear = (evento: KeyboardEvent) => {
      if (['ArrowDown', 'ArrowRight', 'PageDown', ' '].includes(evento.key)) {
        evento.preventDefault()
        avanzar(1)
      }
      if (['ArrowUp', 'ArrowLeft', 'PageUp'].includes(evento.key)) {
        evento.preventDefault()
        avanzar(-1)
      }
    }

    window.addEventListener('wheel', alRodar, { passive: false })
    window.addEventListener('keydown', alTeclear)
    return () => {
      window.removeEventListener('wheel', alRodar)
      window.removeEventListener('keydown', alTeclear)
    }
  }, [iniciado])

  const actual = ESCENAS[escena]!

  return (
    <div data-theme="dark" className="relative h-[100svh] w-full overflow-hidden bg-negro">
      {/* Los planos se apilan y solo se ve el activo. Se carga el actual y sus
          vecinos: con los nueve a la vez, la primera pantalla arrastraba 18 MB
          que casi nadie llega a ver.

          No van en bucle: repetir el de la tumba volvería a cerrar la piedra.
          En su lugar cada uno se ajusta al tiempo de su frase. */}
      {ESCENAS.map((e, i) => {
        const cerca = Math.abs(i - escena) <= 1
        return (
          <video
            key={e.video}
            ref={(nodo) => {
              videosRef.current[i] = nodo
            }}
            {...(cerca ? { src: e.video } : {})}
            muted
            playsInline
            preload={cerca ? 'auto' : 'none'}
            aria-hidden="true"
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1200ms] ease-camino motion-reduce:transition-none ${
              i === escena ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )
      })}

      {/* Velo: sin él, un texto claro sobre un plano claro no se lee. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-negro/70 via-negro/20 to-negro/80"
      />

      {/* La cabecera va POR ENCIMA de la puerta de entrada: quien ya conoce la
          historia no tiene que verla otra vez para poder pasar. El velo cubre
          la pantalla, pero nunca la salida. */}
      <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-aire-s px-gutter py-aire-m">
        <BrandLogo layout="horizontal" tone="light" size="md" decorative />
        <Link
          to="/tarjetas"
          className="rounded-full border border-acento bg-oro brillo-oro px-aire-s py-[0.35rem] font-mono text-body-s uppercase tracking-label text-sobreoro no-underline"
        >
          Entrar
        </Link>
      </header>

      {/* El mensaje del plano. Va en serif, como los versículos: es la misma voz
          del sistema y aquí todo lo que se lee es Palabra o eco de ella. */}
      <div className="pointer-events-none absolute inset-0 grid place-items-center px-gutter">
        {iniciado && (
          <p
            key={escena}
            className="m-0 max-w-[22ch] animate-[mensaje-entra_1400ms_var(--ease)_both] text-center font-serif text-[clamp(1.8rem,5vw,4rem)] font-light leading-[1.15] text-hueso [text-shadow:0_0.15em_0.9em_rgba(0,0,0,0.75)]"
          >
            {actual.mensaje}
            {actual.referencia && (
              <span className="mt-aire-s block font-mono text-body-s uppercase tracking-label text-hueso/70">
                {actual.referencia}
              </span>
            )}
          </p>
        )}
      </div>

      {/* La puerta de entrada.
          Existe por una razón práctica —ningún navegador deja sonar audio sin
          un gesto previo, y aquí la voz es la mitad de la pieza— y por una de
          fondo: entrar es una decisión, y empezar pulsando ya es dar el primer
          paso. */}
      {!iniciado && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-negro/45 px-gutter backdrop-blur-[2px]">
          <button
            type="button"
            onClick={() => setIniciado(true)}
            className="group relative grid size-[clamp(11rem,22vw,15rem)] place-items-center rounded-full border border-acento bg-negro/40 font-mono text-body-s uppercase leading-[1.6] tracking-label text-hueso transition-colors duration-fade ease-camino hover:bg-oro hover:text-sobreoro"
          >
            {/* Dos anillos que laten hacia fuera: la señal de «pulsa aquí» sin
                tener que escribir «pulsa aquí». */}
            <span
              aria-hidden
              className="absolute inset-0 rounded-full border border-acento/70 motion-safe:animate-[latido_2600ms_var(--ease)_infinite]"
            />
            <span
              aria-hidden
              className="absolute inset-0 rounded-full border border-acento/40 motion-safe:animate-[latido_2600ms_var(--ease)_infinite_900ms]"
            />
            <span className="max-w-[8ch] text-center">Comienza el camino</span>
          </button>

          {/* La misma indicación que da la voz, escrita.
              Ningún navegador deja sonar audio sin un gesto previo, así que si
              esto dependiera solo de la locución, quien llegue con el sonido
              bloqueado no sabría qué se espera de él. */}
          <p className="pointer-events-none absolute inset-x-0 bottom-[12vh] m-0 px-gutter text-center font-mono text-body-s uppercase leading-relaxed tracking-label text-hueso/70">
            ¿Primera vez? Pulsa el círculo y mira la historia.
            <br />
            ¿Ya conoces la plataforma? Entra directo arriba a la derecha.
          </p>
        </div>
      )}

      {/* Dónde va la historia. Nueve trazos, el andado en oro. */}
      {iniciado && (
        <nav
          aria-label="Planos"
          className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-[0.4rem] px-gutter py-aire-m"
        >
          {ESCENAS.map((e, i) => (
            <button
              key={e.video}
              type="button"
              onClick={() => irA(i)}
              aria-label={`Plano ${i + 1}`}
              aria-current={i === escena}
              className={`h-[2px] w-8 rounded-full transition-colors duration-fade ease-camino ${
                i <= escena ? 'bg-acento' : 'bg-hueso/25 hover:bg-hueso/50'
              }`}
            />
          ))}
        </nav>
      )}
    </div>
  )
}
