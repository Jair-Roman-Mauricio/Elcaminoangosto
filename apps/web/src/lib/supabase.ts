import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Copia apps/web/.env.example a .env',
  )
}

/**
 * Cliente del navegador. Solo la clave ANÓNIMA llega aquí; la `service_role`
 * jamás sale del servidor.
 *
 * El SDK refresca el access token solo; `apiClient` lo lee de la sesión.
 */
export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
