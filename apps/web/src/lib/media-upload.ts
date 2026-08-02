import * as tus from 'tus-js-client'
import type { Bucket, MediaKind } from '@elcamino/shared-types'
import { supabase } from './supabase'
import { apiClient } from './api-client'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

interface CrearSubidaResp {
  assetId: string
  bucket: string
  path: string
}

/**
 * Subida reanudable a Supabase Storage por TUS (HU-8.1). Tolerante a cortes de
 * red: `tus-js-client` reintenta y reanuda desde el último trozo confirmado.
 * Compartida entre el feed (`feed-media`) y el discipulado (`course-media`).
 *
 * 1. El API reserva el asset y devuelve bucket+path (carpeta del usuario).
 * 2. Se sube el archivo por TUS al endpoint resumable, con el JWT del usuario.
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
  const { assetId, bucket: bucketReal, path } = await apiClient.post<CrearSubidaResp>(
    '/media/uploads',
    { kind, bucket },
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('Sesión no disponible')

  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
      retryDelays: [0, 1000, 3000, 5000],
      headers: {
        authorization: `Bearer ${session.access_token}`,
        'x-upsert': 'true',
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: bucketReal,
        objectName: path,
        contentType: file.type || (kind === 'AUDIO' ? 'audio/mpeg' : kind === 'VIDEO' ? 'video/mp4' : 'image/jpeg'),
        cacheControl: '3600',
      },
      chunkSize: 6 * 1024 * 1024, // 6 MB — requerido por el endpoint de Supabase
      onError: reject,
      onProgress: (subido, total) => onProgress(Math.round((subido / total) * 100)),
      onSuccess: () => resolve(),
    })

    // Reanuda una subida previa del mismo archivo si la hubo.
    void upload.findPreviousUploads().then((previas) => {
      if (previas.length > 0 && previas[0]) upload.resumeFromPreviousUpload(previas[0])
      upload.start()
    })
  })

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
