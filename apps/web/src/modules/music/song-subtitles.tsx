import { useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

interface CueDeSubtitulo {
  inicio: number
  fin: number
  texto: string
}

function tiempoEnSegundos(valor: string) {
  const partes = valor.trim().replace('.', ',').split(/[:,]/).map(Number)
  if (partes.length !== 4 || partes.some(Number.isNaN)) return Number.NaN
  const [horas, minutos, segundos, milisegundos] = partes
  return (horas ?? 0) * 3600 + (minutos ?? 0) * 60 + (segundos ?? 0) + (milisegundos ?? 0) / 1000
}

export function parsearSrt(contenido: string): CueDeSubtitulo[] {
  return contenido
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .trim()
    .split(/\n{2,}/)
    .flatMap((bloque) => {
      const lineas = bloque.split('\n')
      const indiceTiempo = lineas.findIndex((linea) => linea.includes('-->'))
      if (indiceTiempo < 0) return []

      const [inicioCrudo, finCrudo] = lineas[indiceTiempo]!.split('-->')
      if (!inicioCrudo || !finCrudo) return []
      const inicio = tiempoEnSegundos(inicioCrudo)
      const fin = tiempoEnSegundos(finCrudo)
      const texto = lineas.slice(indiceTiempo + 1).join('\n').trim()
      if (!Number.isFinite(inicio) || !Number.isFinite(fin) || !texto) return []
      return [{ inicio, fin, texto }]
    })
}

interface SongSubtitlesProps {
  /**
   * Contenido del `.srt`, no su URL: el admin sube el archivo y su texto viaja
   * con la canción, así que no hay una segunda petición que pueda fallar.
   */
  contenido: string
  currentTime: number
}

export function SongSubtitles({ contenido, currentTime }: SongSubtitlesProps) {
  const cues = useMemo<CueDeSubtitulo[]>(() => parsearSrt(contenido), [contenido])

  const activo = useMemo(
    () => cues.find((cue) => currentTime >= cue.inicio && currentTime < cue.fin),
    [cues, currentTime],
  )

  return (
    <div className="praise-subtitles" aria-live="polite" aria-atomic="true">
      <AnimatePresence mode="wait">
        {activo && (
          <motion.p
            key={`${activo.inicio}-${activo.texto}`}
            initial={{ opacity: 0, y: 10, filter: 'blur(5px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
            transition={{ duration: 0.48, ease: [0.22, 0.61, 0.36, 1] }}
          >
            {activo.texto}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
