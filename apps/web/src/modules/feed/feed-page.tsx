import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { BrandLogo } from '@elcamino/ui/static'
import { usePerfil } from '../../auth/session'
import { useFeed, type FeedCard } from './feed-api'

const formatoFecha = new Intl.DateTimeFormat('es-PE', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

type Punto = { x: number; y: number }

const tarjetasMuestra: FeedCard[] = [
  {
    id: 'muestra-templo-luz',
    authorName: 'Annie Spratt',
    type: 'IMAGE',
    caption: 'La luz encuentra caminos incluso entre las columnas más antiguas.',
    mediaUrl: 'https://images.unsplash.com/photo-1461771465070-80531c6afc3c',
    posterUrl: null,
    publishedAt: '2026-07-15T12:00:00.000Z',
  },
  {
    id: 'muestra-siguiente-paso',
    authorName: 'El Camino Angosto',
    type: 'IMAGE',
    caption: 'No necesitas ver todo el camino para dar el siguiente paso.',
    mediaUrl: '/media/tarjeta-fe-siguiente-paso-960.webp',
    posterUrl: null,
    publishedAt: '2026-07-20T12:00:00.000Z',
  },
  {
    id: 'muestra-biblia-sol',
    authorName: 'Aaron Burden',
    type: 'IMAGE',
    caption: 'Una palabra abierta puede iluminar el siguiente paso.',
    mediaUrl: 'https://images.unsplash.com/photo-1747738609473-9e92707075eb',
    posterUrl: null,
    publishedAt: '2026-07-14T12:00:00.000Z',
  },
  {
    id: 'muestra-puerta',
    authorName: 'CHUTTERSNAP',
    type: 'IMAGE',
    caption: 'Toda puerta recuerda que la fe también es una decisión.',
    mediaUrl: 'https://images.unsplash.com/photo-1521633264041-6bfd17168b65',
    posterUrl: null,
    publishedAt: '2026-07-13T12:00:00.000Z',
  },
  {
    id: 'muestra-santuario',
    authorName: 'Garrett Anderson',
    type: 'IMAGE',
    caption: 'Hay espacios que invitan al corazón a guardar silencio.',
    mediaUrl: 'https://images.unsplash.com/photo-1501639977519-a7ef73115102',
    posterUrl: null,
    publishedAt: '2026-07-12T12:00:00.000Z',
  },
  {
    id: 'muestra-vitral',
    authorName: 'JF Martin',
    type: 'IMAGE',
    caption: 'La gracia transforma el vidrio quebrado en una historia de color.',
    mediaUrl: 'https://images.unsplash.com/photo-1541362089225-312097120732',
    posterUrl: null,
    publishedAt: '2026-07-11T12:00:00.000Z',
  },
  {
    id: 'muestra-palabra',
    authorName: 'Christopher Stites',
    type: 'IMAGE',
    caption: 'Vuelve a la Palabra hasta que el camino se haga visible.',
    mediaUrl: 'https://images.unsplash.com/photo-1777421389268-ebefab72e96d',
    posterUrl: null,
    publishedAt: '2026-07-10T12:00:00.000Z',
  },
  {
    id: 'muestra-biblia-manos',
    authorName: 'Christopher Stites',
    type: 'IMAGE',
    caption: 'Recibir la verdad también es aprender a sostenerla con cuidado.',
    mediaUrl: 'https://images.unsplash.com/photo-1777421389422-519764272b2f',
    posterUrl: null,
    publishedAt: '2026-07-09T12:00:00.000Z',
  },
]

const patronMosaico = [
  { columna: 1, fila: 1, columnas: 6, filas: 2, formato: 'extraancha' },
  { columna: 1, fila: 3, columnas: 2, filas: 4, formato: 'vertical' },
  { columna: 3, fila: 3, columnas: 4, filas: 2, formato: 'panoramica' },
  { columna: 3, fila: 5, columnas: 2, filas: 2, formato: 'cuadrada' },
  { columna: 5, fila: 5, columnas: 2, filas: 2, formato: 'cuadrada' },
] as const

function urlUnsplash(mediaUrl: string, ancho: number): string {
  const base = mediaUrl.split('?')[0]
  return `${base}?auto=format&fit=max&w=${ancho}&q=72`
}

/**
 * Unsplash entrega únicamente el ancho que la celda puede mostrar. El límite
 * de 960 px conserva nitidez en DPR 2 sin descargar originales de 1,900 px.
 */
function atributosImagen(mediaUrl: string) {
  if (!mediaUrl.startsWith('https://images.unsplash.com/')) return { src: mediaUrl }
  return {
    src: urlUnsplash(mediaUrl, 720),
    srcSet: [480, 720, 960].map((ancho) => `${urlUnsplash(mediaUrl, ancho)} ${ancho}w`).join(', '),
    sizes: '(max-width: 819px) 78vw, 44vw',
  }
}

/**
 * Museo bidimensional de Tarjetas de Fe. Arrastrar o desplazar mueve el mundo
 * completo con inercia; seleccionar una pieza abre su ficha de contemplación.
 */
export function FeedPage() {
  const { data, isPending, isError } = useFeed()
  const { data: perfil } = usePerfil()
  const cardsPublicadas = data?.pages.flat() ?? []
  // La colección de muestra es un placeholder visual inmediato. Así el LCP no
  // queda encadenado a /api/feed cuando el archivo público todavía está vacío.
  const usaMuestra = !isError && cardsPublicadas.length === 0
  const cards = usaMuestra ? tarjetasMuestra : cardsPublicadas
  const [seleccionada, setSeleccionada] = useState<FeedCard | null>(null)
  const [telon, setTelon] = useState<{ clave: number } | null>(null)
  const telonActivoRef = useRef(false)
  const telonTimersRef = useRef<number[]>([])
  const puedePublicar = perfil?.role === 'MAESTRO' || perfil?.role === 'ADMIN'

  useEffect(() => () => {
    telonTimersRef.current.forEach((timer) => window.clearTimeout(timer))
  }, [])

  const cambiarConTelon = (destino: FeedCard | null) => {
    if (telonActivoRef.current) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setSeleccionada(destino)
      return
    }

    telonActivoRef.current = true
    setTelon({ clave: Date.now() })
    telonTimersRef.current = [
      window.setTimeout(() => setSeleccionada(destino), 760),
      window.setTimeout(() => {
        setTelon(null)
        telonActivoRef.current = false
      }, 1620),
    ]
  }

  let contenido: ReactNode
  if (seleccionada) {
    const indice = Math.max(0, cards.findIndex((card) => card.id === seleccionada.id))
    const anterior = cards.length > 1 ? cards[(indice - 1 + cards.length) % cards.length] : null
    const siguiente = cards.length > 1 ? cards[(indice + 1) % cards.length] : null
    contenido = (
      <EstudiarTarjeta
        card={seleccionada}
        indice={indice}
        anterior={anterior ?? null}
        siguiente={siguiente ?? null}
        onVolver={() => cambiarConTelon(null)}
        onCambiar={setSeleccionada}
      />
    )
  } else {
    contenido = (
      <MuseoTarjetas
        cards={cards}
        cargando={isPending && !usaMuestra}
        error={isError}
        puedePublicar={puedePublicar}
        onSeleccionar={(card) => cambiarConTelon(card)}
      />
    )
  }

  return (
    <>
      {contenido}
      {telon && <TelonTarjeta key={telon.clave} />}
    </>
  )
}

