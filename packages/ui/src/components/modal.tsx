import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '../lib/cn'
import { useReducedMotion } from '../lib/use-reduced-motion'

export interface ModalProps {
  abierto: boolean
  onCerrar: () => void
  titulo: string
  /** Texto de apoyo bajo el título. */
  descripcion?: string
  children: ReactNode
  className?: string
}

/**
 * Diálogo modal. Se monta en un portal para que ningún `overflow` o `z-index`
 * de la página lo recorte, y cumple lo mínimo accesible: `role="dialog"`,
 * cierre con Escape y con clic fuera, foco llevado dentro al abrir y devuelto
 * al elemento que lo abrió al cerrar.
 */
export function Modal({
  abierto,
  onCerrar,
  titulo,
  descripcion,
  children,
  className,
}: ModalProps) {
  const idTitulo = useId()
  const idDesc = useId()
  const panel = useRef<HTMLDivElement>(null)
  const origen = useRef<HTMLElement | null>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (!abierto) return

    origen.current = document.activeElement as HTMLElement | null

    // El fondo no debe poder desplazarse mientras el diálogo está abierto.
    const overflowPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar()
    }
    document.addEventListener('keydown', alPulsar)

    // Foco al primer control del contenido, no al aspa de cerrar: quien abre un
    // diálogo quiere escribir, no cerrarlo. Si no hay ninguno, al propio panel.
    const enfocable = panel.current?.querySelector<HTMLElement>(
      ':is(input, select, textarea, button, [href], [tabindex]:not([tabindex="-1"])):not([data-modal-cerrar])',
    )
    ;(enfocable ?? panel.current)?.focus()

    return () => {
      document.removeEventListener('keydown', alPulsar)
      document.body.style.overflow = overflowPrevio
      origen.current?.focus()
    }
  }, [abierto, onCerrar])

  const duracion = reduced ? 0.01 : 0.25

  return createPortal(
    <AnimatePresence>
      {abierto && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-aire-s">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: duracion }}
            onClick={onCerrar}
            aria-hidden="true"
            className="absolute inset-0 bg-negro/60 backdrop-blur-sm"
          />

          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={idTitulo}
            aria-describedby={descripcion ? idDesc : undefined}
            tabIndex={-1}
            initial={{ opacity: 0, y: reduced ? 0 : 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduced ? 0 : 8 }}
            transition={{ duration: duracion, ease: [0.22, 0.61, 0.36, 1] }}
            className={cn(
              'relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col overflow-y-auto',
              'rounded border border-linea bg-superficie-1 p-aire-m shadow-2xl',
              className,
            )}
          >
            <div className="mb-aire-s flex items-start justify-between gap-aire-s">
              <div className="flex flex-col gap-aire-xs">
                <h2
                  id={idTitulo}
                  className="m-0 font-mono text-h-m font-normal text-contenido"
                >
                  {titulo}
                </h2>
                {descripcion && (
                  <p id={idDesc} className="m-0 font-mono text-body-s text-texto-tenue">
                    {descripcion}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={onCerrar}
                aria-label="Cerrar"
                data-modal-cerrar
                className={cn(
                  'shrink-0 rounded border border-linea p-2 text-texto-tenue',
                  'transition-colors duration-fade ease-camino hover:border-vino hover:text-contenido',
                )}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.4" />
                </svg>
              </button>
            </div>

            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
