import type { ReactNode } from 'react'
import { EditorLectura } from '../../components/editor-lectura'
import { TarjetaDeLectura } from './tarjeta-de-lectura'
import { useRelacionadas, type Lectura } from './lecturas-api'

const formatoFecha = new Intl.DateTimeFormat('es-PE', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

/**
 * Las redes de la plataforma.
 *
 * Viven en un solo sitio para que cambiar una cuenta no sea una cacería por el
 * código. Si una queda vacía, su icono no se muestra: es mejor no ofrecer una
 * red que llevar a una página que no existe.
 *
 * OJO: las direcciones de abajo están puestas por el nombre de la marca y hay
 * que confirmarlas con las cuentas reales antes de publicar.
 */
const REDES: { nombre: string; url: string; icono: ReactNode }[] = [
  {
    nombre: 'YouTube',
    url: 'https://www.youtube.com/@elcaminoangosto',
    icono: (
      <path d="M23 12s0-3.2-.4-4.7a3 3 0 0 0-2.1-2.1C18.9 4.7 12 4.7 12 4.7s-6.9 0-8.5.5A3 3 0 0 0 1.4 7.3C1 8.8 1 12 1 12s0 3.2.4 4.7a3 3 0 0 0 2.1 2.1c1.6.5 8.5.5 8.5.5s6.9 0 8.5-.5a3 3 0 0 0 2.1-2.1C23 15.2 23 12 23 12ZM9.8 15.3V8.7l5.7 3.3-5.7 3.3Z" />
    ),
  },
  {
    nombre: 'Facebook',
    url: 'https://www.facebook.com/elcaminoangosto',
    icono: (
      <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.5 2.9h-2.3v7A10 10 0 0 0 22 12Z" />
    ),
  },
  {
    nombre: 'TikTok',
    url: 'https://www.tiktok.com/@elcaminoangosto',
    icono: (
      <path d="M16.6 5.8a5 5 0 0 1-3-4.3h-3.3v13.4a2.9 2.9 0 1 1-2.1-2.8V8.7A6.2 6.2 0 1 0 13.6 15V8.9a8.2 8.2 0 0 0 4.8 1.5V7.1a4.9 4.9 0 0 1-1.8-1.3Z" />
    ),
  },
]

/**
 * Lector de una lectura, en clave de revista.
 *
 * Las decisiones que vienen del oficio editorial y no del gusto:
 *
 * 1. **La imagen entra primero y ocupa todo.** Rompe el margen de la página y
 *    llega a los bordes: es lo que decide si alguien se queda a leer.
 * 2. **Disonancia de escala.** El titular es enorme —más de lo que parece
 *    prudente— en mayúsculas y con el interlineado más corto que su propio
 *    tamaño, de modo que las líneas se traban y forman un bloque.
 * 3. **Medida corta.** Unos 62 caracteres por línea. Más ancho y el ojo pierde
 *    el renglón al volver; es la causa más común de que un texto largo se
 *    abandone.
 * 4. **Entradilla en itálica.** Separa la voz que presenta de la que narra.
 * 5. **Serif para el cuerpo.** En el sistema el serif está reservado a los
 *    versículos; aquí se extiende porque una lectura larga ES esa misma voz.
 *
 * El cuerpo llega en Markdown y lo pinta el mismo editor con el que se
 * escribió, en modo solo lectura: lo que ve quien publica es exactamente lo
 * que se lee después.
 */
export function LectorEditorial({
  lectura,
  onVolver,
  onAbrirOtra,
  children,
}: {
  lectura: Lectura
  onVolver: () => void
  /** Ir a otra lectura desde «para seguir leyendo». Sin esto, no se ofrecen. */
  onAbrirOtra?: (id: string) => void
  /** Lo que va después del texto: la conversación, si la sección la admite. */
  children?: ReactNode
}) {
  const etiquetas = [lectura.seccion, lectura.referencia].filter(Boolean) as string[]

  return (
    <article className="flex flex-col gap-aire-l pb-aire-l">
      {/* La portada ocupa el hueco entero: se come el margen de la página y el
          aire de arriba, y el botón de volver flota encima de ella. Media
          pantalla de imagen antes de la primera palabra. */}
      <div className={lectura.portadaUrl ? 'lectura-portada relative' : 'mx-auto w-full max-w-5xl'}>
        {lectura.portadaUrl && (
          <img
            src={lectura.portadaUrl}
            alt=""
            className="animate-[mensaje-entra_900ms_var(--ease)_both] block h-[min(82vh,46rem)] w-full object-cover"
          />
        )}
        <button
          type="button"
          onClick={onVolver}
          className={
            lectura.portadaUrl
              ? // Sobre la foto: con sombra propia, porque la imagen de abajo
                // puede ser clara y el texto se perdería.
                'absolute left-gutter top-aire-m z-10 border-0 bg-transparent p-0 font-mono text-body-s uppercase tracking-label text-hueso [text-shadow:0_1px_6px_rgba(0,0,0,0.85)] transition-colors duration-fade ease-camino hover:text-oro-claro'
              : 'border-0 bg-transparent p-0 font-mono text-body-s uppercase tracking-label text-texto-tenue transition-colors duration-fade ease-camino hover:text-acento'
          }
        >
          ← Volver
        </button>
      </div>

      {/* La columna de lectura va centrada y las redes flotan fuera, para que
          nada le robe ancho al texto. */}
      <div className="relative mx-auto w-full max-w-[46rem]">
        <Redes />

        <header className="flex flex-col gap-aire-s">
          <p className="m-0 self-start border border-linea px-[0.5rem] py-[0.2rem] font-mono text-[0.68rem] uppercase tracking-label text-texto-tenue">
            {lectura.seccion ?? (lectura.tipo === 'ARTICULO' ? 'Artículo' : 'Devocional')}
          </p>

          <h1 className="m-0 font-ui text-[clamp(2.4rem,7vw,5.4rem)] font-bold uppercase leading-[0.86] tracking-[-0.02em] text-contenido">
            {lectura.titulo}
          </h1>

          {lectura.entradilla && (
            <p className="m-0 mt-aire-xs max-w-[38ch] font-serif text-[clamp(1.2rem,2.4vw,1.75rem)] font-light italic leading-[1.28] text-texto-tenue">
              {lectura.entradilla}
            </p>
          )}

          <p className="m-0 flex flex-wrap items-center gap-x-aire-s border-y border-linea py-aire-xs font-mono text-body-s uppercase tracking-label text-texto-debil">
            <span className="text-contenido">Por {lectura.autor}</span>
            {lectura.publishedAt && <span aria-hidden>·</span>}
            {lectura.publishedAt && (
              <span>{formatoFecha.format(new Date(lectura.publishedAt))}</span>
            )}
            <span aria-hidden>·</span>
            <span>{lectura.minutos} min de lectura</span>
          </p>
        </header>

        <EditorLectura
          key={lectura.id}
          value={lectura.cuerpo}
          editable={false}
          className="editor-lectura--revista mt-aire-m"
        />

        {etiquetas.length > 0 && (
          <ul className="m-0 mt-aire-l flex list-none flex-wrap gap-aire-xs p-0">
            {etiquetas.map((etiqueta) => (
              <li
                key={etiqueta}
                className="border border-linea px-[0.55rem] py-[0.25rem] font-mono text-[0.68rem] uppercase tracking-label text-texto-tenue"
              >
                {etiqueta}
              </li>
            ))}
          </ul>
        )}

        {/* Cierre: la firma se repite al final, como en una columna impresa. */}
        <p className="m-0 mt-aire-m border-t border-linea pt-aire-s text-right font-mono text-body-s uppercase tracking-label text-texto-tenue">
          {lectura.autor}
        </p>
      </div>

      {onAbrirOtra && (
        <div className="mx-auto w-full max-w-5xl">
          <SeguirLeyendo lectura={lectura} onAbrir={onAbrirOtra} />
        </div>
      )}

      {children && <div className="mx-auto w-full max-w-[46rem]">{children}</div>}
    </article>
  )
}

/**
 * Para seguir leyendo: tres de la misma sección.
 *
 * Va antes de los comentarios y no después: quien terminó el texto decide ahí
 * si sigue leyendo o se va, y para entonces la conversación todavía no le dice
 * nada.
 */
function SeguirLeyendo({
  lectura,
  onAbrir,
}: {
  lectura: Lectura
  onAbrir: (id: string) => void
}) {
  const { data } = useRelacionadas(lectura.id)
  const otras = data ?? []
  if (otras.length === 0) return null

  return (
    <section className="flex flex-col gap-aire-s border-t border-linea pt-aire-l">
      <h2 className="m-0 font-mono text-body-s uppercase tracking-label text-texto-tenue">
        {lectura.seccion ? `Más de ${lectura.seccion}` : 'Para seguir leyendo'}
      </h2>
      <div className="grid gap-[2px] sm:grid-cols-3">
        {otras.map((otra) => (
          <TarjetaDeLectura
            key={otra.id}
            lectura={otra}
            onAbrir={() => onAbrir(otra.id)}
            tamano="pequena"
          />
        ))}
      </div>
    </section>
  )
}

/** Las redes, en una columna pegada al margen, como en una revista digital. */
function Redes() {
  const activas = REDES.filter((red) => red.url)
  if (activas.length === 0) return null

  return (
    // Solo cuando de verdad cabe fuera de la columna: por debajo de 1200 el
    // margen izquierdo lo ocupa el menú y los iconos se le echarían encima.
    <div className="absolute -left-[6rem] top-[0.2rem] hidden flex-col gap-[2px] [@media(min-width:1200px)]:flex">
      {activas.map((red) => (
        <a
          key={red.nombre}
          href={red.url}
          target="_blank"
          rel="noreferrer"
          title={red.nombre}
          className="grid size-11 place-items-center border border-linea text-hueso no-underline transition-colors duration-fade ease-camino hover:border-acento hover:text-acento"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
            {red.icono}
          </svg>
          <span className="sr-only">{red.nombre}</span>
        </a>
      ))}
    </div>
  )
}
