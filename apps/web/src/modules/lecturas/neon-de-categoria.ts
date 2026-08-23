/**
 * El brillo de las oraciones: un único dorado, el de la marca.
 *
 * Antes cada categoría deducía su propio color del nombre, pero la mezcla de
 * neones fríos (cielo, violeta, menta, rosa…) sobre el negro reñía con el
 * dorado de toda la casa. Ahora el halo, las píldoras y el botón usan el mismo
 * `--acento` (#f2cb5e) que el resto del sitio, así que la categoría se distingue
 * por su texto, no por un color distinto.
 *
 * Se mantiene la firma —recibe la categoría y devuelve un RGB— para no tocar a
 * quien la llama; simplemente hoy la respuesta es siempre la misma.
 */
const ORO = '242, 203, 94' // #f2cb5e, el --acento de la marca

export function neonDeCategoria(_categoria: string | null): string {
  return ORO
}
