import type { ReactNode } from 'react'
import type { Lectura } from './lecturas-api'

const formatoFecha = new Intl.DateTimeFormat('es-PE', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

/**
 * Lector de una lectura, en clave de revista.
 *
 * Cuatro decisiones que vienen del oficio editorial y no del gusto:
 *
 * 1. **Disonancia de escala.** El título es enorme y el cuerpo pequeño. Ese
 *    salto es lo que hace que una página se lea como una revista y no como un
 *    documento.
 * 2. **Medida corta.** Unos 62 caracteres por línea. Más ancho y el ojo pierde
 *    el renglón al volver; es la causa más común de que un texto largo se
 *    abandone.
 * 3. **Capitular.** La primera letra grande marca dónde empieza a leerse, que
 *    en una pantalla llena de cosas no es evidente.
 * 4. **Serif para el cuerpo.** En el sistema el serif está reservado a los
 *    versículos; aquí se extiende porque una lectura larga ES esa misma voz.
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
  return (
    <article className="mx-auto flex w-full max-w-4xl flex-col gap-aire-l pb-aire-l">
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
          className="animate-[mensaje-entra_900ms_var(--ease)_both] max-h-[52vh] w-full object-cover"
        />
      )}

      <header className="flex flex-col gap-aire-s">
        <p className="m-0 flex flex-wrap items-center gap-x-aire-s font-mono text-body-s uppercase tracking-label text-acento">
          {lectura.seccion && <span>{lectura.seccion}</span>}
          {lectura.seccion && <span aria-hidden>·</span>}
          <span>{lectura.minutos} min de lectura</span>
        </p>

        <h1 className="m-0 font-serif text-[clamp(2.2rem,6vw,4.4rem)] font-light leading-[1.05] tracking-[-0.01em] text-contenido">
          {lectura.titulo}
        </h1>

        {lectura.entradilla && (
          <p className="m-0 max-w-[46ch] font-ui text-body-l leading-relaxed text-texto-tenue">
            {lectura.entradilla}
          </p>
        )}

        <p className="m-0 flex flex-wrap items-center gap-x-aire-s border-t border-linea pt-aire-s font-mono text-body-s uppercase tracking-label text-texto-debil">
          <span className="text-contenido">{lectura.autor}</span>
          {lectura.publishedAt && <span aria-hidden>·</span>}
          {lectura.publishedAt && <span>{formatoFecha.format(new Date(lectura.publishedAt))}</span>}
          {lectura.referencia && <span aria-hidden>·</span>}
          {lectura.referencia && <span className="text-acento">{lectura.referencia}</span>}
        </p>
      </header>

      <div className="flex max-w-[62ch] flex-col gap-aire-s">
        {lectura.parrafos.map((parrafo, i) => (
          <p
            key={`${lectura.id}-${i}`}
            className={
              i === 0
                ? // La capitular: dos líneas de alto, en oro, pegada al texto.
                  'm-0 font-serif text-body-l leading-[1.75] text-contenido first-letter:float-left first-letter:mr-[0.08em] first-letter:font-serif first-letter:text-[3.2em] first-letter:leading-[0.82] first-letter:text-acento'
                : 'm-0 font-serif text-body-l leading-[1.75] text-contenido'
            }
          >
            {parrafo}
          </p>
        ))}
      </div>

      {/* Cierre: la firma se repite al final, como en una columna impresa. */}
      <p className="m-0 max-w-[62ch] border-t border-linea pt-aire-s text-right font-mono text-body-s uppercase tracking-label text-texto-tenue">
        {lectura.autor}
      </p>

      {children}
    </article>
  )
}
