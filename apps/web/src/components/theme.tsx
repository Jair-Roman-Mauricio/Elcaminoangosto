import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

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

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={aOscuro ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro'}
      title={aOscuro ? 'Tema oscuro' : 'Tema claro'}
      className={[
        'grid size-9 place-items-center rounded-full border border-linea',
        'text-texto-tenue transition-colors duration-fade ease-camino',
        'hover:border-vino hover:text-contenido',
        className ?? '',
      ].join(' ')}
    >
      {aOscuro ? <IconoLuna /> : <IconoSol />}
    </button>
  )
}

function IconoSol() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" strokeLinecap="round" />
    </svg>
  )
}

function IconoLuna() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" strokeLinejoin="round" />
    </svg>
  )
}
