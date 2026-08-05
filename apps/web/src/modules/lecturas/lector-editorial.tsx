import { useState, type ReactNode } from 'react'
import type { Lectura } from './lecturas-api'

const formatoFecha = new Intl.DateTimeFormat('es-PE', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

/**
 * Lector de una lectura, en clave de revista.
 *
 * Cinco decisiones que vienen del oficio editorial y no del gusto:
 *
 * 1. **Disonancia de escala.** El titular es enorme —más grande de lo que
 *    parece prudente— y va en mayúsculas con el interlineado más corto que su
 *    propio tamaño, de modo que las líneas se traban entre sí y forman un
 *    bloque. Ese salto contra el cuerpo pequeño es lo que hace que una página
 *    se lea como una revista y no como un documento.
 * 2. **Medida corta.** Unos 62 caracteres por línea. Más ancho y el ojo pierde
 *    el renglón al volver; es la causa más común de que un texto largo se
 *    abandone.
 * 3. **Entradilla en itálica.** Separa la voz que presenta de la que narra,
 *    sin necesidad de rótulos.
 * 4. **Serif para el cuerpo.** En el sistema el serif está reservado a los
 *    versículos; aquí se extiende porque una lectura larga ES esa misma voz.
 * 5. **La firma entre reglas.** Un renglón fino arriba y abajo basta para
 *    cerrar la cabecera: no hace falta una caja.
 */
export function LectorEditorial({
  lectura,
  onVolver,
  children,
}: {
  lectura: Lectura
  onVolver: () => void
  /** Lo que va después del texto: la conversación, si la sección la admite. */
  children?: ReactNode
}) {
  const etiquetas = [lectura.seccion, lectura.referencia].filter(Boolean) as string[]

  return (
    <article className="mx-auto flex w-full max-w-5xl flex-col gap-aire-l pb-aire-l">
      <button
        type="button"
        onClick={onVolver}
        className="self-start border-0 bg-transparent p-0 font-mono text-body-s uppercase tracking-label text-texto-tenue transition-colors duration-fade ease-camino hover:text-acento"
      >
        ← Volver
      </button>

      {/* Portada a sangre. En una revista la imagen entra antes que el texto:
          es lo que decide si alguien se queda. */}
      {lectura.portadaUrl && (
        <img
          src={lectura.portadaUrl}
          alt=""
          className="animate-[mensaje-entra_900ms_var(--ease)_both] max-h-[68vh] w-full object-cover"
        />
      )}

      {/* La columna de lectura va centrada y lo de compartir flota fuera, para
          que nada le robe ancho al texto. */}
      <div className="relative mx-auto w-full max-w-[46rem]">
        <Compartir titulo={lectura.titulo} />

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

        <div className="mt-aire-m flex flex-col gap-aire-s">
          {lectura.parrafos.map((parrafo, i) => (
            <p
              key={`${lectura.id}-${i}`}
              className="m-0 max-w-[62ch] font-serif text-[clamp(1.05rem,1.5vw,1.28rem)] leading-[1.62] text-contenido"
            >
              {parrafo}
            </p>
          ))}
        </div>

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

        {children && <div className="mt-aire-l">{children}</div>}
      </div>
    </article>
  )
}

/**
 * Compartir, en una columna pegada al margen.
 *
 * Ahora que cada artículo tiene su propia dirección, el enlace sirve de algo:
 * quien encuentra algo que le habla suele querer mandárselo a alguien, y ese
 * alguien tiene que caer en el artículo y no en el índice.
 */
function Compartir({ titulo }: { titulo: string }) {
  const [copiado, setCopiado] = useState(false)

  const enlace = () => (typeof window === 'undefined' ? '' : window.location.href)

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(enlace())
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Sin permiso de portapapeles no hay nada que avisar: el enlace sigue
      // estando en la barra de direcciones.
    }
  }

  const clase =
    'grid size-10 place-items-center border border-linea text-texto-tenue transition-colors duration-fade ease-camino hover:border-acento hover:text-acento'

  return (
    // Solo cuando de verdad cabe fuera de la columna: por debajo de 1200 el
    // margen izquierdo lo ocupa el menú y los botones se le echarían encima.
    <div className="absolute -left-[6rem] top-[0.2rem] hidden flex-col gap-[2px] [@media(min-width:1200px)]:flex">
      <button type="button" onClick={() => void copiar()} className={clase} title="Copiar el enlace">
        {copiado ? (
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path
              d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
        <span className="sr-only">Copiar el enlace</span>
      </button>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(`${titulo} ${enlace()}`)}`}
        target="_blank"
        rel="noreferrer"
        className={`${clase} no-underline`}
        title="Compartir por WhatsApp"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
          <path d="M12.04 2a9.9 9.9 0 0 0-8.5 15l-1.3 4.8 4.9-1.3A9.9 9.9 0 1 0 12.04 2Zm0 1.8a8.1 8.1 0 1 1-4.1 15.1l-.3-.2-2.9.8.8-2.8-.2-.3a8.1 8.1 0 0 1 6.7-12.6Zm-3 4c-.2 0-.5.1-.7.4-.3.3-.9.9-.9 2.1s.9 2.4 1 2.6c.1.2 1.7 2.8 4.3 3.8 2.1.8 2.5.7 3 .6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.6-.3-1.6-.8c-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1-.2-.1-1.1-.4-2-1.2-.7-.6-1.2-1.4-1.4-1.7-.1-.2 0-.4.1-.5l.4-.5c.1-.2.2-.3.3-.5v-.5l-.8-1.9c-.2-.4-.4-.4-.6-.4h-.4Z" />
        </svg>
        <span className="sr-only">Compartir por WhatsApp</span>
      </a>
    </div>
  )
}
