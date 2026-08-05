import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../../lib/api-client'
import type { Lectura, OracionGuiada } from '../../lecturas/lecturas-api'

/* Contratos del módulo Contenido (espejo del servidor). */

/** Los cambios llegan de un formulario parcial: admiten `undefined` explícito. */
type Cambios<T> = { [K in keyof T]?: T[K] | undefined }

export type EstadoTarjeta = 'PUBLISHED' | 'HIDDEN' | 'REPORTED'

/** Ficha de la tarjeta: lo que se lee en el lienzo del feed. */
export interface FichaTarjeta {
  title: string | null
  manifesto: string | null
  /** Relato; los párrafos se separan con una línea en blanco. */
  story: string | null
  origin: string | null
  reference: string | null
  audioAssetId: string | null
}

export interface TarjetaAdmin {
  id: string
  authorName: string
  type: 'VIDEO' | 'IMAGE'
  caption: string | null
  title: string | null
  manifesto: string | null
  /** El resto de la ficha, para poder corregirla sin volver a escribirla. */
  story: string | null
  origin: string | null
  reference: string | null
  status: EstadoTarjeta
  /** UPLOADED | PROCESSING | READY | FAILED: por qué una tarjeta aún no se ve. */
  mediaStatus: string
  posterUrl: string | null
  publishedAt: string | null
  createdAt: string
}

/** Todas las tarjetas, en cualquier estado (solo ADMIN). */
export function useTarjetasAdmin() {
  return useQuery({
    queryKey: ['contenido', 'tarjetas'],
    queryFn: () => apiClient.get<TarjetaAdmin[]>('/feed/admin'),
    // Las URLs de póster van firmadas y caducan: no las cacheamos de más.
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Al cambiar una tarjeta hay que refrescar dos vistas: el módulo Contenido y el
 * feed que ven los usuarios.
 */
function useInvalidarTarjetas() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: ['contenido', 'tarjetas'] })
    void qc.invalidateQueries({ queryKey: ['feed'] })
  }
}

export function useCambiarEstadoTarjeta() {
  const invalidar = useInvalidarTarjetas()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'PUBLISHED' | 'HIDDEN' }) =>
      apiClient.patch(`/feed/${id}/status`, { status }),
    onSuccess: invalidar,
  })
}

export function useEliminarTarjeta() {
  const invalidar = useInvalidarTarjetas()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/feed/${id}`),
    onSuccess: invalidar,
  })
}

/**
 * Corregir la ficha de una tarjeta ya publicada. El medio no se toca: cambiar
 * la imagen es publicar otra tarjeta.
 */
export function useEditarTarjeta() {
  const invalidar = useInvalidarTarjetas()
  return useMutation({
    mutationFn: ({
      id,
      ...cambios
    }: { id: string; caption?: string | null | undefined } & Cambios<FichaTarjeta>) =>
      apiClient.patch(`/feed/${id}`, cambios),
    onSuccess: invalidar,
  })
}

export function usePublicarTarjetaAdmin() {
  const invalidar = useInvalidarTarjetas()
  return useMutation({
    mutationFn: (input: { mediaAssetId: string; caption: string | null } & FichaTarjeta) =>
      apiClient.post('/feed', input),
    onSuccess: invalidar,
  })
}

// ── Videos cristianos (HU-9.3) ─────────────────────────────────────────────

export type EstadoVideo = 'PUBLISHED' | 'HIDDEN'

/** Ficha de un video: los textos que acompañan al archivo. */
export interface FichaVideo {
  title: string
  series: string | null
  description: string | null
  reference: string | null
}

export interface VideoAdmin extends FichaVideo {
  id: string
  authorName: string
  status: EstadoVideo
  /** UPLOADED | PROCESSING | READY | FAILED. */
  mediaStatus: string
  posterUrl: string | null
  publishedAt: string | null
  createdAt: string
}

export function useVideosAdmin() {
  return useQuery({
    queryKey: ['contenido', 'videos'],
    queryFn: () => apiClient.get<VideoAdmin[]>('/videos/admin'),
    staleTime: 5 * 60 * 1000,
  })
}

/** Tras cambiar un video hay que refrescar el módulo y el catálogo público. */
function useInvalidarVideos() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: ['contenido', 'videos'] })
    void qc.invalidateQueries({ queryKey: ['videos'] })
  }
}

/** Corregir la ficha de un video. El archivo no se cambia desde aquí. */
export function useEditarVideo() {
  const invalidar = useInvalidarVideos()
  return useMutation({
    mutationFn: ({ id, ...cambios }: { id: string } & Cambios<FichaVideo>) =>
      apiClient.patch(`/videos/${id}`, cambios),
    onSuccess: invalidar,
  })
}

export function usePublicarVideo() {
  const invalidar = useInvalidarVideos()
  return useMutation({
    mutationFn: (input: FichaVideo & { mediaAssetId: string }) => apiClient.post('/videos', input),
    onSuccess: invalidar,
  })
}

export function useCambiarEstadoVideo() {
  const invalidar = useInvalidarVideos()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: EstadoVideo }) =>
      apiClient.patch(`/videos/${id}/status`, { status }),
    onSuccess: invalidar,
  })
}

export function useEliminarVideo() {
  const invalidar = useInvalidarVideos()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/videos/${id}`),
    onSuccess: invalidar,
  })
}

