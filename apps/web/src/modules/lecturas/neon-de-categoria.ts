/**
 * El neón de cada categoría de oración.
 *
 * El color no se guarda ni se elige al publicar: se deduce del nombre de la
 * categoría. Así una categoría nueva ya llega con el suyo, siempre el mismo, y
 * quien publica no tiene que acordarse de escoger un color ni acertar con uno
 * que combine.
 *
 * Todos son fríos y bajos de saturación a propósito: el fondo sigue siendo
 * negro y el brillo solo lo insinúa. Un neón saturado sobre negro vibra y
 * cansa a los pocos segundos, que es justo lo contrario de lo que busca una
 * oración.
 */
const NEONES = [
  '56, 189, 248', // cielo
  '167, 139, 250', // violeta
  '52, 211, 153', // menta
  '244, 114, 182', // rosa
  '251, 191, 36', // ámbar
  '96, 165, 250', // azul
] as const

/** Suma estable de los caracteres: el mismo nombre siempre da el mismo color. */
export function neonDeCategoria(categoria: string | null): string {
  if (!categoria) return NEONES[0]
  let suma = 0
  for (const letra of categoria.toLowerCase()) suma += letra.charCodeAt(0)
  return NEONES[suma % NEONES.length]!
}
