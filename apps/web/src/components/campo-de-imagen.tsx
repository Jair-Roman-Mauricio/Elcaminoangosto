import { useRef, useState } from 'react'
import { Boton } from '@elcamino/ui'
import { subirImagenPublica } from '../lib/image-upload'

export interface CampoDeImagenProps {
  /** URL ya subida, o `null` si todavía no hay imagen. */
  valor: string | null
  onCambiar: (url: string | null) => void
  disabled?: boolean
  /** Texto del botón cuando aún no hay imagen. */
  textoElegir?: string
  /** Proporción de la vista previa. Por defecto, cuadrada (portada). */
  proporcion?: string
}

/**
 * Sube una imagen desde el equipo a un bucket público y devuelve su URL
 * permanente, con vista previa. Reutiliza `subirImagenPublica`, el mismo camino
 * que las portadas de curso, en vez de pedir una URL escrita a mano.
 *
 * Vive en la app y no en `packages/ui` porque conoce Storage; el sistema de
 * diseño no sabe de Supabase.
 */
export function CampoDeImagen({
  valor,
  onCambiar,
  disabled = false,
  textoElegir = 'Elegir imagen',
  proporcion = 'aspect-square',
}: CampoDeImagenProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const elegir = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    setSubiendo(true)
    try {
      onCambiar(await subirImagenPublica(file))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo subir la imagen')
    } finally {
      setSubiendo(false)
    }
  }

  const ocupado = disabled || subiendo

  return (
    <div className="flex flex-col gap-aire-xs">
      <div className="flex items-center gap-aire-s">
        <div
          className={`${proporcion} w-24 shrink-0 overflow-hidden border border-linea bg-superficie-2`}
        >
          {valor ? (
            <img src={valor} alt="" className="size-full object-cover" />
          ) : (
            <span className="grid size-full place-items-center font-mono text-eyebrow uppercase tracking-label text-texto-debil">
              Sin imagen
            </span>
          )}
        </div>

        <div className="flex flex-col gap-aire-xs">
          {/* El input nativo va oculto y lo abre el botón del sistema de
              diseño: así el control se ve como el resto de la interfaz. */}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            disabled={ocupado}
            onChange={(e) => void elegir(e.target.files?.[0])}
            className="sr-only"
          />
          <Boton
            variante="contorno"
            tamano="compacto"
            disabled={ocupado}
            onClick={() => inputRef.current?.click()}
          >
            {subiendo ? 'Subiendo…' : valor ? 'Cambiar' : textoElegir}
          </Boton>

          {valor && !subiendo && (
            <Boton variante="pastilla" disabled={ocupado} onClick={() => onCambiar(null)}>
              Quitar
            </Boton>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="m-0 font-ui text-body-s text-peligro">
          {error}
        </p>
      )}
    </div>
  )
}
