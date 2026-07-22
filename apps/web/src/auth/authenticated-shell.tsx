import type { ReactNode } from 'react'
import { VistaComoProvider } from '../components/vista-como'
import { AppLayout } from '../layouts/app-layout'
import { RequireRole } from './require-role'

/** Layout autenticado, diferido como una sola frontera de carga. */
export function AuthenticatedShell() {
  return (
    <RequireRole>
      <VistaComoProvider>
        <AppLayout />
      </VistaComoProvider>
    </RequireRole>
  )
}

export function MaestroRoute({ children }: { children: ReactNode }) {
  return <RequireRole roles={['MAESTRO']}>{children}</RequireRole>
}

export function AdminRoute({ children }: { children: ReactNode }) {
  return <RequireRole roles={['ADMIN']}>{children}</RequireRole>
}
