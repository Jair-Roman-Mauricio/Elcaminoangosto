import { useCallback, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AppLayout } from './app-layout'
import { VistaComoProvider } from '../components/vista-como'
import { useSession } from '../auth/session'

/**
 * Adaptador de autorización, no un layout paralelo: reutiliza exactamente el
 * AppLayout/Sidebar del estudiante. Para invitados, AppLayout activa el modo
 * de lectura y Sidebar omite solo enlaces/controles privados.
 */
export function PublicContentShell() {
  const { session } = useSession()
  const location = useLocation()
  const navigate = useNavigate()
  const needsAccess = !session && new URLSearchParams(location.search).get('access') === 'required'
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeModal = useCallback(() => navigate(location.pathname, { replace: true }), [location.pathname, navigate])

  useEffect(() => {
    if (!needsAccess) return
    const antes = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialogo = dialogRef.current
    dialogo?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    const alTeclado = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeModal(); return }
      if (event.key !== 'Tab' || !dialogo) return
      const focos = Array.from(dialogo.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'))
      const primero = focos[0]
      const ultimo = focos.at(-1)
      if (!primero || !ultimo) return
      if (event.shiftKey && document.activeElement === primero) { event.preventDefault(); ultimo.focus() }
      if (!event.shiftKey && document.activeElement === ultimo) { event.preventDefault(); primero.focus() }
    }
    document.addEventListener('keydown', alTeclado)
    return () => { document.removeEventListener('keydown', alTeclado); antes?.focus() }
  }, [closeModal, needsAccess])

  return (
    <VistaComoProvider>
      <AppLayout />
      {needsAccess && (
        <div className="public-access-modal" role="dialog" aria-modal="true" aria-labelledby="public-access-title">
          <button className="public-access-modal__backdrop" type="button" aria-label="Cerrar" onClick={closeModal} />
          <div ref={dialogRef} className="public-access-modal__content" role="document">
            <p className="public-access-modal__eyebrow">El Camino Angosto</p>
            <h2 id="public-access-title">Inicia sesión o regístrate para continuar</h2>
            <p className="public-access-modal__copy">Tu avance y tus conversaciones se guardan de forma segura en tu cuenta.</p>
            <div className="public-access-modal__actions"><Link data-autofocus to="/entrar">INICIAR SESIÓN</Link><Link to="/entrar?registro=1">CREAR CUENTA</Link></div>
          </div>
        </div>
      )}
    </VistaComoProvider>
  )
}
