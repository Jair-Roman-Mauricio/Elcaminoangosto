import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQuery } from '@tanstack/react-query'
import type { Profile } from '@elcamino/shared-types'
import { supabase } from '../lib/supabase'
import { apiClient } from '../lib/api-client'

interface ContextoDeSesion {
  session: Session | null
  /** `true` mientras se resuelve la sesión inicial. */
  cargando: boolean
}

const SesionContext = createContext<ContextoDeSesion>({ session: null, cargando: true })

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setCargando(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_evento, nuevaSesion) => {
      setSession(nuevaSesion)
    })

    return () => subscription.unsubscribe()
  }, [])

  return <SesionContext.Provider value={{ session, cargando }}>{children}</SesionContext.Provider>
}

export function useSession(): ContextoDeSesion {
  return useContext(SesionContext)
}

/**
 * Perfil del usuario (rol y nivel). Viene del API, no del JWT: el rol vive en
 * `profiles` y puede cambiar sin que el token se renueve.
 */
export function usePerfil() {
  const { session } = useSession()

  return useQuery({
    queryKey: ['perfil', session?.user.id],
    queryFn: () => apiClient.get<Profile>('/users/me'),
    enabled: Boolean(session),
    staleTime: 5 * 60 * 1000,
  })
}
