import { supabase } from './supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

/**
 * Sube una imagen a un bucket PÚBLICO (`thumbnails`) y devuelve su URL
 * permanente. A diferencia del video (privado, URL firmada que expira), el
 * contenido de un curso guarda la URL embebida en el Markdown/galería, así que
 * debe ser durable. La política de Storage permite escribir a MAESTRO/ADMIN.
 */
export async function subirImagenPublica(file: File): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Sesión no disponible')

  const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
  const path = `${session.user.id}/${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage.from('thumbnails').upload(path, file, {
    cacheControl: '31536000',
    contentType: file.type || 'image/png',
    upsert: false,
  })
  if (error) throw new Error(`No se pudo subir la imagen: ${error.message}`)

  return `${SUPABASE_URL}/storage/v1/object/public/thumbnails/${path}`
}
