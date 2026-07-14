import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Role } from '@elcamino/shared-types'
import { usePerfil } from '../auth/session'

/**
 * «Ver como» del ADMIN: le permite recorrer la plataforma tal como la vería un
 * ESTUDIANTE o un MAESTRO, sin cambiar su rol real. Solo afecta a la interfaz
 * (nav y qué pantallas se muestran); la autorización real sigue en el API.
 */
interface ContextoVistaComo {
  /** Rol real del usuario. */
  rolReal: Role | undefined
  /** Rol con el que se está viendo la app (= rolReal salvo que el admin lo cambie). */
  rolEfectivo: Role | undefined
  /** Solo un ADMIN puede estar «viendo como» otro rol. */
  viendoComo: Role | null
  verComo: (role: Role | null) => void
}

const VistaComoContext = createContext<ContextoVistaComo>({
  rolReal: undefined,
  rolEfectivo: undefined,
  viendoComo: null,
  verComo: () => undefined,
})

export function VistaComoProvider({ children }: { children: ReactNode }) {
  const { data: perfil } = usePerfil()
  const rolReal = perfil?.role
  const [override, setOverride] = useState<Role | null>(null)

  const verComo = useCallback(
    (role: Role | null) => {
      // Solo el admin puede simular otro rol.
      if (rolReal !== 'ADMIN') return
      setOverride(role === 'ADMIN' ? null : role)
    },
    [rolReal],
  )

  const valor = useMemo<ContextoVistaComo>(() => {
    const viendoComo = rolReal === 'ADMIN' ? override : null
    return {
      rolReal,
      rolEfectivo: viendoComo ?? rolReal,
      viendoComo,
      verComo,
    }
  }, [rolReal, override, verComo])

  return <VistaComoContext.Provider value={valor}>{children}</VistaComoContext.Provider>
}

export function useVistaComo(): ContextoVistaComo {
  return useContext(VistaComoContext)
}
