import { useState } from 'react'
import { Eyebrow } from '@elcamino/ui'
import { useDevocionales, type Lectura } from './lecturas-api'
import { TarjetaDeLectura } from './tarjeta-de-lectura'
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

  const abrirOtra = (id: string) => {
    const otra = (data ?? []).find((l) => l.id === id)
    if (otra) setAbierto(otra)
  }

  if (abierto) {
    return (
      <LectorEditorial
        lectura={abierto}
        onVolver={() => setAbierto(null)}
        onAbrirOtra={abrirOtra}
      />
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

      <ul className="m-0 grid list-none grid-cols-1 gap-aire-m p-0 sm:grid-cols-2 md:grid-cols-3">
        {(data ?? []).map((lectura) => (
          <li key={lectura.id}>
            <TarjetaDeLectura lectura={lectura} onAbrir={() => setAbierto(lectura)} />
          </li>
        ))}
      </ul>
    </section>
  )
}
