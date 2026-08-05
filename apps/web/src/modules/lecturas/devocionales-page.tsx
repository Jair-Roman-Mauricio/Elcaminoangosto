import { useState } from 'react'
import { Eyebrow } from '@elcamino/ui'
import { useDevocionales, type Lectura } from './lecturas-api'
import { LectorEditorial } from './lector-editorial'
import { useRegistrarVisita } from '../../lib/analitica'

/**
 * Devocionales: una lectura breve con su portada.
 *
 * Se listan como tarjetas y se abren enteros. No hay conversación debajo: un
 * devocional se lee y se guarda, no se discute. Para lo otro está la revista.
 */
export function DevocionalesPage() {
  useRegistrarVisita('devocionales')
  const { data, isPending, isError } = useDevocionales()
  const [abierto, setAbierto] = useState<Lectura | null>(null)

  if (abierto) return <LectorEditorial lectura={abierto} onVolver={() => setAbierto(null)} />

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-aire-m">
      <header className="flex flex-col gap-aire-xs">
        <Eyebrow>Devocionales</Eyebrow>
        <h1 className="m-0 font-ui text-h-l font-medium tracking-titulo text-contenido">
          Una lectura para hoy
        </h1>
        <p className="m-0 max-w-prose font-ui text-body text-texto-tenue">
          Historias cortas para leer de una sentada, cuando no hay fuerzas para más.
        </p>
      </header>

      {isError && (
        <p className="m-0 font-ui text-body text-peligro">No se pudieron cargar los devocionales.</p>
      )}
      {isPending && <p className="m-0 font-ui text-body text-texto-tenue">Cargando…</p>}
      {!isPending && !isError && data?.length === 0 && (
        <p className="m-0 font-ui text-body text-texto-tenue">Todavía no hay devocionales.</p>
      )}

      <ul className="m-0 grid list-none grid-cols-1 gap-aire-m p-0 sm:grid-cols-2 lg:grid-cols-3">
        {(data ?? []).map((lectura) => (
          <li key={lectura.id}>
            <TarjetaDeLectura lectura={lectura} onAbrir={() => setAbierto(lectura)} />
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * Tarjeta de portada.
 *
 * La imagen manda y el texto se apoya sobre ella: es lo que hace que un
 * listado se lea como un quiosco y no como una tabla. El degradado existe para
 * que el título se lea sobre cualquier foto, clara u oscura.
 */
export function TarjetaDeLectura({
  lectura,
  onAbrir,
  destacada = false,
}: {
  lectura: Lectura
  onAbrir: () => void
  /** La pieza principal de la portada: ocupa más y respira distinto. */
  destacada?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onAbrir}
      className={`group relative flex w-full flex-col overflow-hidden border border-linea bg-superficie-1 text-left transition-colors duration-fade ease-camino hover:border-acento ${
        destacada ? 'min-h-[26rem]' : 'min-h-[18rem]'
      }`}
    >
      {lectura.portadaUrl ? (
        <img
          src={lectura.portadaUrl}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1200ms] ease-camino group-hover:scale-[1.04]"
        />
      ) : (
        <span aria-hidden className="absolute inset-0 bg-superficie-2" />
      )}

      <span
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-negro via-negro/75 to-negro/20"
      />

      <span className="relative mt-auto flex flex-col gap-aire-xs p-aire-m">
        <span className="font-mono text-body-s uppercase tracking-label text-acento">
          {/* La sección manda cuando la hay; si no, al menos que diga la
              verdad de qué es: un artículo no es un devocional. */}
          {lectura.seccion ?? (lectura.tipo === 'ARTICULO' ? 'Artículo' : 'Devocional')} ·{' '}
          {lectura.minutos} min
        </span>
        <span
          className={`block font-serif font-light leading-[1.1] text-hueso ${
            destacada ? 'text-[clamp(1.8rem,3.4vw,3rem)]' : 'text-h-m'
          }`}
        >
          {lectura.titulo}
        </span>
        {lectura.entradilla && (
          <span className="line-clamp-2 font-ui text-body-s leading-snug text-hueso/70">
            {lectura.entradilla}
          </span>
        )}
        <span className="font-mono text-body-s uppercase tracking-label text-hueso/60">
          {lectura.autor}
        </span>
      </span>
    </button>
  )
}
