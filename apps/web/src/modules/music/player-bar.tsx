import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { PlayPause, ProgressBar, formatTime, Eyebrow } from '@elcamino/ui'
import { useFavoriteSongsStore } from '../../stores/favorite-songs.store'
import { usePlayerStore } from '../../stores/player.store'
import { buscarAlbumDeAlabanza, rutaDeReproduccion } from './alabanza-catalog'

/**
 * Barra inferior de Alabanza. Se monta una sola vez, fuera del <Outlet />,
 * pero su presencia y reproducción se limitan al archivo sonoro.
 *
 * El elemento <audio> vive aquí para que la reproducción sobreviva a los
 * cambios de ruta igual que el estado de Zustand.
 */
export function PlayerBar() {
  const audioRef = useRef<HTMLAudioElement>(null)
  const ultimoVolumen = useRef(0.8)
  const [confirmandoFavorito, setConfirmandoFavorito] = useState(false)
  const [guardarEnFavoritos, setGuardarEnFavoritos] = useState(false)
  const [albumesSeleccionados, setAlbumesSeleccionados] = useState<string[]>([])
  const {
    pista,
    reproduciendo,
    progreso,
    volumen,
    alternar,
    siguiente,
    anterior,
    buscar,
    actualizarProgreso,
    ajustarVolumen,
    detener,
  } = usePlayerStore()
  const {
    cancionesFavoritas,
    albumesFavoritos,
    hidratarFavoritos,
    actualizarDestinos,
  } = useFavoriteSongsStore()
  const location = useLocation()
  const navigate = useNavigate()
  const enAlabanza = location.pathname.startsWith('/alabanza')
  const songIdEnUrl = enAlabanza ? new URLSearchParams(location.search).get('song') : null
  const enVistaCompleta = Boolean(songIdEnUrl)
  const estaGuardada = Boolean(pista && (
    cancionesFavoritas.includes(pista.songId)
    || albumesFavoritos.some((album) => album.songIds.includes(pista.songId))
  ))
  const albumOriginal = buscarAlbumDeAlabanza(pista?.albumId)

  useEffect(() => {
    hidratarFavoritos()
  }, [hidratarFavoritos])

  useEffect(() => {
    setConfirmandoFavorito(false)
  }, [enVistaCompleta, pista?.songId])

  useEffect(() => {
    if (!confirmandoFavorito) return
    const cerrarConEscape = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setConfirmandoFavorito(false)
    }
    window.addEventListener('keydown', cerrarConEscape)
    return () => window.removeEventListener('keydown', cerrarConEscape)
  }, [confirmandoFavorito])

  useEffect(() => {
    if (enAlabanza || !pista) return
    audioRef.current?.pause()
    detener()
  }, [detener, enAlabanza, pista])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !pista) return

    audio.volume = volumen
    audio.muted = volumen === 0

    if (reproduciendo) {
      void audio.play().catch(() => usePlayerStore.setState({ reproduciendo: false }))
    } else {
      audio.pause()
    }
  }, [pista, reproduciendo, volumen])

  useEffect(() => {
    const audio = audioRef.current
    if (audio) {
      audio.volume = volumen
      audio.muted = volumen === 0
    }
    if (volumen > 0) ultimoVolumen.current = volumen
  }, [volumen])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || Math.abs(audio.currentTime - progreso) < 1) return
    audio.currentTime = progreso
  }, [progreso])

  useEffect(() => {
    if (!enVistaCompleta || !pista || songIdEnUrl === pista.songId) return
    navigate(rutaDeReproduccion(pista.songId, pista.albumId, pista.collectionId), { replace: true })
  }, [enVistaCompleta, navigate, pista, songIdEnUrl])

  function alternarSilencio() {
    ajustarVolumen(volumen === 0 ? ultimoVolumen.current || 0.8 : 0)
  }

  function alternarVistaCompleta() {
    if (!pista) return
    if (enVistaCompleta) {
      if (pista.collectionId) {
        navigate(`/alabanza?category=favorites&collection=${encodeURIComponent(pista.collectionId)}`)
        return
      }
      const album = pista.albumId
      navigate(album ? `/alabanza?album=${encodeURIComponent(album)}` : '/alabanza')
      return
    }
    navigate(rutaDeReproduccion(pista.songId, pista.albumId, pista.collectionId))
  }

  function abrirGuardado() {
    if (!pista || !enVistaCompleta) return
    setGuardarEnFavoritos(cancionesFavoritas.includes(pista.songId))
    setAlbumesSeleccionados(
      albumesFavoritos
        .filter((album) => album.songIds.includes(pista.songId))
        .map((album) => album.albumId),
    )
    setConfirmandoFavorito(true)
  }

  function alternarAlbumSeleccionado(albumId: string) {
    setAlbumesSeleccionados((actuales) => actuales.includes(albumId)
      ? actuales.filter((id) => id !== albumId)
      : [...actuales, albumId])
  }

  if (!enAlabanza || !pista) return null

  return (
    <>
      <audio
        ref={audioRef}
        src={pista.audioUrl}
        muted={volumen === 0}
        preload="metadata"
        onLoadedMetadata={(evento) => {
          evento.currentTarget.volume = volumen
          evento.currentTarget.muted = volumen === 0
        }}
        onTimeUpdate={(evento) => actualizarProgreso(evento.currentTarget.currentTime)}
        onEnded={siguiente}
      />
      <div
        role="region"
        aria-label="Reproductor de música"
        className="praise-global-player fixed inset-x-0 bottom-0 z-40 bg-superficie-1 cine:pl-[15.5rem]"
        data-expanded={enVistaCompleta ? 'true' : 'false'}
      >
        <div className="praise-global-player__inner mx-auto flex max-w-screen-xl items-center gap-aire-m px-gutter py-aire-s">
        <div className="praise-global-player__track flex min-w-0 flex-1 items-center gap-aire-s">
          <div className="size-12 shrink-0 overflow-hidden rounded bg-superficie-2">
            {pista.coverUrl && (
              <img src={pista.coverUrl} alt="" className="size-full object-cover" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate font-mono text-body-s text-contenido">{pista.titulo}</p>
            <Eyebrow rule={false}>{pista.artista}</Eyebrow>
          </div>
        </div>

        <div className="praise-global-player__transport flex items-center gap-aire-s">
          <button
            type="button"
            onClick={abrirGuardado}
            disabled={!enVistaCompleta}
            aria-pressed={enVistaCompleta && estaGuardada}
            aria-label={enVistaCompleta ? (estaGuardada ? 'Administrar o quitar canción guardada' : 'Guardar canción') : 'Guardar disponible dentro del reproductor'}
            className="praise-player__favorites font-mono text-label text-texto-tenue transition-colors duration-fade ease-camino hover:text-contenido"
          >
            {estaGuardada ? 'Quitar' : 'Guardar'}
          </button>
          <button
            type="button"
            onClick={anterior}
            aria-label="Anterior"
            className="font-mono text-label text-texto-tenue transition-colors duration-fade ease-camino hover:text-contenido"
          >
            ◄◄
          </button>
          <PlayPause reproduciendo={reproduciendo} onToggle={alternar} size={40} />
          <button
            type="button"
            onClick={siguiente}
            aria-label="Siguiente"
            className="font-mono text-label text-texto-tenue transition-colors duration-fade ease-camino hover:text-contenido"
          >
            ►►
          </button>
        </div>

        <div className="praise-global-player__progress hidden flex-1 items-center gap-aire-s cine:flex">
          <span className="font-mono text-eyebrow tabular-nums text-texto-tenue">
            {formatTime(progreso)}
          </span>
          <ProgressBar value={progreso} max={pista.durationSeconds} onSeek={buscar} />
          <span className="font-mono text-eyebrow tabular-nums text-texto-tenue">
            {formatTime(pista.durationSeconds)}
          </span>
        </div>

        <div className="praise-global-player__actions flex items-center gap-aire-xs">
          <div className="praise-global-player__volume">
            <button
              type="button"
              onClick={alternarSilencio}
              aria-label={volumen === 0 ? 'Activar sonido' : 'Silenciar'}
              aria-pressed={volumen === 0}
              className="praise-global-player__icon-button"
            >
              {volumen === 0 ? (
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor" stroke="none" /><path d="m17 9 4 6m0-6-4 6" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor" stroke="none" /><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" /></svg>
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volumen}
              onChange={(evento) => ajustarVolumen(Number(evento.target.value))}
              aria-label="Volumen"
              aria-valuetext={`${Math.round(volumen * 100)} %`}
              style={{ '--player-volume': `${volumen * 100}%` } as CSSProperties}
            />
          </div>
          <button
            type="button"
            onClick={alternarVistaCompleta}
            aria-label={enVistaCompleta ? 'Salir de la vista de reproducción' : 'Ampliar vista de reproducción'}
            aria-pressed={enVistaCompleta}
            className="praise-global-player__icon-button"
          >
            {enVistaCompleta ? (
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
            )}
          </button>
        </div>
        </div>
      </div>
      {confirmandoFavorito && pista && (
        <div
          className="praise-favorite-confirmation"
          onMouseDown={(evento) => {
            if (evento.target === evento.currentTarget) setConfirmandoFavorito(false)
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="favorite-confirmation-title"
            aria-describedby="favorite-confirmation-copy"
            className="praise-favorite-confirmation__dialog"
          >
            <span>Administrar guardado</span>
            <h2 id="favorite-confirmation-title">{pista.titulo}</h2>
            <p id="favorite-confirmation-copy">
              Elige uno o varios destinos. Si no seleccionas ninguno, la canción se quitará de todos.
            </p>
            <fieldset className="praise-favorite-confirmation__destinations">
              <legend>Guardar en</legend>
              <label>
                <input
                  type="checkbox"
                  checked={guardarEnFavoritos}
                  onChange={(evento) => setGuardarEnFavoritos(evento.target.checked)}
                />
                <span>
                  <strong>Favoritos</strong>
                  <small>{albumOriginal ? `Del álbum ${albumOriginal.titulo}` : 'Del álbum original'}</small>
                </span>
              </label>
              {albumesFavoritos.map((album) => (
                <label key={album.albumId}>
                  <input
                    type="checkbox"
                    checked={albumesSeleccionados.includes(album.albumId)}
                    onChange={() => alternarAlbumSeleccionado(album.albumId)}
                  />
                  <span>
                    <strong>{album.titulo}</strong>
                    <small>Álbum personal · {album.songIds.length} canciones</small>
                  </span>
                </label>
              ))}
            </fieldset>
            <div className="praise-favorite-confirmation__actions">
              <button type="button" onClick={() => setConfirmandoFavorito(false)}>Cancelar</button>
              <button
                type="button"
                autoFocus
                onClick={() => {
                  actualizarDestinos(pista.songId, guardarEnFavoritos, albumesSeleccionados)
                  setConfirmandoFavorito(false)
                }}
              >
                {!guardarEnFavoritos && albumesSeleccionados.length === 0 && estaGuardada
                  ? 'Quitar de todos'
                  : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
