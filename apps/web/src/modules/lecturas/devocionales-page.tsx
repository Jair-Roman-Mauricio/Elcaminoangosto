import { useState } from 'react'
import { Eyebrow } from '@elcamino/ui'
import { useDevocionales, type Lectura } from './lecturas-api'
import { TarjetaDeDevocional } from './tarjeta-de-devocional'
import { LectorDeDevocional } from './lector-de-devocional'
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

  if (abierto) {
    return (
      <LectorDeDevocional lectura={abierto} onVolver={() => setAbierto(null)} />
    )
  }

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

      {/* Uno debajo de otro y a todo lo ancho: un devocional es una lectura,
          no una pieza de escaparate, y así cada uno cuenta de qué va antes de
          que haya que abrirlo. */}
      <ul className="m-0 flex list-none flex-col divide-y divide-linea p-0">
        {(data ?? []).map((lectura) => (
          <li key={lectura.id}>
            <TarjetaDeDevocional lectura={lectura} onAbrir={() => setAbierto(lectura)} />
          </li>
        ))}
      </ul>
    </section>
  )
}
