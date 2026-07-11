import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import {
  AppLayout,
  ENLACES_ADMIN,
  ENLACES_ESTUDIANTE,
  ENLACES_MAESTRO,
} from './layouts/app-layout'
import { RequireRole } from './auth/require-role'
import { EntrarPage } from './pages/entrar'
import { KitUiPage } from './pages/kit-ui'
import { Pendiente } from './pages/pendiente'
import { CatalogoPage } from './modules/discipleship/catalogo-page'
import { CursoPage } from './modules/discipleship/curso-page'
import { EstudiantesPage } from './modules/discipleship/estudiantes-page'
import { MisCursosPage } from './modules/discipleship/mis-cursos-page'
import { EditorCursoPage } from './modules/discipleship/editor-curso-page'
import { UsuariosPage } from './modules/admin/usuarios-page'
import { RevisionesPage } from './modules/admin/revisiones-page'
import { FeedPage } from './modules/feed/feed-page'
import { PublicarTarjetaPage } from './modules/feed/publicar-tarjeta-page'

// La landing arrastra GSAP + Lenis (ADR-003). Se carga aparte para no
// penalizar el bundle de la app autenticada.
const LandingPage = lazy(() =>
  import('./landing/landing-page').then((m) => ({ default: m.LandingPage })),
)

const Cargando = () => <div className="min-h-screen bg-fondo" />

/**
 * Rutas por rol. La guardia `RequireRole` es de UX; la autorización real vive
 * en los guards de NestJS y en RLS.
 */
export const router = createBrowserRouter([
  // ── Público ───────────────────────────────────────────────────────────
  {
    path: '/',
    element: (
      <Suspense fallback={<Cargando />}>
        <LandingPage />
      </Suspense>
    ),
  },
  { path: '/entrar', element: <EntrarPage /> },
  {
    path: '/recuperar',
    element: <Pendiente titulo="Recuperar contraseña" historia="HU-1.4 · Sprint S1" />,
  },
  { path: '/kit-ui', element: <KitUiPage /> },

  // ── Estudiante ────────────────────────────────────────────────────────
  {
    element: (
      <RequireRole>
        <AppLayout enlaces={ENLACES_ESTUDIANTE} />
      </RequireRole>
    ),
    children: [
      { path: '/discipulado', element: <CatalogoPage /> },
      { path: '/discipulado/:slug', element: <CursoPage /> },
      { path: '/tarjetas', element: <FeedPage /> },
      { path: '/tarjetas/publicar', element: <PublicarTarjetaPage /> },
      {
        path: '/alabanza',
        element: <Pendiente titulo="Alabanza" historia="HU-2.2 · Sprint S5" />,
      },
      { path: '/chat', element: <Pendiente titulo="Chat mentor" historia="HU-6.1 · Sprint S4" /> },
      { path: '/perfil', element: <Pendiente titulo="Mi perfil" historia="HU-1.1 · Sprint S0" /> },
    ],
  },

  // ── Maestro ───────────────────────────────────────────────────────────
  {
    element: (
      <RequireRole roles={['MAESTRO']}>
        <AppLayout enlaces={ENLACES_MAESTRO} />
      </RequireRole>
    ),
    children: [
      { path: '/maestro/cursos', element: <MisCursosPage /> },
      { path: '/maestro/cursos/:id', element: <EditorCursoPage /> },
      { path: '/maestro/estudiantes', element: <EstudiantesPage /> },
    ],
  },

  // ── Admin ─────────────────────────────────────────────────────────────
  {
    element: (
      <RequireRole roles={['ADMIN']}>
        <AppLayout enlaces={ENLACES_ADMIN} />
      </RequireRole>
    ),
    children: [
      { path: '/admin', element: <Pendiente titulo="Panel" historia="HU-7.1 · Sprint S6" /> },
      { path: '/admin/revisiones', element: <RevisionesPage /> },
      {
        path: '/admin/moderacion',
        element: <Pendiente titulo="Moderación" historia="HU-7.2 · Sprint S6" />,
      },
      { path: '/admin/usuarios', element: <UsuariosPage /> },
    ],
  },

  { path: '*', element: <Navigate to="/" replace /> },
])
