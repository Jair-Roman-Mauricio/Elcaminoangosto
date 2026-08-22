const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? ''

const ORIGEN_PUBLICO = '/storage/v1/object/public/'
const TRANSFORMADOR = '/storage/v1/render/image/public/'

/**
 * Calidad por defecto. 75 es el punto donde una foto deja de encoger sin que
 * el ojo note la diferencia; por debajo empiezan a verse los bloques.
 */
const CALIDAD = 75

/**
 * Pide a Supabase la imagen al tamaño en que se va a ver.
 *
 * Las portadas se guardan tal como salieron del equipo de quien las sube: PNG
 * de dos y tres megas. Pintadas en una tarjeta de 300 px eso es tirar el 98 %
 * de los bytes, y en el catálogo de Alabanza sumaba 89 MB por visita. El
 * transformador de Supabase (incluido en el plan Pro) las devuelve del ancho
 * pedido y en WebP: la misma portada baja de 2.437 KB a 52 KB, y se sirve
 * desde la CDN con un año de caché.
 *
 * `ancho` es el ancho real de pintado, no el del archivo. Se pide el doble
 * para que en pantallas de densidad alta no se vea borrosa.
 *
 * Lo que no vive en nuestro Storage público —una URL de fuera, una firmada, un
 * `data:`— se devuelve intacto: el transformador solo sabe de lo nuestro.
 */
export function imagenOptimizada(
  url: string | null | undefined,
  ancho: number,
  calidad: number = CALIDAD,
): string {
  if (!url) return ''
  if (!SUPABASE_URL || !url.startsWith(SUPABASE_URL) || !url.includes(ORIGEN_PUBLICO)) return url

  const [ruta] = url.split('?')
  return `${ruta!.replace(ORIGEN_PUBLICO, TRANSFORMADOR)}?width=${Math.round(ancho * 2)}&quality=${calidad}`
}
