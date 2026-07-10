import { PlayPause, ProgressBar, formatTime, Eyebrow } from '@elcamino/ui'
import { usePlayerStore } from '../../stores/player.store'

/**
 * Barra inferior persistente (HU-2.1). Se monta una sola vez, fuera del
 * <Outlet />, para que la reproducción sobreviva a la navegación.
 *
 * Nota (S5): el elemento <audio> real y su sincronización con el store se
 * implementan en HU-2.1. Aquí está la superficie visual.
 */
export function PlayerBar() {
  const { pista, reproduciendo, progreso, alternar, siguiente, anterior, buscar } =
    usePlayerStore()

  if (!pista) return null

  return (
    <div
      role="region"
      aria-label="Reproductor de música"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-linea bg-superficie-1"
    >
      <div className="mx-auto flex max-w-screen-xl items-center gap-aire-m px-gutter py-aire-s">
        <div className="flex min-w-0 flex-1 items-center gap-aire-s">
          <div className="size-12 shrink-0 overflow-hidden rounded bg-superficie-2">
            {pista.coverUrl && (
              <img src={pista.coverUrl} alt="" className="size-full object-cover" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate font-mono text-body-s text-hueso">{pista.titulo}</p>
            <Eyebrow rule={false}>{pista.artista}</Eyebrow>
          </div>
        </div>

        <div className="flex items-center gap-aire-s">
          <button
            type="button"
            onClick={anterior}
            aria-label="Anterior"
            className="font-mono text-label text-texto-tenue transition-colors duration-fade ease-camino hover:text-hueso"
          >
            ◄◄
          </button>
          <PlayPause reproduciendo={reproduciendo} onToggle={alternar} size={40} />
          <button
            type="button"
            onClick={siguiente}
            aria-label="Siguiente"
            className="font-mono text-label text-texto-tenue transition-colors duration-fade ease-camino hover:text-hueso"
          >
            ►►
          </button>
        </div>

        <div className="hidden flex-1 items-center gap-aire-s cine:flex">
          <span className="font-mono text-eyebrow tabular-nums text-texto-tenue">
            {formatTime(progreso)}
          </span>
          <ProgressBar value={progreso} max={pista.durationSeconds} onSeek={buscar} />
          <span className="font-mono text-eyebrow tabular-nums text-texto-tenue">
            {formatTime(pista.durationSeconds)}
          </span>
        </div>
      </div>
    </div>
  )
}
