import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Eyebrow } from '@elcamino/ui'
import { BrandLogo } from '@elcamino/ui/static'
import { useFeed, type FeedCard } from './feed-api'
import { useRegistrarVista, useRegistrarVisita } from '../../lib/analitica'

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

const formatoFecha = new Intl.DateTimeFormat('es-PE', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

/**
 * Tarjetas de muestra: solo se ven cuando el feed real está vacío. No traen
 * ficha porque su contenido vive en `fichasMuestra`, más abajo.
 */
const SIN_FICHA = {
  title: null,
  manifesto: null,
  story: null,
  origin: null,
  reference: null,
  audioUrl: null,
} satisfies Partial<FeedCard>

const tarjetasMuestra: FeedCard[] = [
  {
    id: 'muestra-templo-luz',
    ...SIN_FICHA,
    authorName: 'Annie Spratt',
    type: 'IMAGE',
    caption: 'La luz encuentra caminos incluso entre las columnas más antiguas.',
    mediaUrl: 'https://images.unsplash.com/photo-1461771465070-80531c6afc3c',
    posterUrl: null,
    publishedAt: '2026-07-15T12:00:00.000Z',
  },
  {
    id: 'muestra-siguiente-paso',
    ...SIN_FICHA,
    authorName: 'El Camino Angosto',
    type: 'IMAGE',
    caption: 'No necesitas ver todo el camino para dar el siguiente paso.',
    mediaUrl: '/media/tarjeta-fe-siguiente-paso-960.webp',
    posterUrl: null,
    publishedAt: '2026-07-20T12:00:00.000Z',
  },
  {
    id: 'muestra-biblia-sol',
    ...SIN_FICHA,
    authorName: 'Aaron Burden',
    type: 'IMAGE',
    caption: 'Una palabra abierta puede iluminar el siguiente paso.',
    mediaUrl: 'https://images.unsplash.com/photo-1747738609473-9e92707075eb',
    posterUrl: null,
    publishedAt: '2026-07-14T12:00:00.000Z',
  },
  {
    id: 'muestra-puerta',
    ...SIN_FICHA,
    authorName: 'CHUTTERSNAP',
    type: 'IMAGE',
    caption: 'Toda puerta recuerda que la fe también es una decisión.',
    mediaUrl: 'https://images.unsplash.com/photo-1521633264041-6bfd17168b65',
    posterUrl: null,
    publishedAt: '2026-07-13T12:00:00.000Z',
  },
  {
    id: 'muestra-santuario',
    ...SIN_FICHA,
    authorName: 'Garrett Anderson',
    type: 'IMAGE',
    caption: 'Hay espacios que invitan al corazón a guardar silencio.',
    mediaUrl: 'https://images.unsplash.com/photo-1501639977519-a7ef73115102',
    posterUrl: null,
    publishedAt: '2026-07-12T12:00:00.000Z',
  },
  {
    id: 'muestra-vitral',
    ...SIN_FICHA,
    authorName: 'JF Martin',
    type: 'IMAGE',
    caption: 'La gracia transforma el vidrio quebrado en una historia de color.',
    mediaUrl: 'https://images.unsplash.com/photo-1541362089225-312097120732',
    posterUrl: null,
    publishedAt: '2026-07-11T12:00:00.000Z',
  },
  {
    id: 'muestra-palabra',
    ...SIN_FICHA,
    authorName: 'Christopher Stites',
    type: 'IMAGE',
    caption: 'Vuelve a la Palabra hasta que el camino se haga visible.',
    mediaUrl: 'https://images.unsplash.com/photo-1777421389268-ebefab72e96d',
    posterUrl: null,
    publishedAt: '2026-07-10T12:00:00.000Z',
  },
  {
    id: 'muestra-biblia-manos',
    ...SIN_FICHA,
    authorName: 'Christopher Stites',
    type: 'IMAGE',
    caption: 'Recibir la verdad también es aprender a sostenerla con cuidado.',
    mediaUrl: 'https://images.unsplash.com/photo-1777421389422-519764272b2f',
    posterUrl: null,
    publishedAt: '2026-07-09T12:00:00.000Z',
  },
]

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
  useRegistrarVisita('tarjetas')
  const cardsPublicadas = data?.pages.flat() ?? []
  // La colección de muestra es un placeholder visual inmediato. Así el LCP no
  // queda encadenado a /api/feed cuando el archivo público todavía está vacío.
  const usaMuestra = !isError && cardsPublicadas.length === 0
  const cards = usaMuestra ? tarjetasMuestra : cardsPublicadas
  const [seleccionada, setSeleccionada] = useState<FeedCard | null>(null)
  // Abrir una tarjeta en el lienzo es lo que cuenta como verla; el mosaico no.
  useRegistrarVista('POST', seleccionada?.id)
  const [telon, setTelon] = useState<{ clave: number } | null>(null)
  const telonActivoRef = useRef(false)
  const telonTimersRef = useRef<number[]>([])

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
      <ListadoDeTarjetas
        cards={cards}
        cargando={isPending && !usaMuestra}
        error={isError}
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

/**
 * Listado de Tarjetas de Fe.
 *
 * Antes era un mosaico que se arrastraba: llamaba la atención, pero obligaba a
 * buscar a ojo y recortaba las piezas. Ahora cada tarjeta se ve entera, una
 * en una rejilla, de la más nueva a la más antigua, con un buscador y nada
 * más: cualquier otro filtro sobra cuando el orden ya es el esperado.
 *
 * La card es solo la imagen. Sin título ni pie: la tarjeta ya lleva su texto
 * dentro, y repetirlo fuera competía con la pieza.
 *
 * En móvil cambia el modo, no solo el tamaño: una tarjeta por pantalla que se
 * navega deslizando, sin buscador y sin abrir ficha. Ahí no hay sitio para
 * leer un estudio, y forzarlo daría una pantalla peor que la de escritorio.
 */
function ListadoDeTarjetas({
  cards,
  cargando,
  error,
  onSeleccionar,
}: {
  cards: FeedCard[]
  cargando: boolean
  error: boolean
  onSeleccionar: (card: FeedCard) => void
}) {
  const [busqueda, setBusqueda] = useState('')

  const ordenadas = useMemo(
    () => [...cards].sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '')),
    [cards],
  )

  const visibles = useMemo(() => {
    const orden = ordenadas
    const termino = busqueda.trim().toLocaleLowerCase()
    if (!termino) return orden
    // Busca en todo lo que la tarjeta enseña, no solo en el título: quien
    // recuerda una frase del relato debe poder llegar por ahí.
    return orden.filter((card) =>
      [card.title, card.caption, card.manifesto, card.story, card.reference, card.origin]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase()
        .includes(termino),
    )
  }, [busqueda, ordenadas])

  return (
    <>
      {/* ── Móvil: una tarjeta por pantalla, se navega deslizando ──────────
          Sin buscador y sin abrir ficha: aquí la tarjeta se contempla, no se
          estudia. El `scroll-snap` hace que cada gesto deje una pieza
          centrada, sin dejar dos a medias.
          Los márgenes negativos cancelan TODO el relleno del layout —también el
          superior— y el relleno propio de 3.75rem vuelve a dejar sitio a la
          cabecera fija: la pieza ocupa el main entero sin tapar la cabecera.

          La imagen va `contain` y no `cover`: las tarjetas llevan texto hasta
          el borde y recortarlas se come palabras. Como una proporción distinta
          a la de la pantalla deja bandas, el hueco se pinta de negro y pasa a
          leerse como el marco de un visor en vez de como un fallo. */}
      <div className="-mx-gutter -mb-32 -mt-[5.5rem] pt-[3.75rem] cine:hidden">
        {error && (
          <p className="px-gutter font-ui text-body text-vino">
            No se pudieron cargar las tarjetas.
          </p>
        )}
        {cargando && !error && (
          <p className="px-gutter font-ui text-body text-texto-tenue">Cargando tarjetas…</p>
        )}

        <ul className="m-0 h-[calc(100dvh-3.75rem)] snap-y snap-mandatory list-none overflow-y-auto overscroll-contain p-0 scrollbar-none">
          {ordenadas.map((card) => (
            <li
              key={card.id}
              className="flex h-[calc(100dvh-3.75rem)] snap-start snap-always items-center justify-center bg-negro"
            >
              <img
                src={card.posterUrl ?? card.mediaUrl}
                alt={card.title ?? card.caption ?? 'Tarjeta de fe'}
                loading="lazy"
                className="max-h-full max-w-full object-contain"
              />
            </li>
          ))}
        </ul>
      </div>

      {/* ── Escritorio: rejilla con buscador y ficha al pulsar ─────────── */}
      <section className="mx-auto hidden w-full max-w-5xl flex-col gap-aire-m cine:flex">
        <header className="flex flex-col gap-aire-xs">
          <Eyebrow>Tarjetas de fe</Eyebrow>
          {/* Mismo buscador que tenía el catálogo de cursos: la etiqueta la lee
              el lector de pantalla, y a la vista queda la lupa dentro del campo. */}
          <label className="relative block w-full">
            <span className="sr-only">Buscar tarjetas</span>
            <svg
              className="pointer-events-none absolute left-aire-s top-1/2 size-5 -translate-y-1/2 text-texto-tenue"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
              placeholder="Título, versículo o una frase del relato"
              autoComplete="off"
              className="h-14 w-full rounded-full border border-linea-fuerte bg-superficie-1 pl-12 pr-aire-s font-ui text-body text-contenido shadow-[inset_0_0_0_1px_var(--linea)] outline-none transition-[border-color,box-shadow] placeholder:text-texto-tenue focus:border-vino focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--vino)_12%,transparent)]"
            />
          </label>
        </header>

        {error && (
          <p className="m-0 font-ui text-body text-vino">
            No se pudieron cargar las tarjetas. Vuelve a intentarlo en un momento.
          </p>
        )}
        {cargando && !error && (
          <p className="m-0 font-ui text-body text-texto-tenue">Cargando tarjetas…</p>
        )}
        {!cargando && !error && visibles.length === 0 && (
          <p className="m-0 font-ui text-body text-texto-tenue">
            {busqueda.trim()
              ? 'Ninguna tarjeta coincide con esa búsqueda.'
              : 'Todavía no hay tarjetas publicadas.'}
          </p>
        )}

        {/* Rejilla de columnas, no de filas: cada tarjeta conserva su propia
            proporción y las alturas distintas encajan sin dejar huecos. Con
            `grid` habría que recortar las imágenes o igualar alturas, y la
            tarjeta ES la imagen. */}
        <ul className="m-0 list-none columns-2 gap-aire-m p-0 md:columns-3">
          {visibles.map((card) => (
            <li key={card.id} className="mb-aire-m break-inside-avoid">
              <button
                type="button"
                onClick={() => onSeleccionar(card)}
                className="block w-full overflow-hidden border border-linea bg-superficie-1 transition-colors duration-fade ease-camino hover:border-vino"
              >
                <img
                  src={card.posterUrl ?? card.mediaUrl}
                  alt={card.title ?? card.caption ?? 'Tarjeta de fe'}
                  loading="lazy"
                  className="block w-full"
                />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
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
  const audioUrl = card.audioUrl
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
            onPointerDown={(event) => {
              // El gesto se reserva solo dentro de la pieza; fuera de ella la
              // página conserva el scroll vertical nativo.
              if (event.pointerType !== 'mouse') event.currentTarget.setPointerCapture(event.pointerId)
              inclinar(event)
            }}
            onPointerMove={inclinar}
            onPointerUp={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
            }}
            onPointerCancel={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
              enderezar()
            }}
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

/**
 * Ficha que se pinta en el lienzo. Prioridad: lo que el admin escribió al
 * publicar; si la tarjeta no trae ficha (las de muestra o las antiguas, que
 * solo tenían `caption`), se completa como antes para no dejar huecos.
 */
function fichaDe(card: FeedCard): FichaTarjeta {
  if (card.title || card.manifesto || card.story) {
    const parrafos = (card.story ?? '')
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean)
    return {
      titulo: (card.title ?? '').toLocaleUpperCase('es-PE') || 'MEMORIA DE FE',
      manifiesto: card.manifesto ?? card.caption ?? '',
      relato: [parrafos[0] ?? '', parrafos.slice(1).join('\n\n')],
      origen: card.origin ?? card.authorName,
      referencia: card.reference ?? '',
    }
  }

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

function numero(valor: number) {
  return String(valor).padStart(2, '0')
}

function fecha(valor: string | null) {
  if (!valor) return 'Fecha reservada'
  return formatoFecha.format(new Date(valor)).replace('.', '')
}
