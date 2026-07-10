import { supabase } from './supabase'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api'

export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

interface RespuestaDeError {
  message?: string
}

/**
 * Cliente HTTP del API. Adjunta el JWT de Supabase como `Bearer` en cada
 * llamada; el API lo verifica contra el JWKS asimétrico.
 *
 * Se lee la sesión en cada petición (no se cachea el token) porque el SDK
 * puede haberlo refrescado entre llamadas.
 */
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`)
  }

  const response = await fetch(`${BASE_URL}${path}`, { ...init, headers })

  if (!response.ok) {
    let mensaje = `Error ${response.status}`
    try {
      const cuerpo = (await response.json()) as RespuestaDeError
      if (cuerpo.message) mensaje = cuerpo.message
    } catch {
      // El cuerpo no era JSON; nos quedamos con el mensaje genérico.
    }
    throw new ApiError(response.status, mensaje)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
