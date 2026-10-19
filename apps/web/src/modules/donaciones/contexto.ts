import { useCallback, useState } from 'react'
import type { Metodo } from './datos'

export type Idioma = 'es' | 'en' | 'pt'

const IDIOMAS: readonly Idioma[] = ['es', 'en', 'pt']
const CLAVE_IDIOMA = 'eca.donacion.idioma'
const CLAVE_METODO = 'eca.donacion.metodo'

function leer(clave: string): string | null {
  try {
    return localStorage.getItem(clave)
  } catch {
    return null
  }
}

function guardar(clave: string, valor: string): void {
  try {
    localStorage.setItem(clave, valor)
  } catch {
    /* sin almacenamiento: la elección vale solo para esta visita */
  }
}

/** Idiomas preferidos del navegador, en su orden, sin la región (`es-PE` → `es`). */
function preferidos(): string[] {
  if (typeof navigator === 'undefined') return []
  const lista = navigator.languages?.length ? navigator.languages : [navigator.language]
  return lista.filter(Boolean).map((l) => l.toLowerCase())
}

/** Primer idioma del navegador que sabemos atender; si ninguno, inglés. */
export function detectarIdioma(): Idioma {
  for (const completo of preferidos()) {
    const base = completo.split('-')[0] as Idioma
    if (IDIOMAS.includes(base)) return base
  }
  return 'en'
}

/**
 * ¿Parece que quien visita está en Perú? Sin geolocalización ni servicios de
 * terceros: basta la región del idioma (`es-PE`) o la zona horaria de Lima.
 * Es una pista, no una certeza, por eso la página deja cambiar de medio.
 */
export function pareceDePeru(): boolean {
  if (preferidos().some((l) => l.endsWith('-pe'))) return true
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone === 'America/Lima'
  } catch {
    return false
  }
}

export function metodoSugerido(): Metodo {
  return pareceDePeru() ? 'yape' : 'cci'
}

export interface ContextoDeDonacion {
  idioma: Idioma
  metodo: Metodo
  /** `true` mientras el medio mostrado es el que sugiere la región, no uno elegido. */
  sugerido: boolean
  elegirIdioma: (idioma: Idioma) => void
  elegirMetodo: (metodo: Metodo) => void
}

/** Idioma y medio de la persona: lo elegido gana; si no hay nada, lo detectado. */
export function useContextoDeDonacion(): ContextoDeDonacion {
  const [idioma, setIdioma] = useState<Idioma>(() => {
    const guardado = leer(CLAVE_IDIOMA)
    return IDIOMAS.includes(guardado as Idioma) ? (guardado as Idioma) : detectarIdioma()
  })
  const [elegido, setElegido] = useState<Metodo | null>(() => {
    const guardado = leer(CLAVE_METODO)
    return guardado === 'yape' || guardado === 'cci' ? guardado : null
  })

  const elegirIdioma = useCallback((nuevo: Idioma) => {
    setIdioma(nuevo)
    guardar(CLAVE_IDIOMA, nuevo)
  }, [])

  const elegirMetodo = useCallback((nuevo: Metodo) => {
    setElegido(nuevo)
    guardar(CLAVE_METODO, nuevo)
  }, [])

  return {
    idioma,
    metodo: elegido ?? metodoSugerido(),
    sugerido: elegido === null,
    elegirIdioma,
    elegirMetodo,
  }
}
