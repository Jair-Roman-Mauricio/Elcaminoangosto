import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

interface CueDeSubtitulo {
  inicio: number
  fin: number
  texto: string
}

const cacheDeSubtitulos = new Map<string, Promise<CueDeSubtitulo[]>>()

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

function cargarSrt(url: string) {
  const existente = cacheDeSubtitulos.get(url)
  if (existente) return existente

  const solicitud = fetch(url)
    .then((respuesta) => {
      if (!respuesta.ok) throw new Error(`No se pudo cargar el SRT (${respuesta.status})`)
      return respuesta.text()
    })
    .then(parsearSrt)

  cacheDeSubtitulos.set(url, solicitud)
  return solicitud
}

interface SongSubtitlesProps {
  src: string
  currentTime: number
}

export function SongSubtitles({ src, currentTime }: SongSubtitlesProps) {
  const [cues, setCues] = useState<CueDeSubtitulo[]>([])

  useEffect(() => {
    let vigente = true
    setCues([])
    void cargarSrt(src)
      .then((resultado) => {
        if (vigente) setCues(resultado)
      })
      .catch(() => {
        cacheDeSubtitulos.delete(src)
        if (vigente) setCues([])
      })
    return () => { vigente = false }
  }, [src])

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
