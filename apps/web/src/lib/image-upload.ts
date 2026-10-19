import { apiClient } from './api-client'

/**
 * Sube una imagen al almacenamiento PÚBLICO (`thumbnails`) y devuelve su URL
 * permanente. A diferencia del video (privado, URL firmada que expira), el
 * contenido de un curso guarda la URL embebida en el Markdown/galería, así que
 * debe ser durable. Solo MAESTRO/ADMIN pueden subir.
 */
export async function subirImagenPublica(file: File): Promise<string> {
  const { url } = await apiClient.putBinario<{ url: string }>('/media/images', file)
  return url
}
