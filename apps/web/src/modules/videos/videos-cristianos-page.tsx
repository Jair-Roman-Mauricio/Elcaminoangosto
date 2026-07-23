import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type UIEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePerfil, useSession } from '../../auth/session'

interface VideoCristiano {
  id: string
  titulo: string
  serie: string
  descripcion: string
  fuente: string
  poster: string
  cita: string
  autor: string
  meGusta: string
  comentarios: string
  compartidos: string
}

interface ComentarioDeVideo {
  id: string
  autor: string
  mensaje: string
  avatar?: string
  tiempo: string
  meGusta: string
}

const VIDEOS: VideoCristiano[] = [
  {
    id: 'bienaventurados',
    titulo: 'Bienaventurados',
    serie: 'Palabras que permanecen',
    descripcion: 'Una pausa para volver al centro del mensaje y escuchar con calma.',
    fuente: '/media/2-vertical.mp4',
    poster: '/posters/2-vertical.jpg',
    cita: 'Mateo 5:3–12',
    autor: '@elcaminoangosto',
    meGusta: '12.8K',
    comentarios: '438',
    compartidos: '816',
  },
  {
    id: 'camino-desierto',
    titulo: 'El camino en el desierto',
    serie: 'Recorridos de fe',
    descripcion: 'Caminar incluso cuando el horizonte todavía no revela la respuesta.',
    fuente: '/media/1.mp4',
    poster: '/posters/1.jpg',
    cita: 'Isaías 43:19',
    autor: '@elcaminoangosto',
    meGusta: '9,704',
    comentarios: '271',
    compartidos: '519',
  },
  {
    id: 'enviados',
    titulo: 'Enviados de dos en dos',
    serie: 'Comunidad y misión',
    descripcion: 'La fe también se aprende caminando junto a otros y compartiendo el llamado.',
    fuente: '/media/3.mp4',
    poster: '/posters/3.jpg',
    cita: 'Marcos 6:7',
    autor: '@elcaminoangosto',
    meGusta: '7,312',
    comentarios: '186',
    compartidos: '403',
  },
  {
    id: 'tumba-vacia',
    titulo: 'La piedra fue removida',
    serie: 'Memorias de esperanza',
    descripcion: 'Un recordatorio visual de que la última palabra no pertenece a la oscuridad.',
    fuente: '/media/4.mp4',
    poster: '/posters/4.jpg',
    cita: 'Lucas 24:2–6',
    autor: '@elcaminoangosto',
    meGusta: '15.1K',
    comentarios: '624',
    compartidos: '1,024',
  },
]

const COMENTARIOS_INICIALES: Record<string, ComentarioDeVideo[]> = {
  bienaventurados: [
    { id: 'c-01', autor: 'Lucía R.', mensaje: 'Necesitaba escuchar esto hoy. Gracias por compartirlo.', avatar: '/posters/1.jpg', tiempo: 'Hace 8 min', meGusta: '128' },
    { id: 'c-02', autor: 'Samuel Ortega', mensaje: 'Bienaventurados los que encuentran paz aun en medio del camino.', avatar: '/posters/3.jpg', tiempo: 'Hace 24 min', meGusta: '84' },
    { id: 'c-03', autor: 'María Fernanda', mensaje: 'Mateo 5 siempre vuelve a poner mi corazón en su lugar.', avatar: '/posters/4.jpg', tiempo: 'Hace 1 h', meGusta: '46' },
  ],
  'camino-desierto': [
    { id: 'c-11', autor: 'Andrés L.', mensaje: 'Él sigue abriendo camino aunque todavía no podamos verlo.', avatar: '/posters/2.jpg', tiempo: 'Hace 12 min', meGusta: '97' },
    { id: 'c-12', autor: 'Claudia Paz', mensaje: 'Esta palabra llegó justo en el momento indicado.', avatar: '/posters/4.jpg', tiempo: 'Hace 45 min', meGusta: '52' },
  ],
  enviados: [
    { id: 'c-21', autor: 'David y Ana', mensaje: 'La misión también se construye acompañándonos.', avatar: '/posters/1.jpg', tiempo: 'Hace 18 min', meGusta: '71' },
    { id: 'c-22', autor: 'Josué M.', mensaje: 'Nadie debería caminar solo.', avatar: '/posters/3.jpg', tiempo: 'Hace 2 h', meGusta: '33' },
  ],
  'tumba-vacia': [
    { id: 'c-31', autor: 'Elena Torres', mensaje: 'La esperanza tiene la última palabra.', avatar: '/posters/4.jpg', tiempo: 'Hace 5 min', meGusta: '204' },
    { id: 'c-32', autor: 'Matías R.', mensaje: 'Él vive. Esa verdad lo cambia todo.', avatar: '/posters/2.jpg', tiempo: 'Hace 38 min', meGusta: '119' },
  ],
}

function alternarEnColeccion(actuales: Set<string>, id: string) {
  const siguientes = new Set(actuales)
  if (siguientes.has(id)) siguientes.delete(id)
  else siguientes.add(id)
  return siguientes
}

