import type { Lectura } from './lecturas-api'

/** Cuánto pesa una pieza en la portada. Manda el tamaño del titular. */
export type TamanoDeTarjeta = 'grande' | 'media' | 'pequena'

const TITULAR: Record<TamanoDeTarjeta, string> = {
  grande: 'text-[clamp(1.6rem,2.6vw,2.4rem)] leading-[1.15]',
  media: 'text-[clamp(1.1rem,1.6vw,1.45rem)] leading-[1.2]',
  pequena: 'text-[0.98rem] leading-[1.25]',
}

const ALTO: Record<TamanoDeTarjeta, string> = {
  grande: 'min-h-[26rem] sm:min-h-[32rem]',
  media: 'min-h-[15rem]',
  pequena: 'min-h-[11rem]',
}

/**
 * Una pieza de portada: la foto a sangre y el texto encima.
 *
 * Las tres medidas comparten forma y solo cambian de peso, que es lo que hace
 * que un mosaico se lea como una portada —alguien decidió qué es lo importante
 * de este número— y no como un archivo donde todo pesa igual.
 */
export function TarjetaDeLectura({
  lectura,
  onAbrir,
  tamano = 'media',
  conEtiqueta = true,
}: {
  lectura: Lectura
  onAbrir: () => void
  tamano?: TamanoDeTarjeta
  /** La sección, sobre la foto. Sobra cuando ya la dice el encabezado. */
  conEtiqueta?: boolean
}) {
  const etiqueta = lectura.seccion ?? (lectura.tipo === 'ARTICULO' ? 'Artículo' : 'Devocional')

  return (
    <button
      type="button"
      onClick={onAbrir}
      className={`group relative flex h-full w-full flex-col overflow-hidden bg-superficie-2 text-left ${ALTO[tamano]}`}
    >
      {lectura.portadaUrl ? (
        <img
          src={lectura.portadaUrl}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1200ms] ease-camino group-hover:scale-[1.05]"
        />
      ) : (
        // Sin foto la pieza no puede quedarse en un hueco gris: en una portada
        // todo tiene que pesar algo, así que se cubre con el oro de la marca.
        <span
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(110%_110%_at_25%_10%,rgba(138,98,18,0.55)_0%,var(--negro)_65%)]"
        />
      )}

      {/* El velo sube desde abajo: la foto se ve arriba y el titular se lee
          siempre, dé lo que dé la imagen. */}
      <span
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-negro via-negro/80 to-negro/10 transition-opacity duration-fade ease-camino group-hover:opacity-90"
      />

      <span
        className={`relative mt-auto flex flex-col items-start gap-[0.55rem] ${
          tamano === 'pequena' ? 'p-aire-s' : 'p-aire-m'
        }`}
      >
        {conEtiqueta && (
          <span className="bg-oro px-[0.45rem] py-[0.15rem] font-mono text-[0.62rem] uppercase tracking-label text-sobreoro">
            {etiqueta}
          </span>
        )}

        <span
          className={`block font-serif font-light text-hueso transition-colors duration-fade group-hover:text-oro-claro ${TITULAR[tamano]}`}
        >
          {lectura.titulo}
        </span>

        {tamano !== 'pequena' && lectura.entradilla && (
          <span className="line-clamp-2 font-ui text-body-s leading-snug text-hueso/70">
            {lectura.entradilla}
          </span>
        )}

        <span className="font-mono text-[0.62rem] uppercase tracking-label text-hueso/55">
          {lectura.autor} · {lectura.minutos} min
        </span>
      </span>
    </button>
  )
}
