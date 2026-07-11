import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'framer-motion'
import { SessionProvider } from './auth/session'
import { router } from './router'
import { ApiError } from './lib/api-client'
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

createRoot(raiz).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {/* `reducedMotion="user"` neutraliza el movimiento de Framer Motion para
          quien lo pida en su sistema (RNF-6), en toda la app de una vez. */}
      <MotionConfig reducedMotion="user">
        <SessionProvider>
          <RouterProvider router={router} />
        </SessionProvider>
      </MotionConfig>
    </QueryClientProvider>
  </StrictMode>,
)
