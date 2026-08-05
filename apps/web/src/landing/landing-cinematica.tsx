import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { BrandLogo } from '@elcamino/ui/static'
import { useRegistrarVisita } from '../lib/analitica'

/** Un plano de la historia: su video y lo que se lee encima. */
interface Escena {
  video: string
  /** Voz de este plano. Suena cuando el plano entra, y con él termina. */
  voz: string
  /** Frase que aparece sobre el plano. El primero entra en silencio. */
  mensaje: string | null
  /** Referencia bíblica, cuando la frase la tiene. */
  referencia?: string
}

/**
 * Nueve planos, de las manos a las manos.
 *
 * El recorrido es circular a propósito: empieza en las marcas de los clavos,
 * atraviesa la herida hacia su historia y vuelve a la misma mano, ya abierta y
 * a plena luz. Quien llega hasta el final ha dado la vuelta entera.
 */
const ESCENAS: Escena[] = [
  { video: '/videos-lading/plano-01.mp4',
    voz: '/videos-lading/voz-01.mp3', mensaje: null },
  {
    video: '/videos-lading/plano-02.mp4',
    voz: '/videos-lading/voz-02.mp3',
    mensaje: 'Por sus heridas, fuimos sanados',
    referencia: 'Isaías 53:5',
  },
  { video: '/videos-lading/plano-03.mp4',
    voz: '/videos-lading/voz-03.mp3', mensaje: 'Vino a caminar donde tú caminas' },
  { video: '/videos-lading/plano-04.mp4',
    voz: '/videos-lading/voz-04.mp3', mensaje: 'Se detuvo por uno' },
  {
    video: '/videos-lading/plano-05.mp4',
    voz: '/videos-lading/voz-05.mp3',
    mensaje: 'Aun la tormenta lo obedece',
    referencia: 'Marcos 4:39',
  },
  { video: '/videos-lading/plano-06.mp4',
    voz: '/videos-lading/voz-06.mp3', mensaje: 'Cargó lo que no le tocaba' },
  { video: '/videos-lading/plano-07.mp4',
    voz: '/videos-lading/voz-07.mp3', mensaje: 'Pero el domingo llegó' },
  {
    video: '/videos-lading/plano-08.mp4',
    voz: '/videos-lading/voz-08.mp3',
    mensaje: 'El camino se recorre juntos',
    referencia: 'Mateo 7:14',
  },
  { video: '/videos-lading/plano-09.mp4',
    voz: '/videos-lading/voz-09.mp3', mensaje: 'Su mano sigue abierta' },
]

const ULTIMA = ESCENAS.length - 1

/**
 * Landing: la historia se cuenta sola.
 *
 * No hay secciones que recorrer ni nada que buscar. Entra, mira y, si algo de
 * lo que ve le mueve, pasa. Por eso el avance es automático —cada plano dura lo
 * que dura— y lo único que se le pide a quien llega es quedarse.
 *
 * Aun así nada está encerrado: la rueda, las flechas y un clic adelantan, y la
 * puerta a la plataforma está siempre visible. Una pieza que no deja salir no
 * transmite esperanza, transmite encierro.
 */
