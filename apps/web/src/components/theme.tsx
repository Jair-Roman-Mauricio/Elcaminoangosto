import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import './theme-toggle.css'

export type Tema = 'light' | 'dark'

const CLAVE = 'ec-tema'

interface ContextoTema {
  tema: Tema
  alternar: () => void
}

const TemaContext = createContext<ContextoTema>({ tema: 'light', alternar: () => undefined })

/** Aplica el tema al <html> para que las CSS vars de tokens.css cambien. */
function aplicar(tema: Tema): void {
  document.documentElement.dataset.theme = tema
}

/** Tema inicial: lo guardado, o CLARO por defecto (ADR-007). */
function temaInicial(): Tema {
  if (typeof window === 'undefined') return 'light'
  const guardado = window.localStorage.getItem(CLAVE)
  return guardado === 'dark' ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(temaInicial)

  useEffect(() => {
    aplicar(tema)
    window.localStorage.setItem(CLAVE, tema)
  }, [tema])

  const alternar = useCallback(() => setTema((t) => (t === 'light' ? 'dark' : 'light')), [])

  return <TemaContext.Provider value={{ tema, alternar }}>{children}</TemaContext.Provider>
}

export function useTema(): ContextoTema {
  return useContext(TemaContext)
}

/**
 * Botón de cambio de tema para el nav. Sol → tema claro activo; luna → oscuro.
 * El icono muestra el tema al que se cambiaría.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { tema, alternar } = useTema()
  const aOscuro = tema === 'light'
  const [animando, setAnimando] = useState(false)

  const cambiarTema = () => {
    setAnimando(true)
    window.setTimeout(() => setAnimando(false), 950)
    const doc = document as Document & {
      startViewTransition?: (update: () => void) => { finished: Promise<void> }
    }
    if (!doc.startViewTransition) {
      alternar()
      return
    }

    document.documentElement.dataset.themeTransition = 'active'
    const transition = doc.startViewTransition(alternar)
    void transition.finished.finally(() => {
      delete document.documentElement.dataset.themeTransition
    })
  }

  return (
    <button
      type="button"
      onClick={cambiarTema}
      aria-label={aOscuro ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro'}
      title={aOscuro ? 'Tema oscuro' : 'Tema claro'}
      aria-pressed={!aOscuro}
      data-theme-toggle
      data-theme={tema}
      data-animating={animando ? 'true' : 'false'}
      className={className}
    >
      <span className="theme-toggle__stage" aria-hidden="true">
        <span className="theme-toggle__orb" />
        <span className="theme-toggle__stars" />
        <span className="theme-toggle__frames">
          <img
            className="theme-toggle__frame-light"
            src="/brand/theme/jesus-light-280.webp"
            width="280"
            height="140"
            alt=""
            decoding="async"
          />
          <img
            className="theme-toggle__frame-dark"
            src="/brand/theme/jesus-dark-280.webp"
            width="280"
            height="140"
            alt=""
            decoding="async"
          />
        </span>
      </span>
    </button>
  )
}
