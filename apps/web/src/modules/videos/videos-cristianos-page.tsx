import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type UIEvent } from 'react'
import { useComentarVideo, useComentariosDeVideo, useVideos, type VideoCatalogo } from './videos-api'
import { useRegistrarVista, useRegistrarVisita } from '../../lib/analitica'
import { useSeo } from '../../lib/seo'

/**
 * Video tal como lo pinta esta pantalla. Se construye desde el catálogo del
 * API (HU-9.3); antes era una lista escrita aquí mismo.
 */
interface VideoCristiano {
  id: string
  titulo: string
  serie: string
  descripcion: string
  fuente: string
  poster: string
  cita: string
  autor: string
}

/** Adapta un video del API a lo que espera la pantalla. */
function aVideoCristiano(v: VideoCatalogo): VideoCristiano {
  return {
    id: v.id,
    titulo: v.title,
    serie: v.series ?? 'El Camino Angosto',
    descripcion: v.description ?? '',
    fuente: v.mediaUrl,
    poster: v.posterUrl ?? '',
    cita: v.reference ?? '',
    autor: `@${v.authorName.toLocaleLowerCase('es-PE').replace(/\s+/g, '')}`,
  }
}


function alternarEnColeccion(actuales: Set<string>, id: string) {
  const siguientes = new Set(actuales)
  if (siguientes.has(id)) siguientes.delete(id)
  else siguientes.add(id)
  return siguientes
}

/** Cuándo se escribió, en corto. */
const fechaCorta = new Intl.DateTimeFormat('es-PE', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})
const cuando = (iso: string) => fechaCorta.format(new Date(iso))