export function LandingCinematica() {
  useRegistrarVisita('landing')
  const [escena, setEscena] = useState(0)
  const [conVoz, setConVoz] = useState(false)
  /** Si se silenció a mano. Entonces no se vuelve a intentar por su cuenta. */
  const silenciadoRef = useRef(false)
  const [terminado, setTerminado] = useState(false)
  /**
   * Una pista por plano, creadas una sola vez y precargadas.
   *
   * Se descartó el audio único de 90 s: tenía que casar con nueve videos que
   * cada navegador arranca con milisegundos distintos, y acababa desfasado
   * siempre. Con una pista por plano no hay nada que sincronizar — la voz
   * empieza cuando su plano empieza, y si sobra silencio al final, mejor.
   */
  const vocesRef = useRef<HTMLAudioElement[]>([])
  const escenaRef = useRef(0)
  const videosRef = useRef<(HTMLVideoElement | null)[]>([])

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

  const irA = useCallback((indice: number) => {
    setEscena(Math.max(0, Math.min(ULTIMA, indice)))
    if (indice >= ULTIMA) setTerminado(true)
  }, [])

  // El plano activo empieza desde su primer fotograma. Sin esto, al volver
  // atrás se retomaba a mitad y el corte no cuadraba con el texto.
  useEffect(() => {
    escenaRef.current = escena
    const video = videosRef.current[escena]
    if (video) {
      video.currentTime = 0
      void video.play().catch(() => undefined)
    }

    // La voz del plano anterior calla en seco: dos voces solapadas no se
    // entienden, y aquí cada frase pertenece a una imagen concreta.
    vocesRef.current.forEach((pista, i) => {
      if (i === escena) return
      pista.pause()
      pista.currentTime = 0
    })

    const voz = vocesRef.current[escena]
    if (!voz || silenciadoRef.current) return
    voz.currentTime = 0
    void voz.play().then(() => setConVoz(true)).catch(() => undefined)
  }, [escena])

  /**
   * Un gesto adelanta un plano.
   *
   * La rueda se atiende en `window` y por coordenadas no hace falta: la escena
   * ocupa la pantalla entera. Lo que sí hace falta es el bloqueo por silencio,
   * porque un trackpad manda decenas de eventos por gesto y su inercia sigue
   * empujando después de levantar los dedos.
   */
  useEffect(() => {
    let ultimoEvento = 0
    let bloqueado = false

    const avanzar = (direccion: number) => setEscena((actual) => {
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
  }, [])

  /**
   * La voz suena desde el principio.
   *
   * Ningún navegador deja arrancar audio audible sin un gesto previo, así que
   * no basta con pedirlo al montar: se intenta, y si lo bloquean queda armado
   * para el primer movimiento de quien entra —una rueda, una tecla, un toque—.
   * No se le pide permiso a nadie; se le da la opción de callarla.
   *
   * Si la silencia a mano, no vuelve a intentarse: repetirlo sería discutir
   * con quien ya decidió.
   */
  useEffect(() => {
    const intentar = () => {
      const voz = vocesRef.current[escenaRef.current]
      if (!voz || silenciadoRef.current || !voz.paused) return
      void voz
        .play()
        .then(() => {
          setConVoz(true)
          quitarEscuchas()
        })
        .catch(() => undefined)
    }

    const gestos = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const
    const quitarEscuchas = () => {
      for (const gesto of gestos) window.removeEventListener(gesto, intentar)
    }

    intentar()
    for (const gesto of gestos) window.addEventListener(gesto, intentar, { passive: true })
    return quitarEscuchas
  }, [])

  const alternarVoz = () => {
    const voz = vocesRef.current[escena]
    if (!voz) return
    if (conVoz) {
      voz.pause()
      silenciadoRef.current = true
      setConVoz(false)
      return
    }
    silenciadoRef.current = false
    void voz.play().then(() => setConVoz(true)).catch(() => undefined)
  }

  const actual = ESCENAS[escena]!

  return (
    <div data-theme="dark" className="relative h-[100svh] w-full overflow-hidden bg-negro">
      {/* Los planos se apilan y solo se ve el activo. Se carga el actual y sus
          vecinos: con los nueve a la vez, la primera pantalla arrastraba 23 MB
          que casi nadie llega a ver. */}
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
            onEnded={() => {
              // Cada plano dura lo que dura: al acabar, pasa el siguiente. El
              // último se queda quieto, con la mano abierta en pantalla.
              if (i === escena && i < ULTIMA) irA(i + 1)
              else if (i === ULTIMA) setTerminado(true)
            }}
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

      <header className="absolute inset-x-0 top-0 flex items-center justify-between gap-aire-s px-gutter py-aire-m">
        <BrandLogo layout="horizontal" tone="light" size="md" decorative />
        <div className="flex items-center gap-aire-s">
          <button
            type="button"
            onClick={alternarVoz}
            aria-pressed={conVoz}
            className="rounded-full border border-hueso/40 px-aire-s py-[0.35rem] font-mono text-body-s uppercase tracking-label text-hueso transition-colors duration-fade ease-camino hover:border-acento hover:text-acento"
          >
            {conVoz ? 'Silenciar' : 'Con voz'}
          </button>
          <Link
            to="/tarjetas"
            className="rounded-full border border-acento bg-oro brillo-oro px-aire-s py-[0.35rem] font-mono text-body-s uppercase tracking-label text-sobreoro no-underline"
          >
            Entrar
          </Link>
        </div>
      </header>

      {/* El mensaje del plano. Va en serif, como los versículos: es la misma
          voz del sistema y aquí todo lo que se lee es Palabra o eco de ella. */}
      <div className="pointer-events-none absolute inset-0 grid place-items-center px-gutter">
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
      </div>

      {/* Cierre: cuando la historia termina, la única salida es hacia dentro. */}
      {terminado && (
        <div className="absolute inset-x-0 bottom-0 grid place-items-center gap-aire-s px-gutter pb-[6rem] pt-aire-l">
          <Link
            to="/tarjetas"
            className="animate-[mensaje-entra_900ms_var(--ease)_both] rounded-full border border-acento bg-oro brillo-oro px-[2.4rem] py-[0.9rem] font-mono text-body-s uppercase tracking-boton text-sobreoro no-underline"
          >
            Comienza a caminar
          </Link>
        </div>
      )}

      {/* Dónde va la historia. Nueve trazos, el andado en oro. */}
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

    </div>
  )
}
