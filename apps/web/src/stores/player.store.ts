import { create } from 'zustand'

export interface PistaEnReproduccion {
  songId: string
  titulo: string
  artista: string
  /** URL firmada del audio; caduca (~60 min). Se renueva al reanudar. */
  audioUrl: string
  coverUrl: string | null
  durationSeconds: number
}

interface EstadoDelReproductor {
  pista: PistaEnReproduccion | null
  cola: PistaEnReproduccion[]
  reproduciendo: boolean
  /** Segundos transcurridos. */
  progreso: number
  volumen: number

  reproducir: (pista: PistaEnReproduccion, cola?: PistaEnReproduccion[]) => void
  alternar: () => void
  siguiente: () => void
  anterior: () => void
  buscar: (segundos: number) => void
  ajustarVolumen: (v: number) => void
  detener: () => void
}

/**
 * Estado del reproductor global (HU-2.1). Vive fuera del árbol de rutas para
 * que la reproducción **no se interrumpa** al navegar.
 *
 * Solo estado de CLIENTE. El catálogo (canciones, álbumes) es estado de
 * servidor y vive en TanStack Query — no se duplica aquí (AGENTS.md §4).
 */
export const usePlayerStore = create<EstadoDelReproductor>((set, get) => ({
  pista: null,
  cola: [],
  reproduciendo: false,
  progreso: 0,
  volumen: 0.8,

  reproducir: (pista, cola = []) => set({ pista, cola, reproduciendo: true, progreso: 0 }),

  alternar: () => set((s) => ({ reproduciendo: !s.reproduciendo })),

  siguiente: () => {
    const { pista, cola } = get()
    if (!pista) return
    const i = cola.findIndex((p) => p.songId === pista.songId)
    const proxima = cola[i + 1]
    if (proxima) set({ pista: proxima, progreso: 0, reproduciendo: true })
    else set({ reproduciendo: false })
  },

  anterior: () => {
    const { pista, cola, progreso } = get()
    if (!pista) return
    // Convención de reproductores: si ya sonaron >3 s, reinicia la pista.
    if (progreso > 3) {
      set({ progreso: 0 })
      return
    }
    const i = cola.findIndex((p) => p.songId === pista.songId)
    const previa = cola[i - 1]
    if (previa) set({ pista: previa, progreso: 0, reproduciendo: true })
    else set({ progreso: 0 })
  },

  buscar: (segundos) => set({ progreso: Math.max(0, segundos) }),

  ajustarVolumen: (v) => set({ volumen: Math.min(1, Math.max(0, v)) }),

  detener: () => set({ pista: null, cola: [], reproduciendo: false, progreso: 0 }),
}))