// ── Alabanza: álbumes y canciones (HU-9.2) ─────────────────────────────────

export type TonoAlabanza = 'vino' | 'marfil' | 'azul'
export type TipoDeFondo = 'imagen' | 'video'

export interface AlbumAdmin {
  albumId: string
  numero: string
  titulo: string
  descripcion: string
  coverUrl: string
  tono: TonoAlabanza
  discColor: string
}

export interface CancionAdmin {
  id: string
  title: string
  subtitle: string | null
  artistName: string
  albumId: string | null
  albumTitle: string | null
  trackNumber: number | null
  durationSeconds: number | null
  isPublished: boolean
  tone: TonoAlabanza
}

/** Álbumes y todas las canciones, publicadas o no (solo ADMIN). */
export function useMusicaAdmin() {
  return useQuery({
    queryKey: ['contenido', 'musica'],
    queryFn: () =>
      apiClient.get<{ albumes: AlbumAdmin[]; canciones: CancionAdmin[] }>('/music/admin'),
  })
}

/** Tras cambiar algo hay que refrescar el módulo y el catálogo de Alabanza. */
function useInvalidarMusica() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: ['contenido', 'musica'] })
    void qc.invalidateQueries({ queryKey: ['alabanza'] })
  }
}

export function useCrearAlbum() {
  const invalidar = useInvalidarMusica()
  return useMutation({
    mutationFn: (input: {
      title: string
      artistName: string
      number: string | null
      description: string | null
      coverImageUrl: string | null
      tone: TonoAlabanza
      discColor: string | null
    }) => apiClient.post('/music/albums', input),
    onSuccess: invalidar,
  })
}

export function useEliminarAlbum() {
  const invalidar = useInvalidarMusica()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/music/albums/${id}`),
    onSuccess: invalidar,
  })
}

export function useEditarAlbum() {
  const invalidar = useInvalidarMusica()
  return useMutation({
    mutationFn: ({
      id,
      ...cambios
    }: {
      id: string
      title?: string
      number?: string | null
      description?: string | null
      coverImageUrl?: string | null
      tone?: TonoAlabanza
      discColor?: string | null
    }) => apiClient.patch(`/music/albums/${id}`, cambios),
    onSuccess: invalidar,
  })
}

export function useCrearCancion() {
  const invalidar = useInvalidarMusica()
  return useMutation({
    mutationFn: (input: {
      title: string
      artistName: string
      albumId: string | null
      subtitle: string | null
      trackNumber: number | null
      audioAssetId: string
      durationSeconds: number | null
      tone: TonoAlabanza
      /** Fondo de imagen: URL pública ya subida. */
      backgroundUrl: string | null
      /** Fondo de video: medio ya subido por el pipeline. */
      backgroundAssetId: string | null
      backgroundType: TipoDeFondo | null
      /** Contenido del `.srt`, no su URL. */
      subtitlesSrt: string | null
    }) => apiClient.post('/music/songs', input),
    onSuccess: invalidar,
  })
}

export function usePublicarCancion() {
  const invalidar = useInvalidarMusica()
  return useMutation({
    mutationFn: ({ id, isPublished }: { id: string; isPublished: boolean }) =>
      apiClient.patch(`/music/songs/${id}/published`, { isPublished }),
    onSuccess: invalidar,
  })
}

export function useEliminarCancion() {
  const invalidar = useInvalidarMusica()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/music/songs/${id}`),
    onSuccess: invalidar,
  })
}

