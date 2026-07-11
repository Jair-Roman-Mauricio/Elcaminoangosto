import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Boton, Eyebrow } from '@elcamino/ui'
import { subirMedioReanudable, esperarProcesado } from './media-upload'
import { usePublicarTarjeta } from './feed-api'

type Fase = 'elegir' | 'subiendo' | 'procesando' | 'publicando' | 'error'

/**
 * Publicar una Tarjeta de Fe (HU-3.3, MAESTRO/ADMIN). Sube el video por TUS
 * (reanudable), espera la transcodificación y publica.
 */
export function PublicarTarjetaPage() {
  const navigate = useNavigate()
  const publicar = usePublicarTarjeta()
  const inputRef = useRef<HTMLInputElement>(null)

  const [fase, setFase] = useState<Fase>('elegir')
  const [pct, setPct] = useState(0)
  const [caption, setCaption] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)

  const publicarTarjeta = async () => {
    if (!file) return
    setError(null)
    try {
      const kind = file.type.startsWith('image/') ? 'IMAGE' : 'VIDEO'
      setFase('subiendo')
      const assetId = await subirMedioReanudable(file, kind, setPct)

      setFase('procesando')
      const estado = await esperarProcesado(assetId)
      if (estado.status === 'FAILED') throw new Error('No se pudo procesar el video')

      setFase('publicando')
      await publicar.mutateAsync({ mediaAssetId: assetId, caption: caption.trim() || null })
      navigate('/tarjetas')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado')
      setFase('error')
    }
  }

  const ocupado = fase === 'subiendo' || fase === 'procesando' || fase === 'publicando'

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-aire-m py-aire-m">
      <header className="flex flex-col gap-aire-xs">
        <Eyebrow>Tarjetas de Fe</Eyebrow>
        <h1 className="m-0 font-mono text-h-l font-normal text-contenido">Publicar una tarjeta</h1>
        <p className="m-0 font-mono text-body-s text-texto-tenue">
          Un video vertical corto para edificar a la comunidad.
        </p>
      </header>

      <div className="flex flex-col gap-aire-s rounded border border-linea bg-superficie-1 p-aire-m">
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/quicktime,image/jpeg,image/png"
          disabled={ocupado}
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null)
            setFase('elegir')
            setError(null)
          }}
          className="font-mono text-body-s text-texto-tenue file:mr-aire-s file:rounded file:border file:border-linea file:bg-superficie-2 file:px-aire-s file:py-1 file:font-mono file:text-eyebrow file:uppercase file:tracking-label file:text-contenido hover:file:border-vino"
        />

        {file && (
          <p className="m-0 font-mono text-body-s text-contenido">
            {file.name} · {(file.size / (1024 * 1024)).toFixed(1)} MB
          </p>
        )}

        <div className="flex flex-col gap-aire-xs">
          <label className="font-mono text-eyebrow uppercase tracking-label text-texto-tenue">
            Texto (opcional)
          </label>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={2}
            disabled={ocupado}
            maxLength={500}
            placeholder="Un versículo, una reflexión…"
            className="resize-none rounded border border-linea bg-superficie-2 px-aire-s py-aire-xs font-mono text-body text-contenido placeholder:text-texto-debil focus:border-contenido"
          />
        </div>

        {fase === 'subiendo' && <Progreso label={`Subiendo… ${pct}%`} pct={pct} />}
        {fase === 'procesando' && <Progreso label="Transcodificando el video…" pct={100} pulsa />}
        {fase === 'publicando' && <Progreso label="Publicando…" pct={100} pulsa />}

        {error && (
          <p role="alert" className="m-0 font-mono text-body-s text-vino">
            {error}
          </p>
        )}

        <Boton onClick={() => void publicarTarjeta()} disabled={!file || ocupado}>
          {ocupado ? 'Un momento…' : 'Publicar'}
        </Boton>
      </div>
    </div>
  )
}

function Progreso({ label, pct, pulsa = false }: { label: string; pct: number; pulsa?: boolean }) {
  return (
    <div className="flex flex-col gap-aire-xs">
      <p className="m-0 font-mono text-eyebrow uppercase tracking-label text-texto-tenue">{label}</p>
      <div className="h-1 w-full overflow-hidden rounded bg-linea">
        <div
          className={`h-full bg-vino transition-[width] duration-fade ease-camino ${pulsa ? 'animate-pulse' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
