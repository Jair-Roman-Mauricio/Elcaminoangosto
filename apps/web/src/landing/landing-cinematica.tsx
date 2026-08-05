import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BrandLogo } from '@elcamino/ui/static'
import { useRegistrarVisita } from '../lib/analitica'

/** Un plano de la historia: su video, su voz y lo que se lee encima. */
interface Escena {
  video: string
  /** Voz de este plano. Manda ella: el plano dura lo que dura la frase. */
  voz: string
  /** Frase que aparece sobre el plano. El primero entra en silencio. */
  mensaje: string | null
  /** Referencia bíblica, cuando la frase la tiene. */
  referencia?: string
}

const plano = (n: number, mensaje: string | null, referencia?: string): Escena => ({
  video: `/videos-lading/plano-${String(n).padStart(2, '0')}.mp4`,
  voz: `/videos-lading/voz-${String(n).padStart(2, '0')}.mp3`,
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
  plano(1, null),
  plano(2, 'Por sus heridas, fuimos sanados', 'Isaías 53:5'),
  plano(3, 'Vino a caminar donde tú caminas'),
  plano(4, 'Se detuvo por uno'),
  plano(5, 'Aun la tormenta lo obedece', 'Marcos 4:39'),
  plano(6, 'Cargó lo que no le tocaba'),
  plano(7, 'Pero el domingo llegó'),
  plano(8, 'El camino se recorre juntos', 'Mateo 7:14'),
  plano(9, 'Su mano sigue abierta'),
]

const ULTIMA = ESCENAS.length - 1

/** Si una voz no puede sonar, el plano no puede quedarse clavado para siempre. */
const RESPALDO_MS = 15_000

/**
 * Sube o baja el volumen de una pista poco a poco.
 *
 * Cortar una voz en seco se oye como un error de montaje. Trescientos
 * milisegundos bastan para que el oído lo lea como un final y no como un tajo.
 */
function desvanecer(pista: HTMLAudioElement, destino: number, ms: number): Promise<void> {
  return new Promise((listo) => {
    const desde = pista.volume
    const inicio = performance.now()
    const paso = (ahora: number) => {
      const avance = Math.min(1, (ahora - inicio) / ms)
      pista.volume = Math.max(0, Math.min(1, desde + (destino - desde) * avance))
      if (avance < 1) requestAnimationFrame(paso)
      else listo()
    }
    requestAnimationFrame(paso)
  })
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
  const vocesRef = useRef<HTMLAudioElement[]>([])
  const videosRef = useRef<(HTMLVideoElement | null)[]>([])

  const irA = useCallback((indice: number) => {
    const destino = Math.max(0, Math.min(ULTIMA, indice))
    setEscena(destino)
    if (destino >= ULTIMA) setTerminado(true)
  }, [])

  // Las pistas se crean una sola vez y se precargan: si se pidieran al entrar
  // en cada plano, la voz llegaría tarde y el silencio inicial se notaría.
  useEffect(() => {
    vocesRef.current = ESCENAS.map((e) => {
      const pista = new Audio(e.voz)
      pista.preload = 'auto'
      return pista
    })
    const pistas = vocesRef.current
    return () => {
      for (const pista of pistas) {
        pista.pause()
        pista.src = ''
      }
    }
  }, [])

  /**
   * Entrar en un plano: arranca su video, desvanece la voz anterior, levanta la
   * suya y espera a que termine para pasar al siguiente.
   */
  useEffect(() => {
    if (!iniciado) return

    const video = videosRef.current[escena]
    if (video) {
      video.currentTime = 0
      void video.play().catch(() => undefined)
    }

    for (const [i, pista] of vocesRef.current.entries()) {
      if (i === escena || pista.paused) continue
      void desvanecer(pista, 0, 300).then(() => {
        pista.pause()
        pista.currentTime = 0
        pista.volume = 1
      })
    }

    const voz = vocesRef.current[escena]
    if (!voz) return

    voz.currentTime = 0
    voz.volume = 0
    void voz
      .play()
      .then(() => desvanecer(voz, 1, 400))
      .catch(() => undefined)

    const alTerminar = () => (escena < ULTIMA ? irA(escena + 1) : setTerminado(true))
    voz.addEventListener('ended', alTerminar)
    const respaldo = window.setTimeout(alTerminar, RESPALDO_MS)

    return () => {
      voz.removeEventListener('ended', alTerminar)
      window.clearTimeout(respaldo)
    }
  }, [escena, iniciado, irA])

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
    const paso = window.setTimeout(() => navegar('/tarjetas'), 1200)
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
        if (siguiente >= ULTIMA) setTerminado(true)
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

          Van en bucle porque la voz puede durar más que el video —hay frases de
          doce segundos sobre planos de diez— y una imagen congelada delataría
          la costura. */}
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
            loop
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
