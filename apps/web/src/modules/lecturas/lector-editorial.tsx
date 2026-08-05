import type { ReactNode } from 'react'
import { RedesDeLaLectura } from './redes-de-la-lectura'
import { EditorLectura } from '../../components/editor-lectura'
import { TarjetaDeLectura } from './tarjeta-de-lectura'
import { useRelacionadas, type Lectura } from './lecturas-api'

const formatoFecha = new Intl.DateTimeFormat('es-PE', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

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
        <RedesDeLaLectura redes={lectura.redes} />

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
