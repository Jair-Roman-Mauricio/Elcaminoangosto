import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlbumSleeve } from '../../components/album-sleeve'
import { VinylDisc } from '../../components/vinyl-disc'
import { useFavoriteSongsStore } from '../../stores/favorite-songs.store'
import { usePlayerStore } from '../../stores/player.store'
import {
  ALBUMES_DE_ALABANZA,
  CANCIONES_DE_ALABANZA,
  buscarAlbumDeAlabanza,
  buscarCancionDeAlabanza,
  type Alabanza,
  type AlbumDeAlabanza,
} from './alabanza-catalog'
import { SongSubtitles } from './song-subtitles'

type Vista = 'albumes' | 'discos' | 'reproductor'
type Filtro = 'todo' | 'favoritos'
type FaseDeApertura = 'centrando' | 'discos' | null
type AlbumDeCatalogo = AlbumDeAlabanza & { collectionId?: string; primerSongId?: string }

const CATEGORIA_ALBUMES_FAVORITOS = 'albumes-favoritos'
const PORTADA_PREDETERMINADA_FAVORITOS = '/music/covers/favorite-album-default.jpg'
const TAMANO_PORTADA_PERSONAL = 720

const normalizar = (texto: string) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

function convertirEnPortadaCuadrada(archivo: File) {
  return new Promise<string>((resolve, reject) => {
    const urlTemporal = URL.createObjectURL(archivo)
    const imagen = new Image()
    imagen.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = TAMANO_PORTADA_PERSONAL
        canvas.height = TAMANO_PORTADA_PERSONAL
        const contexto = canvas.getContext('2d')
        if (!contexto) throw new Error('No se pudo preparar la portada.')
        const lado = Math.min(imagen.naturalWidth, imagen.naturalHeight)
        contexto.drawImage(
          imagen,
          (imagen.naturalWidth - lado) / 2,
          (imagen.naturalHeight - lado) / 2,
          lado,
          lado,
          0,
          0,
          TAMANO_PORTADA_PERSONAL,
          TAMANO_PORTADA_PERSONAL,
        )
        resolve(canvas.toDataURL('image/jpeg', .84))
      } catch (error) {
        reject(error)
      } finally {
        URL.revokeObjectURL(urlTemporal)
      }
    }
    imagen.onerror = () => {
      URL.revokeObjectURL(urlTemporal)
      reject(new Error('La imagen seleccionada no se pudo leer.'))
    }
    imagen.src = urlTemporal
  })
}

