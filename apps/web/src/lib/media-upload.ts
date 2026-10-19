import type { Bucket, MediaKind } from '@elcamino/shared-types'
import { authClient } from './auth-client'
import { apiClient } from './api-client'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api'

interface CrearSubidaResp {
  assetId: string
  bucket: string
  path: string
}

const REINTENTOS = [0, 1000, 3000]

/** Un PUT con progreso. Falla con `ErrorDeRed` si se cortó la conexión (reintentable). */
class ErrorDeRed extends Error {}

function subirPorXhr(
  url: string,
  file: File,
  contentType: string,
  token: string,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve()
      let mensaje = `Error ${xhr.status}`
      try {
        mensaje = (JSON.parse(xhr.responseText) as { message?: string }).message ?? mensaje
      } catch {
        /* cuerpo no JSON */
      }
      reject(new Error(mensaje))
    }
    xhr.onerror = () => reject(new ErrorDeRed('Se cortó la conexión durante la subida'))
    xhr.send(file)
  })
}

/**
 * Subida de un medio al almacenamiento, a través del API (HU-8.1). Reintenta si
 * la red se corta. Compartida entre el feed (`feed-media`) y el discipulado.
 *
 * 1. El API reserva el asset y devuelve bucket+path (carpeta del usuario).
 * 2. Se manda el archivo a `PUT /media/uploads/:id/content`; el API lo valida
 *    (tipo, tamaño, dueño) y lo guarda en el bucket.
 * 3. El API encola la transcodificación.
 *
 * Devuelve el `assetId` para que el llamador consulte el estado hasta READY.
 */
export async function subirMedioReanudable(
  file: File,
  kind: MediaKind,
  bucket: Bucket,
  onProgress: (pct: number) => void,
  opciones: { procesar?: boolean } = {},
): Promise<string> {
  const { procesar = true } = opciones
  const { assetId } = await apiClient.post<CrearSubidaResp>('/media/uploads', { kind, bucket })

  const contentType =
    file.type || (kind === 'AUDIO' ? 'audio/mpeg' : kind === 'VIDEO' ? 'video/mp4' : 'image/jpeg')

  for (let intento = 0; ; intento++) {
    const session = await authClient.getSession()
    if (!session) throw new Error('Sesión no disponible')
    try {
      await subirPorXhr(`${BASE_URL}/media/uploads/${assetId}/content`, file, contentType, session.accessToken, onProgress)
      break
    } catch (error) {
      const espera = REINTENTOS[intento]
      if (!(error instanceof ErrorDeRed) || espera === undefined) throw error
      await new Promise((r) => setTimeout(r, espera))
    }
  }

  // Encolar la transcodificación. Opcional: quien crea una lección de curso
  // prefiere no perder el contenido si la cola (Redis) está temporalmente caída;
  // encola aparte, como mejor esfuerzo. El feed sí la necesita antes de esperar.
  if (procesar) await apiClient.post(`/media/uploads/${assetId}/process`)
  return assetId
}

/** Encola la transcodificación sin propagar el fallo (mejor esfuerzo). */
export async function encolarProcesado(assetId: string): Promise<boolean> {
  try {
    await apiClient.post(`/media/uploads/${assetId}/process`)
    return true
  } catch {
    return false
  }
}

interface EstadoMedio {
  id: string
  status: 'UPLOADED' | 'PROCESSING' | 'READY' | 'FAILED'
  posterPath: string | null
}

/** Espera a que el worker termine la transcodificación (READY o FAILED). */
export async function esperarProcesado(
  assetId: string,
  onEstado?: (s: EstadoMedio['status']) => void,
  timeoutMs = 90_000,
): Promise<EstadoMedio> {
  const hasta = Date.now() + timeoutMs
  for (;;) {
    const estado = await apiClient.get<EstadoMedio>(`/media/${assetId}/status`)
    onEstado?.(estado.status)
    if (estado.status === 'READY' || estado.status === 'FAILED') return estado
    if (Date.now() > hasta) throw new Error('La transcodificación tardó demasiado')
    await new Promise((r) => setTimeout(r, 2000))
  }
}

/** Lee la duración (segundos) de un archivo de video local, sin subirlo. */
export function leerDuracionVideo(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve(Number.isFinite(video.duration) ? Math.round(video.duration) : null)
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    video.src = url
  })
}
