import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

export type Tema = 'light' | 'dark'

/* Clave nueva: la anterior guardaba `light` en cuanto se montaba el proveedor,
   así que todo el que ya había entrado tenía el tema claro fijado y nunca
   habría visto el oscuro por defecto. Con otra clave, la preferencia vuelve a
   escribirse solo a partir de ahora. */
const CLAVE = 'ec-tema-2'

interface ContextoTema {
  tema: Tema
  alternar: () => void
}

const TemaContext = createContext<ContextoTema>({ tema: 'dark', alternar: () => undefined })

/** Aplica el tema al <html> para que las CSS vars de tokens.css cambien. */
function aplicar(tema: Tema): void {
  document.documentElement.dataset.theme = tema
}

/** Tema inicial: lo guardado, u OSCURO por defecto. El negro con oro es la
 *  identidad de la marca; el claro queda como alternativa del interruptor. */
function temaInicial(): Tema {
  if (typeof window === 'undefined') return 'dark'
  const guardado = window.localStorage.getItem(CLAVE)
  return guardado === 'light' ? 'light' : 'dark'
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
