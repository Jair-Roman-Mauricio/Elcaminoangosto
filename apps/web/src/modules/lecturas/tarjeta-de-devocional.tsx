import type { Lectura } from './lecturas-api'

/**
 * Tarjeta de un devocional: el texto a un lado y la imagen al otro.
 *
 * Es lo contrario de la pieza de revista, donde el titular va encima de la
 * foto. La diferencia es a propósito: dos secciones que se listan igual acaban
 * pareciendo la misma, y un devocional no promete lo mismo que un artículo.
 *
 * La imagen no lleva marco: se funde con el fondo por su borde interior, de
 * modo que la tarjeta no parece una caja pegada sobre la página sino parte de
 * ella.
 */
export function TarjetaDeDevocional({
  lectura,
  onAbrir,
}: {
  lectura: Lectura
  onAbrir: () => void
}) {
  return (
    <article className="group relative grid items-center gap-aire-m overflow-hidden rounded-[0.35rem] border border-linea transition-colors duration-fade ease-camino hover:border-oro-hondo md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] md:gap-0">
      <div className="flex flex-col items-start gap-aire-s p-aire-m md:pr-aire-l">
        <p className="m-0 border border-oro-hondo px-[0.55rem] py-[0.2rem] font-mono text-[0.62rem] uppercase tracking-label text-acento">
          {lectura.seccion ?? 'Devocional'} · {lectura.minutos} min
        </p>

        <h2 className="m-0 font-ui text-[clamp(1.9rem,4vw,3.2rem)] font-bold uppercase leading-[0.92] tracking-[-0.02em] text-contenido">
          {lectura.titulo}
        </h2>

        {lectura.entradilla && (
          <p className="m-0 max-w-[46ch] font-ui text-body leading-relaxed text-texto-tenue">
            {lectura.entradilla}
          </p>
        )}

        <div className="mt-aire-xs flex flex-wrap items-center gap-aire-s">
          <button
            type="button"
            onClick={onAbrir}
            className="rounded-full border border-acento bg-oro brillo-oro px-[1.6rem] py-[0.7rem] font-mono text-body-s uppercase tracking-boton text-sobreoro"
          >
            Leer
          </button>
          <span className="font-mono text-body-s uppercase tracking-label text-texto-debil">
            {lectura.autor}
          </span>
        </div>
      </div>

      {lectura.portadaUrl ? (
        <div className="relative h-[14rem] overflow-hidden md:h-[22rem]">
          <img
            src={lectura.portadaUrl}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1200ms] ease-camino group-hover:scale-[1.04]"
          />
          {/* La foto se apaga hacia el texto: de lado en pantalla ancha y hacia
              arriba cuando la tarjeta se apila, que es donde está el titular. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-transparent from-45% to-fondo md:bg-gradient-to-l md:from-55%"
          />
        </div>
      ) : (
        <div aria-hidden className="hidden md:block" />
      )}
    </article>
  )
}
