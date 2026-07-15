import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'framer-motion'
import { SessionProvider } from './auth/session'
import { ThemeProvider } from './components/theme'
import { router } from './router'
import { ApiError } from './lib/api-client'
import { navegarConTransicion } from './components/page-transition'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (intentos, error) => {
        // Un 401/403 no se arregla reintentando.
        if (error instanceof ApiError && error.statusCode < 500) return false
        return intentos < 2
      },
    },
  },
})

const raiz = document.getElementById('root')
if (!raiz) throw new Error('Falta el nodo #root en index.html')

/**
 * Intercepta enlaces internos para envolver el cambio de ruta en una View
 * Transition. El fallback conserva la navegación normal en navegadores sin
 * soporte (la técnica parte del patrón mostrado en theme-toggle.rdsx.dev).
 */
document.addEventListener('click', (event) => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  const target = event.target instanceof Element ? event.target.closest('a[href]') : null
  if (!(target instanceof HTMLAnchorElement) || target.target === '_blank' || target.hasAttribute('download')) return
  // Las opciones del sidebar tienen su propio barrido dentro del main; no
  // deben activar la transición de interfaz completa.
  if (target.closest('aside[aria-label="Navegación principal"]')) return
  const url = new URL(target.href, window.location.href)
  if (url.origin !== window.location.origin || url.pathname === window.location.pathname && url.search === window.location.search && url.hash === window.location.hash) return

  event.preventDefault()
  const navegar = () => {
    window.history.pushState({}, '', `${url.pathname}${url.search}${url.hash}`)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }
  navegarConTransicion(navegar)
}, true)

createRoot(raiz).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {/* `reducedMotion="user"` neutraliza el movimiento de Framer Motion para
          quien lo pida en su sistema (RNF-6), en toda la app de una vez. */}
      <MotionConfig reducedMotion="user">
        <ThemeProvider>
          <SessionProvider>
            <RouterProvider router={router} />
          </SessionProvider>
        </ThemeProvider>
      </MotionConfig>
    </QueryClientProvider>
  </StrictMode>,
)