export function VideosCristianosPage() {
  const { data: catalogo, isPending, isError } = useVideos()
  useRegistrarVisita('videos')
  useSeo({
    titulo: 'Videos cristianos',
    descripcion:
      'Videos cristianos cortos para ver y compartir: predicaciones breves, testimonios y palabra que cabe en un minuto.',
    ruta: '/videos',
  })
  const VIDEOS = useMemo(() => (catalogo ?? []).map(aVideoCristiano), [catalogo])
  const [videoActivoId, setVideoActivoId] = useState('')
  /**
   * Los videos suenan al entrar.
   *
   * Estaban silenciados de origen por una razón real —ningún navegador
   * reproduce con sonido sin un gesto previo—, pero llegar a una sección de
   * video y no oír nada parece una avería. Se intenta con sonido y solo se
   * silencia si el navegador lo impide, que es lo que hace `VideoActivo`.
   *
   * La excepción es el recorrido guiado: mientras habla, aquí se calla.
   */
  const [silenciado, setSilenciado] = useState(
    () => document.body.dataset.recorrido === 'activo',
  )

  // Al terminar el recorrido, el sonido vuelve solo.
  useEffect(() => {
    const observador = new MutationObserver(() => {
      if (document.body.dataset.recorrido !== 'activo') setSilenciado(false)
    })
    observador.observe(document.body, { attributes: true, attributeFilter: ['data-recorrido'] })
    return () => observador.disconnect()
  }, [])
  const [gustados, setGustados] = useState<Set<string>>(() => new Set())
  const [aviso, setAviso] = useState('')
  const [comentariosAbiertosPara, setComentariosAbiertosPara] = useState<string | null>(null)
  const [comentarioNuevo, setComentarioNuevo] = useState('')
  const feedRef = useRef<HTMLDivElement>(null)

  // Al llegar el catálogo, el primer video pasa a ser el activo.
  useEffect(() => {
    if (videoActivoId || VIDEOS.length === 0) return
    setVideoActivoId(VIDEOS[0]?.id ?? '')
  }, [VIDEOS, videoActivoId])

  // Cambiar de video cuenta como una vista; repintar, no.
  useRegistrarVista('VIDEO', videoActivoId || null)

  const indiceActivo = Math.max(0, VIDEOS.findIndex(({ id }) => id === videoActivoId))
  const videoDeComentarios = VIDEOS.find(({ id }) => id === comentariosAbiertosPara) ?? VIDEOS[indiceActivo]
  // Los comentarios viven en el servidor. Antes eran una lista inventada más
  // lo que se escribía en memoria, que desaparecía al recargar: escribir para
  // nadie es peor que no poder escribir.
  const comentarios = useComentariosDeVideo(comentariosAbiertosPara)
  const comentar = useComentarVideo(comentariosAbiertosPara)
  const comentariosVisibles = comentarios.data ?? []

  useEffect(() => {
    if (!comentariosAbiertosPara) return
    const cerrarConEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setComentariosAbiertosPara(null)
    }
    window.addEventListener('keydown', cerrarConEscape)
    return () => window.removeEventListener('keydown', cerrarConEscape)
  }, [comentariosAbiertosPara])

  function detectarVideoCentrado(event: UIEvent<HTMLDivElement>) {
    const feed = event.currentTarget
    const centro = feed.scrollTop + feed.clientHeight / 2
    let idMasCercano = videoActivoId
    let distanciaMenor = Number.POSITIVE_INFINITY

    feed.querySelectorAll<HTMLElement>('[data-video-id]').forEach((elemento) => {
      const centroElemento = elemento.offsetTop + elemento.offsetHeight / 2
      const distancia = Math.abs(centro - centroElemento)
      if (distancia < distanciaMenor) {
        distanciaMenor = distancia
        idMasCercano = elemento.dataset.videoId ?? idMasCercano
      }
    })

    if (idMasCercano !== videoActivoId) {
      setVideoActivoId(idMasCercano)
      if (comentariosAbiertosPara) setComentariosAbiertosPara(idMasCercano)
    }
  }

  function navegarA(direccion: -1 | 1) {
    const indiceDestino = Math.min(VIDEOS.length - 1, Math.max(0, indiceActivo + direccion))
    const destino = feedRef.current?.querySelector<HTMLElement>(
      `[data-video-id="${VIDEOS[indiceDestino]?.id}"]`,
    )
    feedRef.current?.scrollTo({ top: destino?.offsetTop ?? 0, behavior: 'smooth' })
  }

  function navegarConTeclado(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowDown' || event.key === 'PageDown') {
      event.preventDefault()
      navegarA(1)
    }
    if (event.key === 'ArrowUp' || event.key === 'PageUp') {
      event.preventDefault()
      navegarA(-1)
    }
  }

  async function compartir(video: VideoCristiano) {
    const url = `${window.location.origin}/videos#${video.id}`
    const compartirNativo = (navigator as unknown as { share?: (data: ShareData) => Promise<void> }).share
    try {
      if (compartirNativo) await compartirNativo.call(navigator, { title: video.titulo, text: video.descripcion, url })
      else await navigator.clipboard.writeText(url)
      setAviso(compartirNativo ? 'Video compartido' : 'Enlace copiado')
      window.setTimeout(() => setAviso(''), 1800)
    } catch {
      // Cancelar el diálogo nativo no debe alterar el feed.
    }
  }

  async function publicarComentario(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const texto = comentarioNuevo.trim()
    if (!comentariosAbiertosPara || !texto) return
    try {
      await comentar.mutateAsync(texto)
      setComentarioNuevo('')
    } catch {
      // El aviso del formulario ya lo cuenta; no hay nada que deshacer.
    }
  }

  return (
    <section className="shorts-feed" aria-labelledby="christian-videos-title">
      <h1 id="christian-videos-title" className="sr-only">Videos cristianos</h1>

      <div className={`shorts-feed__viewport${comentariosAbiertosPara ? ' has-comments' : ''}`}>
        <div
          ref={feedRef}
          className="shorts-feed__scroller"
          onScroll={detectarVideoCentrado}
          onKeyDown={navegarConTeclado}
          tabIndex={0}
          role="region"
          aria-label="Videos cristianos. Usa las flechas o desliza para cambiar de video."
        >
          {/* Sin catálogo no hay nada que desplazar: se explica en vez de
              dejar una pantalla negra vacía. Que el servidor no conteste no es
              lo mismo que no haber publicado nada, y decirlo mal manda a quien
              mira a buscar un fallo suyo que no existe. */}
          {VIDEOS.length === 0 && (
            <p className="short-video__empty">
              {isPending
                ? 'Cargando videos…'
                : isError
                  ? 'No pudimos traer los videos. Revisa tu conexión y vuelve a intentarlo.'
                  : 'Todavía no hay videos publicados. El administrador los sube desde Contenido.'}
            </p>
          )}

          {VIDEOS.map((video, indice) => {
            const activo = video.id === videoActivoId
            const gustado = gustados.has(video.id)

            return (
              <article
                key={video.id}
                data-video-id={video.id}
                className={`short-video${activo ? ' is-active' : ''}`}
                aria-label={`${indice + 1} de ${VIDEOS.length}: ${video.titulo}`}
              >
                <div className="short-video__composition">
                  <div className="short-video__canvas">
                    <VideoActivo video={video} activo={activo} silenciado={silenciado} />
                    <span className="short-video__shade" aria-hidden="true" />

                    <button
                      type="button"
                      className="short-video__mute"
                      onClick={() => setSilenciado((actual) => !actual)}
                      aria-label={silenciado ? 'Activar sonido' : 'Silenciar video'}
                      aria-pressed={!silenciado}
                    >
                      {silenciado ? <MutedIcon /> : <VolumeIcon />}
                    </button>

                    <div className="short-video__copy">
                      <strong>{video.autor}</strong>
                      <h2>{video.titulo}</h2>
                      <p>{video.descripcion}</p>
                    </div>
                  </div>

                  <aside className="short-video__actions" aria-label={`Acciones para ${video.titulo}`}>
                    <ActionButton
                      label={gustado ? 'Quitar Me gusta' : 'Me gusta'}
                      pressed={gustado}
                      onClick={() => setGustados((actuales) => alternarEnColeccion(actuales, video.id))}
                      icon={<HeartIcon />}
                    />
                    <ActionButton
                      label="Comentarios"
                      count={
                        comentariosAbiertosPara === video.id ? String(comentariosVisibles.length) : ''
                      }
                      expanded={comentariosAbiertosPara === video.id}
                      onClick={() => setComentariosAbiertosPara((actual) => actual === video.id ? null : video.id)}
                      icon={<CommentIcon />}
                    />
                    <ActionButton
                      label="Compartir"
                      onClick={() => void compartir(video)}
                      icon={<ShareIcon />}
                    />
                  </aside>
                </div>
              </article>
            )
          })}
        </div>

        <aside
          id="video-comments-panel"
          className={`shorts-comments${comentariosAbiertosPara ? ' is-open' : ''}`}
          aria-label={`Comentarios de ${videoDeComentarios?.titulo ?? 'este video'}`}
          aria-hidden={!comentariosAbiertosPara}
          inert={!comentariosAbiertosPara}
        >
          <header className="shorts-comments__header">
            <h2>Comentarios <span>{comentariosVisibles.length}</span></h2>
            <button type="button" onClick={() => setComentariosAbiertosPara(null)} aria-label="Cerrar comentarios">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
            </button>
          </header>

          <div className="shorts-comments__list">
            {comentarios.isPending && <p className="shorts-comments__vacio">Cargando…</p>}
            {!comentarios.isPending && comentariosVisibles.length === 0 && (
              <p className="shorts-comments__vacio">Todavía nadie ha comentado. Empieza tú.</p>
            )}
            {/* Ni avatar ni «me gusta»: aquí nadie tiene cuenta ni foto, y el
                contador de likes que había antes era un número inventado. */}
            {comentariosVisibles.map((comentario) => (
              <article key={comentario.id} className="shorts-comment">
                <div className="shorts-comment__avatar" aria-hidden="true">
                  <span>{comentario.autor.slice(-1)}</span>
                </div>
                <div className="shorts-comment__body">
                  <strong>{comentario.autor}</strong>
                  <p>{comentario.mensaje}</p>
                  <div>
                    <small>{cuando(comentario.createdAt)}</small>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {/* Sin candado: comentar no pide cuenta porque no hay cuentas. Cada
              quien lleva un alias dentro del video y nada más. */}
          <footer className="shorts-comments__composer">
            <form onSubmit={(event) => void publicarComentario(event)}>
              <label>
                <span className="sr-only">Escribe un comentario</span>
                <input
                  type="text"
                  value={comentarioNuevo}
                  onChange={(event) => setComentarioNuevo(event.target.value)}
                  placeholder="Comenta sin registrarte…"
                  maxLength={320}
                />
              </label>
              <button type="submit" disabled={comentar.isPending || !comentarioNuevo.trim()}>
                {comentar.isPending ? 'Enviando…' : 'Publicar'}
              </button>
            </form>
          </footer>
          {comentar.isError && (
            <p role="alert" className="shorts-comments__vacio">
              No se pudo publicar. Inténtalo de nuevo en un momento.
            </p>
          )}
        </aside>

        <nav className="shorts-feed__navigation" aria-label="Cambiar video">
          <button type="button" onClick={() => navegarA(-1)} disabled={indiceActivo === 0} aria-label="Video anterior">
            <ArrowIcon direction="up" />
          </button>
          <button type="button" onClick={() => navegarA(1)} disabled={indiceActivo === VIDEOS.length - 1} aria-label="Video siguiente">
            <ArrowIcon direction="down" />
          </button>
        </nav>
      </div>

      <span className="shorts-feed__notice" aria-live="polite">{aviso}</span>
    </section>
  )
}

function VideoActivo({ video, activo, silenciado }: { video: VideoCristiano; activo: boolean; silenciado: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const timelineRef = useRef<HTMLInputElement>(null)
  const [pausado, setPausado] = useState(false)

  useEffect(() => {
    const elemento = videoRef.current
    if (!elemento) return
    let frameId = 0

    if (activo) {
      setPausado(false)
      // Con sonido si se puede. Si el navegador lo rechaza —no hubo gesto
      // todavía—, se reintenta en silencio: mejor ver el video mudo y poder
      // activarlo que quedarse con un fotograma congelado.
      void elemento.play().catch(() => {
        elemento.muted = true
        void elemento.play().catch(() => setPausado(true))
      })
      const animarProgreso = () => {
        sincronizarBarraDeVideo(elemento, timelineRef.current)
        frameId = window.requestAnimationFrame(animarProgreso)
      }
      frameId = window.requestAnimationFrame(animarProgreso)
    } else {
      elemento.pause()
      elemento.currentTime = 0
      sincronizarBarraDeVideo(elemento, timelineRef.current)
    }

    return () => window.cancelAnimationFrame(frameId)
  }, [activo])

  function alternarReproduccion() {
    const elemento = videoRef.current
    if (!elemento) return
    if (elemento.paused) {
      void elemento.play().then(() => setPausado(false)).catch(() => undefined)
    } else {
      elemento.pause()
      setPausado(true)
    }
  }

  function cambiarPosicion(nuevoTiempo: number) {
    const elemento = videoRef.current
    if (!elemento) return
    elemento.currentTime = nuevoTiempo
    sincronizarBarraDeVideo(elemento, timelineRef.current)
  }

  return (
    <>
      <button
        type="button"
        className="short-video__media"
        onClick={alternarReproduccion}
        aria-label={pausado ? `Reproducir ${video.titulo}` : `Pausar ${video.titulo}`}
      >
        <video
          ref={videoRef}
          key={video.id}
          src={video.fuente}
          poster={video.poster}
          playsInline
          autoPlay={activo}
          muted={silenciado}
          loop
          preload="metadata"
          onLoadedMetadata={(event) => sincronizarBarraDeVideo(event.currentTarget, timelineRef.current)}
          onDurationChange={(event) => sincronizarBarraDeVideo(event.currentTarget, timelineRef.current)}
        />
        {pausado && <span className="short-video__play" aria-hidden="true"><PlayIcon /></span>}
      </button>

      <label className="short-video__timeline">
        <span className="sr-only">Posición de reproducción de {video.titulo}</span>
        <input
          ref={timelineRef}
          type="range"
          min="0"
          max="0.01"
          step="0.05"
          defaultValue="0"
          onChange={(event) => cambiarPosicion(Number(event.currentTarget.value))}
          aria-label={`Avanzar o retroceder ${video.titulo}`}
        />
      </label>
    </>
  )
}

function sincronizarBarraDeVideo(video: HTMLVideoElement, barra: HTMLInputElement | null) {
  if (!barra) return
  const duracion = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0.01
  const tiempo = Math.min(video.currentTime, duracion)
  const progreso = (tiempo / duracion) * 100
  barra.max = String(duracion)
  barra.value = String(tiempo)
  barra.style.setProperty('--video-progress', `${progreso}%`)
}

function ActionButton({
  label,
  count,
  icon,
  pressed,
  expanded,
  onClick,
}: {
  label: string
  /** Solo se pinta si hay un número real que enseñar. */
  count?: string | undefined
  icon: React.ReactNode
  pressed?: boolean
  expanded?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      aria-expanded={expanded}
      aria-controls={expanded === undefined ? undefined : 'video-comments-panel'}
    >
      <span>{icon}</span>
      {count && <small>{count}</small>}
    </button>
  )
}

function MutedIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Z" /><path d="m17 9 4 4m0-4-4 4" /></svg>
}

function VolumeIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Z" /><path d="M17 8.5a5 5 0 0 1 0 7" /></svg>
}

function HeartIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.8a5.4 5.4 0 0 0-7.6 0L12 6l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 21l8.8-8.6a5.4 5.4 0 0 0 0-7.6Z" /></svg>
}

function CommentIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.3 8.3 0 0 1-9 8.2 9.2 9.2 0 0 1-3.6-.9L3 20l1.4-4.2A8.3 8.3 0 1 1 21 11.5Z" /><path d="M8 12h.01M12 12h.01M16 12h.01" /></svg>
}

function ShareIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5 5 5-5 5" /><path d="M19 10H9a5 5 0 0 0-5 5v4" /></svg>
}

function PlayIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 9 6-9 6V6Z" /></svg>
}

function ArrowIcon({ direction }: { direction: 'up' | 'down' }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={direction === 'up' ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'} /></svg>
}