function TelonTarjeta() {
  return createPortal(
    <div className="faith-curtain" aria-hidden="true">
      <div className="faith-curtain__panel faith-curtain__panel--left" />
      <div className="faith-curtain__panel faith-curtain__panel--center">
        <BrandLogo
          layout="stacked"
          tone="light"
          size="lg"
          variante="sidebar"
          decorative
          className="faith-curtain__logo"
        />
      </div>
      <div className="faith-curtain__panel faith-curtain__panel--right" />
    </div>,
    document.body,
  )
}

function MuseoTarjetas({
  cards,
  cargando,
  error,
  puedePublicar,
  onSeleccionar,
}: {
  cards: FeedCard[]
  cargando: boolean
  error: boolean
  puedePublicar: boolean
  onSeleccionar: (card: FeedCard) => void
}) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const cursorRef = useRef<HTMLDivElement>(null)
  const posicionRef = useRef<Punto>({ x: 0, y: 0 })
  const velocidadRef = useRef<Punto>({ x: 0, y: 0 })
  const arrastreRef = useRef<{ pointerId: number; x: number; y: number; origenX: number; origenY: number } | null>(null)
  const movidoRef = useRef(false)
  const periodoRef = useRef({ ancho: 0, alto: 0 })
  const activarMovimientoRef = useRef<() => void>(() => undefined)

  const piezas = useMemo(() => {
    if (cards.length === 0) return []
    const gruposNecesarios = Math.max(4, Math.ceil(cards.length / patronMosaico.length))
    const grupos = gruposNecesarios + (gruposNecesarios % 2)
    const total = grupos * patronMosaico.length
    return Array.from({ length: total }, (_, indice) => cards[indice % cards.length] as FeedCard)
  }, [cards])

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    const world = worldRef.current
    const hoja = world?.querySelector<HTMLElement>('.faith-museum__sheet')
    if (!viewport || !world || !hoja || piezas.length === 0) return

    let frame = 0
    let inicializado = false

    const medir = () => {
      const vw = viewport.clientWidth
      const vh = viewport.clientHeight
      const ancho = hoja.offsetWidth
      const alto = hoja.offsetHeight
      periodoRef.current = { ancho, alto }
      if (!inicializado) {
        posicionRef.current = {
          x: -ancho + (vw - ancho) / 2,
          y: -alto + (vh - alto) / 2,
        }
        world.style.transform = `translate3d(${posicionRef.current.x}px, ${posicionRef.current.y}px, 0)`
        world.classList.add('is-ready')
        inicializado = true
      }
    }

    const solicitarDibujo = () => {
      if (frame === 0) frame = window.requestAnimationFrame(dibujar)
    }

    const dibujar = () => {
      frame = 0
      const periodo = periodoRef.current
      const posicion = posicionRef.current
      const velocidad = velocidadRef.current

      posicion.x += velocidad.x
      posicion.y += velocidad.y
      if (periodo.ancho > 0) {
        while (posicion.x > 0) posicion.x -= periodo.ancho
        while (posicion.x <= -periodo.ancho * 2) posicion.x += periodo.ancho
      }
      if (periodo.alto > 0) {
        while (posicion.y > 0) posicion.y -= periodo.alto
        while (posicion.y <= -periodo.alto * 2) posicion.y += periodo.alto
      }
      velocidad.x *= 0.865
      velocidad.y *= 0.865
      if (Math.abs(velocidad.x) < 0.01) velocidad.x = 0
      if (Math.abs(velocidad.y) < 0.01) velocidad.y = 0

      world.style.transform = `translate3d(${posicion.x}px, ${posicion.y}px, 0)`
      if (velocidad.x !== 0 || velocidad.y !== 0 || arrastreRef.current) solicitarDibujo()
    }

    const rueda = (event: WheelEvent) => {
      event.preventDefault()
      velocidadRef.current.x += -event.deltaX * 0.0825
      velocidadRef.current.y += -event.deltaY * 0.0825
      solicitarDibujo()
    }

    const resize = new ResizeObserver(medir)
    resize.observe(viewport)
    resize.observe(world)
    resize.observe(hoja)
    medir()
    viewport.addEventListener('wheel', rueda, { passive: false })
    activarMovimientoRef.current = solicitarDibujo

    return () => {
      activarMovimientoRef.current = () => undefined
      resize.disconnect()
      viewport.removeEventListener('wheel', rueda)
      window.cancelAnimationFrame(frame)
    }
  }, [piezas.length])

  const actualizarCursor = (event: React.PointerEvent<HTMLDivElement>) => {
    const cursor = cursorRef.current
    const viewport = viewportRef.current
    if (!cursor || !viewport) return
    const rect = viewport.getBoundingClientRect()
    cursor.style.transform = `translate3d(${event.clientX - rect.left}px, ${event.clientY - rect.top}px, 0)`
  }

  return (
    <section className="faith-museum" aria-label="Museo de Tarjetas de Fe">
      <div
        ref={viewportRef}
        className="faith-museum__viewport"
        tabIndex={0}
        onPointerMove={(event) => {
          actualizarCursor(event)
          const arrastre = arrastreRef.current
          if (!arrastre || arrastre.pointerId !== event.pointerId) return
          const dx = event.clientX - arrastre.x
          const dy = event.clientY - arrastre.y
          arrastre.x = event.clientX
          arrastre.y = event.clientY
          if (Math.hypot(event.clientX - arrastre.origenX, event.clientY - arrastre.origenY) > 8) {
            movidoRef.current = true
            // Capturar únicamente cuando el gesto ya es un arrastre. Si se
            // captura al presionar, el click deja de pertenecer a la tarjeta.
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.setPointerCapture(event.pointerId)
            }
          }
          posicionRef.current.x += dx * 0.73
          posicionRef.current.y += dy * 0.73
          velocidadRef.current.x += dx * 0.18
          velocidadRef.current.y += dy * 0.18
          activarMovimientoRef.current()
        }}
        onPointerDown={(event) => {
          arrastreRef.current = {
            pointerId: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            origenX: event.clientX,
            origenY: event.clientY,
          }
          movidoRef.current = false
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
          arrastreRef.current = null
        }}
        onPointerCancel={() => {
          arrastreRef.current = null
        }}
        onKeyDown={(event) => {
          const paso = event.shiftKey ? 96 : 48
          const esFlecha = event.key.startsWith('Arrow')
          if (event.key === 'ArrowLeft') velocidadRef.current.x += paso
          if (event.key === 'ArrowRight') velocidadRef.current.x -= paso
          if (event.key === 'ArrowUp') velocidadRef.current.y += paso
          if (event.key === 'ArrowDown') velocidadRef.current.y -= paso
          if (esFlecha) activarMovimientoRef.current()
        }}
      >
        <div className="faith-museum__grain" aria-hidden="true" />

        {cargando ? (
          <div className="faith-museum__message"><span>Cargando el archivo…</span></div>
        ) : error ? (
          <div className="faith-museum__message">
            <span>Archivo temporalmente cerrado</span>
            <p>No pudimos recuperar las tarjetas de la comunidad.</p>
          </div>
        ) : piezas.length === 0 ? (
          <div className="faith-museum__message faith-museum__message--empty">
            <span>El archivo espera su primera historia</span>
            <p>Imágenes, palabras y testimonios para caminar con un corazón nuevo.</p>
            {puedePublicar && <Link to="/tarjetas/publicar">Publicar la primera pieza ＋</Link>}
          </div>
        ) : (
          <div ref={worldRef} className="faith-museum__world" aria-label="Colección de tarjetas infinita">
            {Array.from({ length: 9 }, (_, hojaIndice) => (
              <div
                key={`hoja-${hojaIndice}`}
                className="faith-museum__sheet"
                aria-hidden={hojaIndice === 4 ? undefined : true}
              >
                {piezas.map((card, indice) => {
                  const posicion = posicionMosaico(indice)
                  const esLcp = hojaIndice === 4 && indice === 6
                  return (
                    <button
                      key={`${hojaIndice}-${card.id}-${indice}`}
                      type="button"
                      tabIndex={hojaIndice === 4 ? 0 : -1}
                      className={`faith-museum__tile faith-museum__tile--${posicion.formato}`}
                      style={posicion.style}
                      aria-label={`Contemplar ${card.caption || `tarjeta de ${card.authorName}`}`}
                      onPointerEnter={() => cursorRef.current?.classList.add('is-visible')}
                      onPointerLeave={() => cursorRef.current?.classList.remove('is-visible')}
                      onClick={() => {
                        if (!movidoRef.current) onSeleccionar(card)
                      }}
                    >
                      {card.type === 'VIDEO' ? (
                        <video
                          src={card.mediaUrl}
                          poster={card.posterUrl ?? undefined}
                          muted
                          playsInline
                          preload="metadata"
                        />
                      ) : (
                        <img
                          {...atributosImagen(card.mediaUrl)}
                          alt=""
                          draggable={false}
                          loading={esLcp ? 'eager' : 'lazy'}
                          fetchPriority={esLcp ? 'high' : 'auto'}
                          decoding="async"
                        />
                      )}
                      <span>{numero((indice % cards.length) + 1)}</span>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        )}

        <div ref={cursorRef} className="faith-museum__cursor" aria-hidden="true">Contemplar</div>
      </div>

    </section>
  )
}

type FichaTarjeta = {
  titulo: string
  manifiesto: string
  relato: [string, string]
  origen: string
  referencia: string
}

const fichasMuestra: Record<string, FichaTarjeta> = {
  'muestra-templo-luz': {
    titulo: 'LUZ ENTRE COLUMNAS',
    manifiesto: 'La luz encuentra camino donde el corazón aprende a hacer silencio.',
    relato: [
      'Esta memoria contempla la luz que atraviesa el templo como una imagen de la gracia: no borra la estructura ni la historia, sino que las revela de una manera nueva.',
      'La fe también se recibe así. Entra por una abertura pequeña, alcanza lo cotidiano y nos invita a caminar con atención hacia aquello que antes no podíamos ver.',
    ],
    origen: 'Santuario de la comunidad',
    referencia: 'Juan 8:12',
  },
  'muestra-siguiente-paso': {
    titulo: 'EL SIGUIENTE PASO',
    manifiesto: 'La fe no exige ver el camino completo; invita a confiar en el siguiente paso.',
    relato: [
      'Esta tarjeta contempla el momento en el que la claridad todavía no alcanza todo el recorrido, pero sí ofrece luz suficiente para continuar.',
      'Caminar por fe es responder a esa luz presente: avanzar con confianza hacia Cristo, aun cuando el horizonte conserve parte de su misterio.',
    ],
    origen: 'El Camino Angosto',
    referencia: '2 Corintios 5:7',
  },
  'muestra-biblia-sol': {
    titulo: 'PALABRA ABIERTA',
    manifiesto: 'Una palabra abierta puede iluminar el siguiente paso.',
    relato: [
      'La Escritura abierta no funciona como un objeto distante, sino como una conversación que espera ser recibida. La luz sobre sus páginas representa una verdad que se deja encontrar.',
      'Volver a la Palabra es volver al origen del camino: escuchar, discernir y convertir lo leído en una decisión concreta para el día presente.',
    ],
    origen: 'Mesa de contemplación',
    referencia: 'Salmo 119:105',
  },
  'muestra-puerta': {
    titulo: 'LA PUERTA ANGOSTA',
    manifiesto: 'Toda puerta recuerda que la fe también es una decisión.',
    relato: [
      'La puerta angosta no representa una vida reducida, sino una elección consciente. Entrar demanda dejar atrás aquello que impide avanzar con libertad y verdad.',
      'Esta pieza conserva el instante previo al paso: ese momento en el que la invitación ya fue escuchada y el corazón debe decidir si comienza el recorrido.',
    ],
    origen: 'Umbral del recorrido',
    referencia: 'Mateo 7:13–14',
  },
  'muestra-santuario': {
    titulo: 'SANTUARIO INTERIOR',
    manifiesto: 'Hay espacios que invitan al corazón a guardar silencio.',
    relato: [
      'El santuario señala una pausa dentro del ruido. Sus formas elevadas recuerdan que la oración también puede ordenar la mirada y devolver perspectiva.',
      'La arquitectura visible conduce hacia una práctica invisible: detenerse, reconocer la presencia de Dios y permitir que el silencio prepare una respuesta.',
    ],
    origen: 'Casa de oración',
    referencia: 'Salmo 46:10',
  },
  'muestra-vitral': {
    titulo: 'GRACIA EN COLOR',
    manifiesto: 'La gracia transforma fragmentos en una historia de luz.',
    relato: [
      'Un vitral no oculta sus divisiones. Las integra para que cada fragmento participe de una imagen mayor y la luz pueda atravesarlo sin negar su historia.',
      'Así opera la restauración: no elimina el pasado, pero le concede un nuevo lugar dentro de una obra que anuncia esperanza.',
    ],
    origen: 'Nave de los vitrales',
    referencia: '2 Corintios 5:17',
  },
}

function EstudiarTarjeta({
  card,
  indice,
  anterior,
  siguiente,
  onVolver,
  onCambiar,
}: {
  card: FeedCard
  indice: number
  anterior: FeedCard | null
  siguiente: FeedCard | null
  onVolver: () => void
  onCambiar: (card: FeedCard) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const piezaRef = useRef<HTMLDivElement>(null)
  const [audioActivo, setAudioActivo] = useState(false)
  const [audioProgreso, setAudioProgreso] = useState(0)
  const [audioDuracion, setAudioDuracion] = useState(0)
  const audioUrl = (card as FeedCard & { audioUrl?: string | null }).audioUrl ?? null
  const ficha = fichaDe(card)

  useEffect(() => {
    const video = videoRef.current
    if (!video || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    void video.play().catch(() => undefined)
    return () => video.pause()
  }, [card.id])

  useEffect(() => {
    setAudioActivo(false)
    setAudioProgreso(0)
    setAudioDuracion(0)
  }, [card.id])

  const inclinar = (event: React.PointerEvent<HTMLDivElement>) => {
    const pieza = piezaRef.current
    if (!pieza) return
    const rect = pieza.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width - 0.5
    const y = (event.clientY - rect.top) / rect.height - 0.5
    pieza.style.setProperty('--rot-y', `${x * 18}deg`)
    pieza.style.setProperty('--rot-x', `${y * -14}deg`)
    pieza.style.setProperty('--brillo-x', `${(x + 0.5) * 100}%`)
    pieza.style.setProperty('--brillo-y', `${(y + 0.5) * 100}%`)
  }

  const enderezar = () => {
    const pieza = piezaRef.current
    pieza?.style.setProperty('--rot-y', '-4deg')
    pieza?.style.setProperty('--rot-x', '2deg')
  }

  const alternarAudio = () => {
    const audio = audioRef.current
    if (!audioUrl || !audio) return
    if (audio.paused) void audio.play()
    else audio.pause()
  }

  return (
    <article className="faith-study">
      <div className="faith-study__grain" aria-hidden="true" />
      <header className="faith-study__header">
        <button type="button" onClick={onVolver}>Volver al lienzo</button>
      </header>

      <div className="faith-study__layout">
        <section className="faith-study__identity" aria-labelledby="faith-card-title">
          <span>N°{numero(indice + 1)}</span>
          <TituloTarjeta titulo={ficha.titulo} />
          <div className={`faith-study__audio${audioUrl ? '' : ' is-empty'}`}>
            <div>
              <span>Relato de la pieza</span>
              <strong>{audioUrl ? (audioActivo ? 'Reproduciendo' : 'Audio disponible') : 'Audio opcional · no adjunto'}</strong>
            </div>
            <button type="button" disabled={!audioUrl} onClick={alternarAudio} aria-label={audioActivo ? 'Pausar relato' : 'Reproducir relato'}>
              {audioActivo ? 'Ⅱ' : '▶'}
            </button>
            <div className="faith-study__audio-track" aria-hidden="true">
              <i style={{ width: `${audioDuracion > 0 ? (audioProgreso / audioDuracion) * 100 : 0}%` }} />
            </div>
            <time>{audioUrl ? `${tiempo(audioProgreso)} / ${tiempo(audioDuracion)}` : '—:— / —:—'}</time>
            {audioUrl && (
              <audio
                ref={audioRef}
                src={audioUrl}
                onPlay={() => setAudioActivo(true)}
                onPause={() => setAudioActivo(false)}
                onTimeUpdate={(event) => setAudioProgreso(event.currentTarget.currentTime)}
                onLoadedMetadata={(event) => setAudioDuracion(event.currentTarget.duration)}
                onEnded={() => setAudioActivo(false)}
              />
            )}
          </div>
        </section>

        <section className="faith-study__object" aria-label="Tarjeta de fe interactiva">
          <div
            ref={piezaRef}
            className="faith-study__media"
            tabIndex={0}
            onPointerMove={inclinar}
            onPointerLeave={enderezar}
            onBlur={enderezar}
            onKeyDown={(event) => {
              const pieza = piezaRef.current
              if (!pieza) return
              if (event.key === 'ArrowLeft') pieza.style.setProperty('--rot-y', '-12deg')
              if (event.key === 'ArrowRight') pieza.style.setProperty('--rot-y', '12deg')
              if (event.key === 'ArrowUp') pieza.style.setProperty('--rot-x', '10deg')
              if (event.key === 'ArrowDown') pieza.style.setProperty('--rot-x', '-10deg')
            }}
          >
            <div className="faith-study__card-face">
              {card.type === 'VIDEO' ? (
                <video ref={videoRef} src={card.mediaUrl} poster={card.posterUrl ?? undefined} controls playsInline loop preload="metadata" />
              ) : (
                <img
                  {...atributosImagen(card.mediaUrl)}
                  alt={card.caption ?? `Tarjeta de fe de ${card.authorName}`}
                  decoding="async"
                  fetchPriority="high"
                />
              )}
              <span aria-hidden="true" />
            </div>
          </div>
          <p>Mueve el cursor o usa las flechas para contemplar la pieza</p>
        </section>

        <section className="faith-study__story">
          <div className="faith-study__lore">
            <span>Memoria de fe</span>
            <h2>{ficha.manifiesto}</h2>
            <p>{ficha.relato[0]}</p>
            <p>{ficha.relato[1]}</p>
            <footer>
              <span>Compartida por {card.authorName}</span>
              <span>{fecha(card.publishedAt)}</span>
            </footer>
          </div>
        </section>
      </div>

      <footer className="faith-study__navigation">
        <button type="button" disabled={!anterior} onClick={() => anterior && onCambiar(anterior)}>
          <span>Pieza anterior</span>
          <strong>{anterior ? fichaDe(anterior).titulo : '—'}</strong>
        </button>
        <button type="button" disabled={!siguiente} onClick={() => siguiente && onCambiar(siguiente)}>
          <span>Siguiente pieza</span>
          <strong>{siguiente ? fichaDe(siguiente).titulo : '—'}</strong>
        </button>
      </footer>
    </article>
  )
}

function fichaDe(card: FeedCard): FichaTarjeta {
  const guardada = fichasMuestra[card.id]
  if (guardada) return guardada
  const texto = card.caption?.trim() || 'Una pausa para contemplar el camino.'
  const titulo = texto
    .replace(/[«»“”]/g, '')
    .split(/[.!?,;:]/)[0]
    ?.split(/\s+/)
    .slice(0, 5)
    .join(' ')
    .toLocaleUpperCase('es-PE') || 'MEMORIA DE FE'
  return {
    titulo,
    manifiesto: texto,
    relato: [
      `Esta tarjeta conserva una memoria compartida por ${card.authorName}. Su imagen invita a detenerse y observar cómo la fe se hace visible en lo cotidiano.`,
      'Contemplarla es una forma de volver al camino: reconocer la gracia, guardar lo aprendido y permitir que esa memoria inspire el siguiente paso.',
    ],
    origen: 'Archivo de la comunidad',
    referencia: card.type === 'VIDEO' ? 'Testimonio en movimiento' : 'Memoria visual',
  }
}

type ComposicionTitulo = {
  lineas: string[]
  tamano: number
}

/**
 * Compone el título como una pieza editorial: nunca corta una palabra y
 * elige, entre todas las particiones de hasta tres líneas, la que permite
 * la mayor escala sin producir líneas huérfanas o demasiado desiguales.
 */
function TituloTarjeta({ titulo }: { titulo: string }) {
  const ref = useRef<HTMLHeadingElement>(null)
  const [composicion, setComposicion] = useState<ComposicionTitulo>(() => ({
    lineas: lineasIniciales(titulo),
    tamano: 56,
  }))

  useLayoutEffect(() => {
    const elemento = ref.current
    if (!elemento) return

    const ajustar = () => {
      const ancho = elemento.clientWidth
      if (ancho <= 0) return

      const estilo = window.getComputedStyle(elemento)
      const lienzo = document.createElement('canvas')
      const contexto = lienzo.getContext('2d')
      if (!contexto) return

      const palabras = titulo.trim().split(/\s+/).filter(Boolean)
      const opciones = particionesTitulo(palabras, Math.min(3, palabras.length))
      const altoDisponible = Math.min(window.innerHeight * 0.38, 330)
      const interlineado = 0.84
      let mejor: (ComposicionTitulo & { puntuacion: number }) | null = null

      for (const lineas of opciones) {
        let inferior = 28
        let superior = 104

        for (let intento = 0; intento < 11; intento += 1) {
          const candidato = (inferior + superior) / 2
          contexto.font = `${estilo.fontWeight} ${candidato}px ${estilo.fontFamily}`
          const anchos = lineas.map((linea) => contexto.measureText(linea).width)
          const cabeAncho = Math.max(...anchos) <= ancho
          const cabeAlto = candidato * interlineado * lineas.length <= altoDisponible
          if (cabeAncho && cabeAlto) inferior = candidato
          else superior = candidato
        }

        contexto.font = `${estilo.fontWeight} ${inferior}px ${estilo.fontFamily}`
        const anchos = lineas.map((linea) => contexto.measureText(linea).width)
        const maximo = Math.max(...anchos)
        const minimo = Math.min(...anchos)
        const desequilibrio = maximo > 0 ? (maximo - minimo) / maximo : 0
        const lineaHuerfana = lineas.some((linea) => linea.length <= 3) ? 5 : 0
        const puntuacion = inferior / Math.sqrt(lineas.length) - desequilibrio * 7 - lineaHuerfana

        if (!mejor || puntuacion > mejor.puntuacion) {
          mejor = { lineas, tamano: Math.floor(inferior), puntuacion }
        }
      }

      if (mejor) {
        setComposicion((actual) => {
          const mismasLineas = actual.lineas.join('\n') === mejor.lineas.join('\n')
          return mismasLineas && actual.tamano === mejor.tamano
            ? actual
            : { lineas: mejor.lineas, tamano: mejor.tamano }
        })
      }
    }

    ajustar()
    const observador = new ResizeObserver(ajustar)
    observador.observe(elemento)
    return () => observador.disconnect()
  }, [titulo])

  return (
    <h1
      ref={ref}
      id="faith-card-title"
      aria-label={titulo}
      style={{ fontSize: `${composicion.tamano}px` }}
    >
      {composicion.lineas.map((linea, indice) => (
        <span key={`${indice}-${linea}`} aria-hidden="true">{linea}</span>
      ))}
    </h1>
  )
}

function lineasIniciales(titulo: string) {
  const palabras = titulo.trim().split(/\s+/).filter(Boolean)
  if (palabras.length <= 1) return palabras
  const opciones = particionesTitulo(palabras, Math.min(3, palabras.length))
  return opciones.reduce((mejor, lineas) => {
    const longitudes = lineas.map((linea) => linea.length)
    const costo = Math.max(...longitudes) - Math.min(...longitudes) + lineas.length * 2
    const longitudesMejor = mejor.map((linea) => linea.length)
    const costoMejor = Math.max(...longitudesMejor) - Math.min(...longitudesMejor) + mejor.length * 2
    return costo < costoMejor ? lineas : mejor
  })
}

function particionesTitulo(palabras: string[], maximoLineas: number) {
  const resultados: string[][] = []

  const visitar = (inicio: number, lineas: string[]) => {
    if (inicio === palabras.length) {
      resultados.push(lineas)
      return
    }
    if (lineas.length >= maximoLineas) return

    const restantes = maximoLineas - lineas.length - 1
    const ultimoFin = palabras.length - restantes
    for (let fin = inicio + 1; fin <= ultimoFin; fin += 1) {
      visitar(fin, [...lineas, palabras.slice(inicio, fin).join(' ')])
    }
  }

  visitar(0, [])
  return resultados
}

function tiempo(segundos: number) {
  if (!Number.isFinite(segundos) || segundos <= 0) return '0:00'
  const minutos = Math.floor(segundos / 60)
  return `${minutos}:${String(Math.floor(segundos % 60)).padStart(2, '0')}`
}

function posicionMosaico(indice: number): { formato: string; style: CSSProperties } {
  const grupo = Math.floor(indice / patronMosaico.length)
  const pieza = patronMosaico[indice % patronMosaico.length] as (typeof patronMosaico)[number]
  const columnaBase = (grupo % 2) * 6
  const filaBase = Math.floor(grupo / 2) * 6
  return {
    formato: pieza.formato,
    style: {
      gridColumn: `${columnaBase + pieza.columna} / span ${pieza.columnas}`,
      gridRow: `${filaBase + pieza.fila} / span ${pieza.filas}`,
    },
  }
}

function numero(valor: number) {
  return String(valor).padStart(2, '0')
}

function fecha(valor: string | null) {
  if (!valor) return 'Fecha reservada'
  return formatoFecha.format(new Date(valor)).replace('.', '')
}
