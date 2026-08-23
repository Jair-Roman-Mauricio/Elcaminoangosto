import { useEffect } from 'react'

/** De dónde cuelga el sitio. Las etiquetas sociales exigen URL absoluta. */
const SITIO = 'https://www.elcaminoangosto.site'
const NOMBRE = 'El Camino Angosto'

function etiqueta(selector: string, crear: () => HTMLElement): HTMLElement {
  const existente = document.head.querySelector<HTMLElement>(selector)
  if (existente) return existente
  const nueva = crear()
  document.head.appendChild(nueva)
  return nueva
}

function meta(nombre: string, contenido: string, propiedad = false): void {
  const atributo = propiedad ? 'property' : 'name'
  const el = etiqueta(`meta[${atributo}="${nombre}"]`, () => {
    const m = document.createElement('meta')
    m.setAttribute(atributo, nombre)
    return m
  })
  el.setAttribute('content', contenido)
}

/**
 * Pone título, descripción y canónica de la pantalla que se está viendo.
 *
 * En una aplicación de una sola página el `index.html` es el mismo para todas
 * las rutas, así que sin esto Google —y WhatsApp, y X, y cualquiera que pegue
 * un enlace— ve la ficha de la portada en las nueve secciones. Nueve páginas
 * distintas compitiendo con el mismo título es la forma más barata de no salir
 * en ninguna búsqueda.
 *
 * Se ejecuta en el navegador: el rastreador de Google renderiza JavaScript y lo
 * lee, pero no es lo mismo que servirlo ya escrito. Cuando haga falta más, el
 * paso siguiente es prerenderizar estas rutas en el build.
 */
export function useSeo(ficha: { titulo: string; descripcion: string; ruta: string }): void {
  const { titulo, descripcion, ruta } = ficha

  useEffect(() => {
    const completo = `${titulo} · ${NOMBRE}`
    const url = `${SITIO}${ruta}`

    document.title = completo
    meta('description', descripcion)
    meta('og:title', completo, true)
    meta('og:description', descripcion, true)
    meta('og:url', url, true)
    meta('twitter:title', completo)
    meta('twitter:description', descripcion)

    // La canónica le dice a Google cuál es la dirección buena de esto. Sin
    // ella, `?song=`, `?album=` y demás se cuentan como páginas distintas y el
    // valor de una se reparte entre todas.
    const canonica = etiqueta('link[rel="canonical"]', () => {
      const l = document.createElement('link')
      l.setAttribute('rel', 'canonical')
      return l
    })
    canonica.setAttribute('href', url)
  }, [titulo, descripcion, ruta])
}
