import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from '@phosphor-icons/react'
import { cn } from '@elcamino/ui/static'

interface Props {
  /** Lo que va al portapapeles. */
  valor: string
  etiqueta: string
  etiquetaCopiado: string
  className?: string
}

/** Copia sin depender de la API moderna: en HTTP o en WebViews viejos no existe. */
async function copiarAlPortapapeles(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    const campo = document.createElement('textarea')
    campo.value = texto
    campo.setAttribute('readonly', '')
    campo.style.position = 'fixed'
    campo.style.opacity = '0'
    document.body.appendChild(campo)
    campo.select()
    const ok = document.execCommand('copy')
    campo.remove()
    return ok
  }
}

/**
 * Botón de copiar. Confirma con el icono y con un texto para lectores de
 * pantalla; vuelve solo a su estado. Pulsarlo dos veces seguidas no apila
 * temporizadores: el último manda.
 */
export function CopiarBoton({ valor, etiqueta, etiquetaCopiado, className }: Props) {
  const [copiado, setCopiado] = useState(false)
  const temporizador = useRef<number>(0)

  useEffect(() => () => window.clearTimeout(temporizador.current), [])

  const copiar = async () => {
    if (!(await copiarAlPortapapeles(valor))) return
    setCopiado(true)
    window.clearTimeout(temporizador.current)
    temporizador.current = window.setTimeout(() => setCopiado(false), 1800)
  }

  return (
    <button
      type="button"
      onClick={() => void copiar()}
      className={cn(
        'inline-flex shrink-0 items-center gap-2 rounded-full border px-[0.95rem] py-[0.45rem]',
        'font-ui text-body-s transition-[color,border-color,background-color,transform] duration-fade-corto ease-camino',
        'active:scale-[0.97] motion-reduce:active:scale-100',
        copiado
          ? 'border-acento bg-oro/10 text-acento'
          : 'border-linea-fuerte text-contenido hover:border-acento hover:text-acento',
        className,
      )}
    >
      {copiado ? <Check size={16} weight="bold" aria-hidden /> : <Copy size={16} aria-hidden />}
      <span>{copiado ? etiquetaCopiado : etiqueta}</span>
      <span role="status" aria-live="polite" className="sr-only">
        {copiado ? etiquetaCopiado : ''}
      </span>
    </button>
  )
}
