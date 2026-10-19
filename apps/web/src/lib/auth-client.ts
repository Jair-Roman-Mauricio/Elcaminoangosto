/**
 * Sesión del navegador contra el API propio (`/auth/*`).
 *
 * El token de acceso dura poco y se renueva con el de refresco, que el API
 * rota en cada uso. Ambos viven en `localStorage`; si el almacenamiento no está
 * disponible (ventana privada), la sesión dura lo que dure la pestaña.
 */
const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api'
const CLAVE = 'eca.sesion'
/** Se renueva con este margen de sobra, para no mandar un token a punto de morir. */
const MARGEN_MS = 30_000

export interface Session {
  accessToken: string
  refreshToken: string
  /** Epoch en ms en que vence `accessToken`. */
  expiresAt: number
  user: { id: string; email: string }
}

export interface FalloDeAuth {
  status: number
  message: string
}

interface RespuestaDeSesion {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: { id: string; email: string }
}

type Oyente = (session: Session | null) => void

let actual: Session | null = leer()
let renovando: Promise<Session | null> | null = null
const oyentes = new Set<Oyente>()

function leer(): Session | null {
  try {
    const crudo = localStorage.getItem(CLAVE)
    return crudo ? (JSON.parse(crudo) as Session) : null
  } catch {
    return null
  }
}

function guardar(session: Session | null): void {
  actual = session
  try {
    if (session) localStorage.setItem(CLAVE, JSON.stringify(session))
    else localStorage.removeItem(CLAVE)
  } catch {
    /* sin almacenamiento: la sesión vive en memoria */
  }
  oyentes.forEach((cb) => cb(session))
}

async function post<T>(ruta: string, cuerpo: unknown): Promise<{ data: T | null; error: FalloDeAuth | null }> {
  try {
    const r = await fetch(`${BASE_URL}${ruta}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(15_000),
    })
    const json = (await r.json().catch(() => ({}))) as { message?: string } & T
    if (!r.ok) return { data: null, error: { status: r.status, message: json.message ?? r.statusText } }
    return { data: json, error: null }
  } catch {
    return { data: null, error: { status: 0, message: 'Sin conexión con el servidor' } }
  }
}

function desdeRespuesta(r: RespuestaDeSesion): Session {
  return {
    accessToken: r.accessToken,
    refreshToken: r.refreshToken,
    expiresAt: Date.now() + r.expiresIn * 1000,
    user: r.user,
  }
}

async function renovar(): Promise<Session | null> {
  const sesion = actual
  if (!sesion) return null
  // Una sola renovación a la vez: el token de refresco se gasta al usarlo.
  renovando ??= (async () => {
    const { data, error } = await post<RespuestaDeSesion>('/auth/refresh', {
      refreshToken: sesion.refreshToken,
    })
    if (data) {
      const nueva = desdeRespuesta(data)
      guardar(nueva)
      return nueva
    }
    // 401: la sesión murió de verdad. Cualquier otro fallo (red, 5xx) no cierra nada.
    if (error?.status === 401) guardar(null)
    return actual
  })().finally(() => {
    renovando = null
  })
  return renovando
}

export const authClient = {
  /** La sesión vigente; renueva el token si está por vencer. */
  async getSession(): Promise<Session | null> {
    if (!actual) return null
    if (actual.expiresAt - Date.now() > MARGEN_MS) return actual
    return renovar()
  },

  /** Sesión tal como está guardada, sin tocar la red. */
  current(): Session | null {
    return actual
  },

  onChange(cb: Oyente): () => void {
    oyentes.add(cb)
    return () => oyentes.delete(cb)
  },

  async signIn(email: string, password: string): Promise<{ error: FalloDeAuth | null }> {
    const { data, error } = await post<RespuestaDeSesion>('/auth/login', { email, password })
    if (data) guardar(desdeRespuesta(data))
    return { error }
  },

  async signOut(): Promise<void> {
    const sesion = actual
    guardar(null)
    if (sesion) await post('/auth/logout', { refreshToken: sesion.refreshToken })
  },

  async requestPasswordReset(email: string): Promise<{ error: FalloDeAuth | null }> {
    const { error } = await post('/auth/forgot-password', { email })
    return { error }
  },

  async resetPassword(token: string, password: string): Promise<{ error: FalloDeAuth | null }> {
    const { error } = await post('/auth/reset-password', { token, password })
    return { error }
  },
}

// Otra pestaña entró o salió: esta se entera.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== CLAVE) return
    actual = leer()
    oyentes.forEach((cb) => cb(actual))
  })
}