export function AlabanzaPage() {
  const { pista, reproduciendo, progreso, reproducir } = usePlayerStore()
  const {
    cancionesFavoritas: favoritos,
    albumesFavoritos,
    hidratarFavoritos,
    crearAlbumFavorito,
    editarAlbumFavorito,
  } = useFavoriteSongsStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const albumIdEnUrl = searchParams.get('album')
  const songIdEnUrl = searchParams.get('song')
  const collectionIdEnUrl = searchParams.get('collection')
  const categoriaEnUrl = searchParams.get('category')
  const albumInicial = buscarAlbumDeAlabanza(albumIdEnUrl)
  const cancionInicial = buscarCancionDeAlabanza(songIdEnUrl)
  const [vista, setVista] = useState<Vista>(cancionInicial ? 'reproductor' : albumInicial || collectionIdEnUrl ? 'discos' : 'albumes')
  const [albumId, setAlbumId] = useState(cancionInicial?.albumId ?? albumInicial?.albumId ?? ALBUMES_DE_ALABANZA[0]!.albumId)
  const [collectionId, setCollectionId] = useState<string | null>(collectionIdEnUrl)
  const [categoriaAlbum, setCategoriaAlbum] = useState(
    categoriaEnUrl === 'favorites' || collectionIdEnUrl ? CATEGORIA_ALBUMES_FAVORITOS : 'todos',
  )
  const [consulta, setConsulta] = useState('')
  const [nuevoAlbum, setNuevoAlbum] = useState('')
  const [creandoAlbum, setCreandoAlbum] = useState(false)
  const [albumEditandoId, setAlbumEditandoId] = useState<string | null>(null)
  const [tituloEditado, setTituloEditado] = useState('')
  const [portadaEditada, setPortadaEditada] = useState<string | null>(null)
  const [cancionesEditadas, setCancionesEditadas] = useState<string[]>([])
  const [procesandoPortada, setProcesandoPortada] = useState(false)
  const [errorDeEdicion, setErrorDeEdicion] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todo')
  const [albumAbriendo, setAlbumAbriendo] = useState<string | null>(null)
  const [faseApertura, setFaseApertura] = useState<FaseDeApertura>(null)
  const [desplazamientoAlbum, setDesplazamientoAlbum] = useState({ x: 0, y: 0 })
  const aperturaTimer = useRef<number | null>(null)
  const catalogoRef = useRef<HTMLDivElement>(null)
  const filtrosRef = useRef<HTMLElement>(null)
  const [indicadorFiltro, setIndicadorFiltro] = useState({ left: 0, width: 0 })

  useEffect(() => {
    hidratarFavoritos()
    return () => {
      if (aperturaTimer.current !== null) window.clearTimeout(aperturaTimer.current)
    }
  }, [hidratarFavoritos])

  useEffect(() => {
    const cancionDeLaUrl = buscarCancionDeAlabanza(songIdEnUrl)
    const coleccionDeLaUrl = albumesFavoritos.find((album) => album.albumId === collectionIdEnUrl)
    if (cancionDeLaUrl) {
      if (albumIdEnUrl !== cancionDeLaUrl.albumId) {
        const siguientesParametros: Record<string, string> = {
          album: cancionDeLaUrl.albumId,
          song: cancionDeLaUrl.songId,
        }
        if (coleccionDeLaUrl) {
          siguientesParametros.category = 'favorites'
          siguientesParametros.collection = coleccionDeLaUrl.albumId
        }
        setSearchParams(siguientesParametros, { replace: true })
        return
      }
      setAlbumId(cancionDeLaUrl.albumId)
      setCollectionId(coleccionDeLaUrl?.albumId ?? null)
      setVista('reproductor')
      if (!usePlayerStore.getState().pista) {
        const cancionesDeLaCola = coleccionDeLaUrl
          ? CANCIONES_DE_ALABANZA.filter((cancion) => coleccionDeLaUrl.songIds.includes(cancion.songId))
          : CANCIONES_DE_ALABANZA
        reproducir(
          coleccionDeLaUrl ? { ...cancionDeLaUrl, collectionId: coleccionDeLaUrl.albumId } : cancionDeLaUrl,
          coleccionDeLaUrl
            ? cancionesDeLaCola.map((cancion) => ({ ...cancion, collectionId: coleccionDeLaUrl.albumId }))
            : cancionesDeLaCola,
        )
      }
      return
    }

    if (coleccionDeLaUrl) {
      setCollectionId(coleccionDeLaUrl.albumId)
      setCategoriaAlbum(CATEGORIA_ALBUMES_FAVORITOS)
      setFiltro('todo')
      setVista('discos')
      return
    }

    const albumDeLaUrl = buscarAlbumDeAlabanza(albumIdEnUrl)
    if (albumDeLaUrl) {
      setCollectionId(null)
      setAlbumId(albumDeLaUrl.albumId)
      setVista('discos')
      return
    }

    setCollectionId(null)
    if (categoriaEnUrl === 'favorites') setCategoriaAlbum(CATEGORIA_ALBUMES_FAVORITOS)
    setVista('albumes')
  }, [albumIdEnUrl, albumesFavoritos, categoriaEnUrl, collectionIdEnUrl, reproducir, setSearchParams, songIdEnUrl])

  useLayoutEffect(() => {
    const actualizarIndicador = () => {
      const nav = filtrosRef.current
      const botonActivo = nav?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
      if (!nav || !botonActivo) return
      setIndicadorFiltro({ left: botonActivo.offsetLeft, width: botonActivo.offsetWidth })
    }

    actualizarIndicador()
    window.addEventListener('resize', actualizarIndicador)
    return () => window.removeEventListener('resize', actualizarIndicador)
  }, [categoriaAlbum, filtro, vista])

  useEffect(() => {
    if (!creandoAlbum && !albumEditandoId) return
    const cerrarConEscape = (evento: KeyboardEvent) => {
      if (evento.key !== 'Escape') return
      setCreandoAlbum(false)
      setAlbumEditandoId(null)
    }
    window.addEventListener('keydown', cerrarConEscape)
    return () => window.removeEventListener('keydown', cerrarConEscape)
  }, [albumEditandoId, creandoAlbum])

  const activa = buscarCancionDeAlabanza(songIdEnUrl) ?? (pista ? buscarCancionDeAlabanza(pista.songId) : undefined) ?? CANCIONES_DE_ALABANZA[0]!
  const albumActivo = buscarAlbumDeAlabanza(albumId) ?? ALBUMES_DE_ALABANZA[0]!
  const coleccionActiva = albumesFavoritos.find((album) => album.albumId === collectionId)
  const termino = normalizar(consulta.trim())
  const coincide = (texto: string) => !termino || normalizar(texto).includes(termino)
  const albumesPersonales = useMemo<AlbumDeCatalogo[]>(() => albumesFavoritos.map((album, indice) => {
    const primeraCancion = CANCIONES_DE_ALABANZA.find((cancion) => album.songIds.includes(cancion.songId))
    const albumDeLaCancion = buscarAlbumDeAlabanza(primeraCancion?.albumId)
    return {
      albumId: album.albumId,
      collectionId: album.albumId,
      ...(primeraCancion ? { primerSongId: primeraCancion.songId } : {}),
      numero: `F${String(indice + 1).padStart(2, '0')}`,
      titulo: album.titulo,
      descripcion: `${album.songIds.length} ${album.songIds.length === 1 ? 'canción' : 'canciones'}`,
      coverUrl: album.coverUrl ?? PORTADA_PREDETERMINADA_FAVORITOS,
      tono: albumDeLaCancion?.tono ?? 'vino',
      discColor: albumDeLaCancion?.discColor ?? '#8f1639',
    }
  }), [albumesFavoritos])
  const albumes = useMemo<AlbumDeCatalogo[]>(() => {
    if (categoriaAlbum === CATEGORIA_ALBUMES_FAVORITOS) {
      return albumesPersonales.filter((album) => coincide(`${album.titulo} ${album.descripcion}`))
    }
    return ALBUMES_DE_ALABANZA.filter((album) => {
      const coincideCategoria = categoriaAlbum === 'todos' || album.albumId === categoriaAlbum
      return coincideCategoria && coincide(`${album.titulo} ${album.descripcion}`)
    })
  }, [albumesPersonales, categoriaAlbum, termino])
  const discos = useMemo(() => {
    const candidatos = coleccionActiva
      ? CANCIONES_DE_ALABANZA.filter((disc) => coleccionActiva.songIds.includes(disc.songId))
      : CANCIONES_DE_ALABANZA.filter((disc) => disc.albumId === albumId)
    return candidatos.filter((disc) => coincide(`${disc.titulo} ${disc.artista} ${disc.subtitulo}`) && (filtro === 'todo' || favoritos.includes(disc.songId)))
  }, [albumId, coleccionActiva, favoritos, filtro, termino])
  const cancionesDelEditor = cancionesEditadas
    .map((songId) => buscarCancionDeAlabanza(songId))
    .filter((cancion): cancion is Alabanza => cancion !== undefined)

  function abrirAlbum(album: AlbumDeCatalogo) {
    if (albumAbriendo) return
    const nextId = album.albumId
    const catalogo = catalogoRef.current
    const seleccionado = catalogo?.querySelector<HTMLElement>(`[data-album-id="${nextId}"]`)
    if (catalogo && seleccionado) {
      const catalogoRect = catalogo.getBoundingClientRect()
      const albumRect = seleccionado.getBoundingClientRect()
      setDesplazamientoAlbum({
        x: catalogoRect.left + catalogoRect.width / 2 - (albumRect.left + albumRect.width / 2),
        y: catalogoRect.top + catalogoRect.height / 2 - (albumRect.top + albumRect.height / 2),
      })
    }
    if (album.collectionId) setCollectionId(album.collectionId)
    else {
      setCollectionId(null)
      setAlbumId(nextId)
    }
    setFiltro('todo')
    setAlbumAbriendo(nextId)
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setFaseApertura('centrando')
    aperturaTimer.current = window.setTimeout(() => {
      setFaseApertura('discos')
      aperturaTimer.current = window.setTimeout(() => {
        setSearchParams(album.collectionId
          ? { category: 'favorites', collection: album.collectionId }
          : { album: nextId })
        setVista('discos')
        setAlbumAbriendo(null)
        setFaseApertura(null)
        aperturaTimer.current = null
      }, reduceMotion ? 0 : 1050)
    }, reduceMotion ? 0 : 680)
  }
  function reproducirDisco(disco: Alabanza) {
    const pistaConContexto = coleccionActiva
      ? { ...disco, collectionId: coleccionActiva.albumId }
      : disco
    const cola = coleccionActiva
      ? CANCIONES_DE_ALABANZA
        .filter((cancion) => coleccionActiva.songIds.includes(cancion.songId))
        .map((cancion) => ({ ...cancion, collectionId: coleccionActiva.albumId }))
      : CANCIONES_DE_ALABANZA
    reproducir(pistaConContexto, cola)
    setSearchParams(coleccionActiva
      ? { category: 'favorites', collection: coleccionActiva.albumId, album: disco.albumId, song: disco.songId }
      : { album: disco.albumId, song: disco.songId })
    setVista('reproductor')
  }

  function cambiarCategoriaAlbum(categoria: string) {
    setCategoriaAlbum(categoria)
    setConsulta('')
    setSearchParams(categoria === CATEGORIA_ALBUMES_FAVORITOS ? { category: 'favorites' } : {})
  }

  function crearAlbumPersonal(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const albumCreado = crearAlbumFavorito(nuevoAlbum)
    if (!albumCreado) return
    setNuevoAlbum('')
    setCreandoAlbum(false)
    setCategoriaAlbum(CATEGORIA_ALBUMES_FAVORITOS)
    setSearchParams({ category: 'favorites' })
  }

  function abrirEditorDeAlbum(albumIdPersonal: string) {
    const album = albumesFavoritos.find((item) => item.albumId === albumIdPersonal)
    if (!album) return
    setTituloEditado(album.titulo)
    setPortadaEditada(album.coverUrl)
    setCancionesEditadas(album.songIds)
    setErrorDeEdicion('')
    setAlbumEditandoId(album.albumId)
  }

  function cerrarEditorDeAlbum() {
    setAlbumEditandoId(null)
    setErrorDeEdicion('')
    setProcesandoPortada(false)
  }

  async function cambiarPortadaDelAlbum(archivo: File) {
    if (!archivo.type.startsWith('image/')) {
      setErrorDeEdicion('Selecciona un archivo de imagen válido.')
      return
    }
    if (archivo.size > 10 * 1024 * 1024) {
      setErrorDeEdicion('La imagen debe pesar menos de 10 MB.')
      return
    }
    setProcesandoPortada(true)
    setErrorDeEdicion('')
    try {
      setPortadaEditada(await convertirEnPortadaCuadrada(archivo))
    } catch (error) {
      setErrorDeEdicion(error instanceof Error ? error.message : 'No se pudo preparar la portada.')
    } finally {
      setProcesandoPortada(false)
    }
  }

  function guardarEdicionDeAlbum(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!albumEditandoId || procesandoPortada) return
    const actualizado = editarAlbumFavorito(albumEditandoId, {
      titulo: tituloEditado,
      coverUrl: portadaEditada,
      songIds: cancionesEditadas,
    })
    if (!actualizado) {
      setErrorDeEdicion('Usa un nombre distinto al de tus otros álbumes.')
      return
    }
    cerrarEditorDeAlbum()
  }

  if (vista === 'reproductor') {
    return (
      <section className={`praise-player-view praise-player-view--${activa.tono}`} aria-label={`Reproductor: ${activa.titulo}`}>
        <div className="praise-player-view__background" aria-hidden="true">
          {activa.fondo.tipo === 'video'
            ? <video src={activa.fondo.url} autoPlay muted loop playsInline preload="metadata" poster={activa.coverUrl ?? undefined} />
            : <img src={activa.fondo.url} alt="" />}
        </div>
        <div className="praise-player-view__veil" />
        <div className="praise-player-view__body">
          <header className="praise-player-view__copy">
            <h1>{activa.titulo}</h1>
            <span>{activa.artista}</span>
          </header>
          {activa.fondo.tipo === 'imagen' && activa.subtitlesUrl && (
            <SongSubtitles src={activa.subtitlesUrl} currentTime={progreso} />
          )}
        </div>
      </section>
    )
  }

  return (
    <section className="praise-archive" aria-label="Archivo de alabanza">
      <div className="praise-library praise-library--flow">
        <header className="praise-library__catalog-header">
          <div className="praise-library__title-row">
            <h1>Catálogo de canciones</h1>
          </div>

          <div className={`praise-library__tools${categoriaAlbum === CATEGORIA_ALBUMES_FAVORITOS && vista === 'albumes' ? ' praise-library__tools--with-action' : ''}`} role="search">
            <label className="praise-search" htmlFor="praise-search-input">
              <svg className="praise-search__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input
                id="praise-search-input"
                type="search"
                value={consulta}
                onChange={(event) => setConsulta(event.target.value)}
                placeholder={categoriaAlbum === CATEGORIA_ALBUMES_FAVORITOS && vista === 'albumes'
                  ? 'Buscar entre tus álbumes favoritos'
                  : vista === 'albumes' ? 'Buscar una canción, álbum o intérprete' : 'Buscar en este álbum'}
              />
            </label>
            {categoriaAlbum === CATEGORIA_ALBUMES_FAVORITOS && vista === 'albumes' && (
              <button
                type="button"
                className="praise-library__create-album"
                onClick={() => setCreandoAlbum(true)}
              >
                Crear álbum
              </button>
            )}
          </div>

          {vista === 'albumes' ? (
            <nav ref={filtrosRef} className="praise-library__filters" aria-label="Categorías de canciones">
              <span className="praise-library__filter-indicator" aria-hidden="true" style={{ width: indicadorFiltro.width, transform: `translateX(${indicadorFiltro.left}px)` }} />
              <button type="button" onClick={() => cambiarCategoriaAlbum('todos')} aria-pressed={categoriaAlbum === 'todos'}>Todos</button>
              {ALBUMES_DE_ALABANZA.map((album) => (
                <button key={album.albumId} type="button" onClick={() => cambiarCategoriaAlbum(album.albumId)} aria-pressed={categoriaAlbum === album.albumId}>
                  {album.titulo}
                </button>
              ))}
              <button
                type="button"
                onClick={() => cambiarCategoriaAlbum(CATEGORIA_ALBUMES_FAVORITOS)}
                aria-pressed={categoriaAlbum === CATEGORIA_ALBUMES_FAVORITOS}
              >
                Álbumes de favoritos
              </button>
            </nav>
          ) : (
            <nav ref={filtrosRef} className="praise-library__filters" aria-label="Filtros de discos">
              <span className="praise-library__filter-indicator" aria-hidden="true" style={{ width: indicadorFiltro.width, transform: `translateX(${indicadorFiltro.left}px)` }} />
              <button type="button" onClick={() => setFiltro('todo')} aria-pressed={filtro === 'todo'}>Todos los discos</button>
              {!coleccionActiva && (
                <button type="button" onClick={() => setFiltro('favoritos')} aria-pressed={filtro === 'favoritos'}>Favoritos</button>
              )}
            </nav>
          )}
        </header>

        {vista === 'albumes' ? (
          <>
            <div ref={catalogoRef} className={`praise-albums praise-albums--sleeves${faseApertura ? ` is-${faseApertura}` : ''}`}>
              {albumes.map((album) => {
                const isSelected = albumAbriendo === album.albumId
                const isEjecting = isSelected && faseApertura === 'discos'
                const primerDisco = album.primerSongId
                  ? buscarCancionDeAlabanza(album.primerSongId)
                  : CANCIONES_DE_ALABANZA.find((disco) => disco.albumId === album.albumId)
                return (
                  <article
                    key={album.albumId}
                    data-album-id={album.albumId}
                    className={`praise-album-item${isSelected ? ' is-selected' : ''}`}
                    style={isSelected ? { '--album-center-x': `${desplazamientoAlbum.x}px`, '--album-center-y': `${desplazamientoAlbum.y}px` } as CSSProperties : undefined}
                  >
                    <AlbumSleeve artwork={album.coverUrl} discArtwork={primerDisco?.coverUrl ?? album.coverUrl} discColor={album.discColor} title={album.titulo} opening={isEjecting} disabled={albumAbriendo !== null} onOpen={() => abrirAlbum(album)} />
                    <div className="praise-album-item__caption">
                      <p>{album.titulo}</p>
                      {album.collectionId && (
                        <button
                          type="button"
                          onClick={() => abrirEditorDeAlbum(album.collectionId!)}
                          disabled={albumAbriendo !== null}
                          aria-label={`Editar el álbum ${album.titulo}`}
                        >
                          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="m4 16.5-.7 4.2 4.2-.7L19 8.5 15.5 5 4 16.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                            <path d="m13.8 6.7 3.5 3.5" stroke="currentColor" strokeWidth="1.5" />
                          </svg>
                          Editar
                        </button>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
            {albumes.length === 0 && (
              <p className="praise-library__empty">
                {categoriaAlbum === CATEGORIA_ALBUMES_FAVORITOS
                  ? 'Todavía no has creado álbumes de favoritos.'
                  : 'No encontramos categorías para esta búsqueda.'}
              </p>
            )}
          </>
        ) : (
          <>
            <div className="praise-discs-grid">
              {discos.map((disco) => (
                <article key={disco.songId} className={`praise-disc-object praise-disc-object--${disco.tono}`}>
                  <button type="button" onClick={() => reproducirDisco(disco)} aria-label={`Escuchar ${disco.titulo}`}>
                    <VinylDisc artwork={disco.coverUrl ?? albumActivo.coverUrl} color={buscarAlbumDeAlabanza(disco.albumId)?.discColor ?? albumActivo.discColor} label={`Vinilo de ${disco.titulo}`} spinning={pista?.songId === disco.songId && reproduciendo} className="praise-disc-object__scene" />
                    <strong>{disco.titulo}</strong>
                  </button>
                </article>
              ))}
            </div>
            {discos.length === 0 && <p className="praise-library__empty">No hay discos que coincidan con estos filtros.</p>}
          </>
        )}
      </div>
      {creandoAlbum && (
        <div
          className="praise-favorite-confirmation"
          onMouseDown={(evento) => {
            if (evento.target === evento.currentTarget) setCreandoAlbum(false)
          }}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-favorite-album-title"
            className="praise-favorite-confirmation__dialog praise-create-album-modal"
            onSubmit={crearAlbumPersonal}
          >
            <span>Biblioteca personal</span>
            <h2 id="create-favorite-album-title">Crear álbum</h2>
            <label className="praise-create-album-modal__field">
              <span>Nombre del álbum</span>
              <input
                type="text"
                value={nuevoAlbum}
                onChange={(evento) => setNuevoAlbum(evento.target.value)}
                placeholder="Mi álbum de favoritos"
                maxLength={48}
                autoFocus
              />
            </label>
            <div className="praise-favorite-confirmation__actions">
              <button type="button" onClick={() => setCreandoAlbum(false)}>Cancelar</button>
              <button type="submit" disabled={!nuevoAlbum.trim()}>Crear álbum</button>
            </div>
          </form>
        </div>
      )}
      {albumEditandoId && (
        <div
          className="praise-favorite-confirmation"
          onMouseDown={(evento) => {
            if (evento.target === evento.currentTarget) cerrarEditorDeAlbum()
          }}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-favorite-album-title"
            className="praise-favorite-confirmation__dialog praise-edit-album-modal"
            onSubmit={guardarEdicionDeAlbum}
          >
            <span>Álbum de favoritos</span>
            <h2 id="edit-favorite-album-title">Editar álbum</h2>

            <div className="praise-edit-album-modal__content">
              <div className="praise-edit-album-modal__cover-column">
                <div className="praise-edit-album-modal__cover">
                  <img src={portadaEditada ?? PORTADA_PREDETERMINADA_FAVORITOS} alt="Vista previa de la portada" />
                </div>
                <label className="praise-edit-album-modal__upload">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(evento) => {
                      const archivo = evento.currentTarget.files?.[0]
                      if (archivo) void cambiarPortadaDelAlbum(archivo)
                      evento.currentTarget.value = ''
                    }}
                  />
                  {procesandoPortada ? 'Preparando imagen…' : 'Cambiar imagen'}
                </label>
                {portadaEditada && (
                  <button type="button" className="praise-edit-album-modal__default-cover" onClick={() => setPortadaEditada(null)}>
                    Usar imagen predeterminada
                  </button>
                )}
              </div>

              <div className="praise-edit-album-modal__details">
                <label className="praise-create-album-modal__field">
                  <span>Nombre del álbum</span>
                  <input
                    type="text"
                    value={tituloEditado}
                    onChange={(evento) => {
                      setTituloEditado(evento.target.value)
                      setErrorDeEdicion('')
                    }}
                    maxLength={48}
                    autoFocus
                  />
                </label>

                <section className="praise-edit-album-modal__songs" aria-labelledby="edit-album-songs-title">
                  <div className="praise-edit-album-modal__songs-heading">
                    <h3 id="edit-album-songs-title">Canciones</h3>
                    <span>{cancionesDelEditor.length}</span>
                  </div>
                  {cancionesDelEditor.length > 0 ? (
                    <ul>
                      {cancionesDelEditor.map((cancion) => (
                        <li key={cancion.songId}>
                          <img src={cancion.coverUrl ?? PORTADA_PREDETERMINADA_FAVORITOS} alt="" />
                          <span>
                            <strong>{cancion.titulo}</strong>
                            <small>{cancion.artista}</small>
                          </span>
                          <button
                            type="button"
                            onClick={() => setCancionesEditadas((actuales) => actuales.filter((songId) => songId !== cancion.songId))}
                            aria-label={`Quitar ${cancion.titulo} del álbum`}
                          >
                            Quitar
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>Este álbum todavía no tiene canciones.</p>
                  )}
                </section>
              </div>
            </div>

            {errorDeEdicion && <p className="praise-edit-album-modal__error" role="alert">{errorDeEdicion}</p>}
            <div className="praise-favorite-confirmation__actions">
              <button type="button" onClick={cerrarEditorDeAlbum}>Cancelar</button>
              <button type="submit" disabled={!tituloEditado.trim() || procesandoPortada}>Guardar cambios</button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}
