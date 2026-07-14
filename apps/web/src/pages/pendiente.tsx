import { Eyebrow, Reveal } from '@elcamino/ui'

interface PendienteProps {
  titulo: string
  /** Historia del backlog que la implementará, p. ej. "HU-4.1 · Sprint S1". */
  historia: string
}

/**
 * Marcador de página aún no implementada. Existe para que el andamiaje de
 * rutas sea navegable de punta a punta y para dejar visible qué historia la
 * cubre (AGENTS.md §8: nada de TODOs silenciosos).
 */
export function Pendiente({ titulo, historia }: PendienteProps) {
  return (
    <Reveal className="mx-auto flex max-w-2xl flex-col gap-aire-s py-aire-l">
      <Eyebrow>{historia}</Eyebrow>
      <h1 className="m-0 font-mono text-h-l font-normal text-contenido">{titulo}</h1>
      <p className="m-0 font-mono text-body text-texto-tenue">
        Esta pantalla se construye en el sprint indicado. Ver <code>docs/BACKLOG.md</code>.
      </p>
    </Reveal>
  )
}
