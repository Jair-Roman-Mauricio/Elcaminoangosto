import * as tus from 'tus-js-client'
import { supabase } from '../../lib/supabase'
import { apiClient } from '../../lib/api-client'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

interface CrearSubidaResp {
  assetId: string
  bucket: string
  path: string
}

/**
 * Subida reanudable a Supabase Storage por TUS (HU-8.1). Tolerante a cortes de
 * red: `tus-js-client` reintenta y reanuda desde el último trozo confirmado.
 *
 * 1. El API reserva el asset y devuelve bucket+path (carpeta del usuario).
 * 2. Se sube el archivo por TUS al endpoint resumable, con el JWT del usuario.
 * 3. El API encola la transcodificación.
 *
 * Devuelve el `assetId` para que el llamador consulte el estado hasta READY.
 */
export async function subirMedioReanudable(
  file: File,
  kind: 'VIDEO' | 'IMAGE',
  onProgress: (pct: number) => void,
): Promise<string> {
  const { assetId, bucket, path } = await apiClient.post<CrearSubidaResp>('/media/uploads', {
    kind,
    bucket: 'feed-media',
  })

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
        bucketName: bucket,
        objectName: path,
        contentType: file.type || (kind === 'VIDEO' ? 'video/mp4' : 'image/jpeg'),
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

  await apiClient.post(`/media/uploads/${assetId}/process`)
  return assetId
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
