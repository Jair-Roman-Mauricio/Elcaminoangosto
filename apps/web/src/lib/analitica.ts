import { useEffect } from 'react'
import { apiClient } from './api-client'

/*
 * Analítica de uso. La unidad de medida es un identificador ALEATORIO por
 * sesión de navegador: se guarda en `sessionStorage`, así que muere al cerrar
 * la pestaña y no persigue a nadie entre visitas. Nunca se envía IP ni huella
 * (RNF-9). Solo sirve para no contar diez veces a quien vuelve diez veces.
 */

const CLAVE_SESION = 'eca:sesion-analitica'

function idDeSesion(): string {
  if (typeof window === 'undefined') return ''
  const guardado = window.sessionStorage.getItem(CLAVE_SESION)
  if (guardado) return guardado

  const nuevo = crypto.randomUUID().replaceAll('-', '')
  window.sessionStorage.setItem(CLAVE_SESION, nuevo)
  return nuevo
}

/**
 * Medir no puede estropear la experiencia: si la petición falla —sin red, o
 * con un bloqueador de por medio— se ignora en silencio.
 */
async function enviar(ruta: string, cuerpo: Record<string, unknown>): Promise<void> {
  const sessionId = idDeSesion()
  if (!sessionId) return
  try {
    await apiClient.post(ruta, { ...cuerpo, sessionId })
  } catch {
    /* la analítica nunca interrumpe */
  }
}

export type TipoDeContenido = 'VIDEO' | 'POST' | 'SONG'

/** Registra que alguien vio una pieza de contenido. */
export function registrarVista(kind: TipoDeContenido, contentId: string): void {
  void enviar('/analytics/views', { kind, contentId })
}

/** Registra la entrada a una sección. */
export function registrarVisita(section: string): void {
  void enviar('/analytics/visits', { section })
}

/**
 * Anota la vista de un contenido mientras esté a la vista. Se dispara una vez
 * por identificador: cambiar de canción o de video vuelve a contar, repintar
 * no.
 */
export function useRegistrarVista(kind: TipoDeContenido, contentId: string | null | undefined) {
  useEffect(() => {
    if (!contentId) return
    registrarVista(kind, contentId)
  }, [kind, contentId])
}

/** Anota la entrada a una sección al montarla. */
export function useRegistrarVisita(section: string) {
  useEffect(() => {
    registrarVisita(section)
  }, [section])
}
