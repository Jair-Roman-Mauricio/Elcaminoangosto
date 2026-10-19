const API_URL: string = import.meta.env.VITE_API_URL ?? ''

/** Ruta del API que sirve lo público (avatares, miniaturas) y sabe redimensionar. */
const ORIGEN_PUBLICO = '/files/public/'

/**
 * Calidad por defecto. 75 es el punto donde una foto deja de encoger sin que
 * el ojo note la diferencia; por debajo empiezan a verse los bloques.
 */
const CALIDAD = 75

/**
 * Pide al API la imagen al tamaño en que se va a ver.
 *
 * Las portadas se guardan tal como salieron del equipo de quien las sube: PNG
 * de dos y tres megas. Pintadas en una tarjeta de 300 px eso es tirar el 98 %
 * de los bytes, y en el catálogo de Alabanza sumaba 89 MB por visita. El API
 * las devuelve del ancho pedido y en WebP, con un año de caché.
 *
 * `ancho` es el ancho real de pintado, no el del archivo. Se pide el doble
 * para que en pantallas de densidad alta no se vea borrosa. La proporción se
 * respeta: manda el ancho, el alto sale solo.
 *
 * Lo que no vive en nuestro almacenamiento público —una URL de fuera, una
 * firmada, un `data:`— se devuelve intacto.
 */
export function imagenOptimizada(
  url: string | null | undefined,
  ancho: number,
  calidad: number = CALIDAD,
): string {
  if (!url) return ''
  if (!API_URL || !url.startsWith(API_URL) || !url.includes(ORIGEN_PUBLICO)) return url

  const [ruta] = url.split('?')
  return `${ruta}?w=${Math.round(ancho * 2)}&q=${calidad}`
}