// ── Lecturas: devocionales, revista y oraciones guiadas ────────────────────

/**
 * Lo que se manda al publicar o editar una lectura.
 *
 * El cuerpo viaja en Markdown: es lo que produce el editor y lo que sabe
 * expresar subtítulos, imágenes por sección y citas sin inventar un campo
 * nuevo cada vez que el artículo necesita algo más.
 */
export interface FichaLectura {
  titulo: string
  entradilla: string | null
  /** Cuerpo en Markdown, tal como lo deja el editor. */
  cuerpo: string
  autor: string
  seccion: string | null
  referencia: string | null
  /** Redes que acompañan a la lectura: solo las que quien publica añada. */
  redes: Record<string, string>
  portadaAssetId: string | null
  /** Recorte sin fondo para la página del devocional. */
  ilustracionAssetId: string | null
  /** Telón de fondo del devocional, por su clave. */
  fondo: string | null
}

/**
 * Las listas del admin son las mismas rutas públicas: al ir firmado incluyen
 * también lo oculto. Se guardan bajo otra clave para que ocultar algo aquí no
 * deje al lector con una copia vieja en la que sigue apareciendo.
 */
export function useLecturasAdmin(tipo: 'DEVOCIONAL' | 'ARTICULO') {
  return useQuery({
    queryKey: ['contenido', 'lecturas', tipo],
    queryFn: () =>
      apiClient.get<Lectura[]>(tipo === 'DEVOCIONAL' ? '/devocionales' : '/revista'),
    staleTime: 5 * 60 * 1000,
  })
}

export function useOracionesAdmin() {
  return useQuery({
    queryKey: ['contenido', 'oraciones'],
    queryFn: () => apiClient.get<OracionGuiada[]>('/oraciones'),
    staleTime: 5 * 60 * 1000,
  })
}

function useInvalidarLecturas() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: ['contenido', 'lecturas'] })
    void qc.invalidateQueries({ queryKey: ['contenido', 'oraciones'] })
    void qc.invalidateQueries({ queryKey: ['lecturas'] })
  }
}

export function usePublicarLectura(tipo: 'DEVOCIONAL' | 'ARTICULO') {
  const invalidar = useInvalidarLecturas()
  return useMutation({
    mutationFn: (input: FichaLectura) =>
      apiClient.post(tipo === 'DEVOCIONAL' ? '/devocionales' : '/revista', input),
    onSuccess: invalidar,
  })
}

export function useEditarLectura() {
  const invalidar = useInvalidarLecturas()
  return useMutation({
    mutationFn: ({
      id,
      ...cambios
    }: { id: string; oculto?: boolean | undefined } & Cambios<FichaLectura>) =>
      apiClient.patch(`/lecturas/${id}`, cambios),
    onSuccess: invalidar,
  })
}

export function useEliminarLectura() {
  const invalidar = useInvalidarLecturas()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/lecturas/${id}`),
    onSuccess: invalidar,
  })
}

export function usePublicarOracion() {
  const invalidar = useInvalidarLecturas()
  return useMutation({
    mutationFn: (input: {
      titulo: string
      tema: string | null
      lineas: string[]
      marcas: number[] | null
      audioAssetId: string
    }) => apiClient.post('/oraciones', input),
    onSuccess: invalidar,
  })
}

export function useEditarOracion() {
  const invalidar = useInvalidarLecturas()
  return useMutation({
    mutationFn: ({
      id,
      ...cambios
    }: {
      id: string
      oculto?: boolean | undefined
      titulo?: string | undefined
      tema?: string | null | undefined
      lineas?: string[] | undefined
      marcas?: number[] | null | undefined
      audioAssetId?: string | undefined
    }) => apiClient.patch(`/oraciones/${id}`, cambios),
    onSuccess: invalidar,
  })
}

export function useEliminarOracion() {
  const invalidar = useInvalidarLecturas()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/oraciones/${id}`),
    onSuccess: invalidar,
  })
}