export function VideosCristianosPage() {
  const navigate = useNavigate()
  const { session } = useSession()
  const { data: perfil } = usePerfil()
  const [videoActivoId, setVideoActivoId] = useState(VIDEOS[0]?.id ?? '')
  const [silenciado, setSilenciado] = useState(true)
  const [gustados, setGustados] = useState<Set<string>>(() => new Set())
  const [aviso, setAviso] = useState('')
  const [comentariosAbiertosPara, setComentariosAbiertosPara] = useState<string | null>(null)
  const [comentarioNuevo, setComentarioNuevo] = useState('')
  const [comentariosNuevos, setComentariosNuevos] = useState<Record<string, ComentarioDeVideo[]>>({})
  const feedRef = useRef<HTMLDivElement>(null)

  const indiceActivo = Math.max(0, VIDEOS.findIndex(({ id }) => id === videoActivoId))
  const videoDeComentarios = VIDEOS.find(({ id }) => id === comentariosAbiertosPara) ?? VIDEOS[indiceActivo]
  const comentariosVisibles = videoDeComentarios
    ? [...(comentariosNuevos[videoDeComentarios.id] ?? []), ...(COMENTARIOS_INICIALES[videoDeComentarios.id] ?? [])]
    : []

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

  function publicarComentario(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!session) {
      navigate('/entrar', { state: { desde: '/videos' } })
      return
    }
    if (!comentariosAbiertosPara || !comentarioNuevo.trim()) return
    const autor = perfil?.displayName ?? session.user.email?.split('@')[0] ?? 'Usuario'
    const comentario: ComentarioDeVideo = {
      id: crypto.randomUUID(),
      autor,
      mensaje: comentarioNuevo.trim(),
      ...(perfil?.avatarUrl ? { avatar: perfil.avatarUrl } : {}),
      tiempo: 'Ahora',
      meGusta: '0',
    }
    setComentariosNuevos((actuales) => ({
      ...actuales,
      [comentariosAbiertosPara]: [comentario, ...(actuales[comentariosAbiertosPara] ?? [])],
    }))
    setComentarioNuevo('')
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
                      count={video.meGusta}
                      pressed={gustado}
                      onClick={() => setGustados((actuales) => alternarEnColeccion(actuales, video.id))}
                      icon={<HeartIcon />}
                    />
                    <ActionButton
                      label="Comentarios"
                      count={video.comentarios}
                      expanded={comentariosAbiertosPara === video.id}
                      onClick={() => setComentariosAbiertosPara((actual) => actual === video.id ? null : video.id)}
                      icon={<CommentIcon />}
                    />
                    <ActionButton
                      label="Compartir"
                      count={video.compartidos}
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
            <h2>Comentarios <span>{videoDeComentarios?.comentarios ?? '0'}</span></h2>
            <button type="button" onClick={() => setComentariosAbiertosPara(null)} aria-label="Cerrar comentarios">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
            </button>
          </header>

          <div className="shorts-comments__list">
            {comentariosVisibles.map((comentario) => (
              <article key={comentario.id} className="shorts-comment">
                <div className="shorts-comment__avatar" aria-hidden="true">
                  {comentario.avatar
                    ? <img src={comentario.avatar} alt="" />
                    : <span>{comentario.autor.slice(0, 1).toUpperCase()}</span>}
                </div>
                <div className="shorts-comment__body">
                  <strong>{comentario.autor}</strong>
                  <p>{comentario.mensaje}</p>
                  <div>
                    <small>{comentario.tiempo}</small>
                    <button type="button">Responder</button>
                  </div>
                </div>
                <button type="button" className="shorts-comment__like" aria-label={`Me gusta el comentario de ${comentario.autor}`}>
                  <HeartIcon />
                  <span>{comentario.meGusta}</span>
                </button>
              </article>
            ))}
          </div>

          <footer className="shorts-comments__composer">
            {session ? (
              <form onSubmit={publicarComentario}>
                <div className="shorts-comments__user" aria-hidden="true">
                  {perfil?.avatarUrl
                    ? <img src={perfil.avatarUrl} alt="" />
                    : <span>{(perfil?.displayName ?? session.user.email ?? 'U').slice(0, 1).toUpperCase()}</span>}
                </div>
                <label>
                  <span className="sr-only">Escribe un comentario</span>
                  <input
                    type="text"
                    value={comentarioNuevo}
                    onChange={(event) => setComentarioNuevo(event.target.value)}
                    placeholder="Añade un comentario…"
                    maxLength={320}
                  />
                </label>
                <button type="submit" disabled={!comentarioNuevo.trim()}>Publicar</button>
              </form>
            ) : (
              <button type="button" onClick={() => navigate('/entrar', { state: { desde: '/videos' } })}>
                <CommentIcon />
                Iniciar sesión para comentar
              </button>
            )}
          </footer>
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
      void elemento.play().catch(() => setPausado(true))
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
  count: string
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
      <small>{count}</small>
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
