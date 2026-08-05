import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'

// Cada pantalla se descarga al visitar su ruta: quien entra a escuchar música
// no arrastra el panel de administración.
const LandingPage = lazy(() =>
  import('./landing/landing-cinematica').then((m) => ({ default: m.LandingCinematica })),
)
const EntrarPage = lazy(() => import('./pages/entrar').then((m) => ({ default: m.EntrarPage })))
const RecuperarContrasenaPage = lazy(() =>
  import('./pages/recuperar-contrasena').then((m) => ({ default: m.RecuperarContrasenaPage })),
)
const RestablecerContrasenaPage = lazy(() =>
  import('./pages/recuperar-contrasena').then((m) => ({ default: m.RestablecerContrasenaPage })),
)
const KitUiPage = lazy(() => import('./pages/kit-ui').then((m) => ({ default: m.KitUiPage })))
const AuthenticatedShell = lazy(() =>
  import('./auth/authenticated-shell').then((m) => ({ default: m.AuthenticatedShell })),
)
const PublicContentShell = lazy(() =>
  import('./layouts/public-content-shell').then((m) => ({ default: m.PublicContentShell })),
)
const AdminRoute = lazy(() =>
  import('./auth/authenticated-shell').then((m) => ({ default: m.AdminRoute })),
)
const EstadisticasPage = lazy(() =>
  import('./modules/admin/estadisticas/estadisticas-page').then((m) => ({
    default: m.EstadisticasPage,
  })),
)
const ContenidoPage = lazy(() =>
  import('./modules/admin/contenido/contenido-page').then((m) => ({ default: m.ContenidoPage })),
)
const FeedPage = lazy(() =>
  import('./modules/feed/feed-page').then((m) => ({ default: m.FeedPage })),
)
const VideosCristianosPage = lazy(() =>
  import('./modules/videos/videos-cristianos-page').then((m) => ({
    default: m.VideosCristianosPage,
  })),
)
const DevocionalesPage = lazy(() =>
  import('./modules/lecturas/devocionales-page').then((m) => ({ default: m.DevocionalesPage })),
)
const RevistaPage = lazy(() =>
  import('./modules/lecturas/revista-page').then((m) => ({ default: m.RevistaPage })),
)
const OracionesPage = lazy(() =>
  import('./modules/lecturas/oraciones-page').then((m) => ({ default: m.OracionesPage })),
)
const ComunidadPage = lazy(() =>
  import('./modules/community/comunidad-page').then((m) => ({ default: m.ComunidadPage })),
)
const HiloPage = lazy(() =>
  import('./modules/community/comunidad-page').then((m) => ({ default: m.HiloPage })),
)
const AlabanzaPage = lazy(() =>
  import('./modules/music/alabanza-page').then((m) => ({ default: m.AlabanzaPage })),
)

const Cargando = () => <div className="min-h-screen bg-fondo" role="status" aria-label="Cargando" />
const conCarga = (elemento: ReactNode) => <Suspense fallback={<Cargando />}>{elemento}</Suspense>

const soloAdmin = (el: ReactNode) => conCarga(<AdminRoute>{el}</AdminRoute>)

/**
 * Rutas.
 *
 * Todo el contenido es público: no hay registro ni sesión para quien viene a
 * leer, ver o escuchar. La única puerta con llave es `/entrar`, y solo la usa
 * la administración. Las guardias de aquí son de experiencia; la autorización
 * de verdad vive en los guards de NestJS y en RLS.
 */
export const router = createBrowserRouter([
  { path: '/', element: conCarga(<LandingPage />) },
  { path: '/entrar', element: conCarga(<EntrarPage />) },
  { path: '/recuperar', element: conCarga(<RecuperarContrasenaPage />) },
  { path: '/restablecer-contrasena', element: conCarga(<RestablecerContrasenaPage />) },
  { path: '/kit-ui', element: conCarga(<KitUiPage />) },

  // Contenido, abierto a cualquiera.
  {
    element: conCarga(<PublicContentShell />),
    children: [
      { path: '/tarjetas', element: conCarga(<FeedPage />) },
      { path: '/videos', element: conCarga(<VideosCristianosPage />) },
      { path: '/alabanza', element: conCarga(<AlabanzaPage />) },
      { path: '/devocionales', element: conCarga(<DevocionalesPage />) },
      { path: '/revista', element: conCarga(<RevistaPage />) },
      // Cada artículo con su propia dirección: se comparte y se recarga.
      { path: '/revista/:articuloId', element: conCarga(<RevistaPage />) },
      { path: '/oraciones', element: conCarga(<OracionesPage />) },
      { path: '/comunidad', element: conCarga(<ComunidadPage />) },
      { path: '/comunidad/:id', element: conCarga(<HiloPage />) },
    ],
  },

  // Administración.
  {
    element: conCarga(<AuthenticatedShell />),
    children: [
      { path: '/admin', element: <Navigate to="/admin/contenido" replace /> },
      { path: '/admin/contenido', element: soloAdmin(conCarga(<ContenidoPage />)) },
      { path: '/admin/estadisticas', element: soloAdmin(conCarga(<EstadisticasPage />)) },
    ],
  },

  { path: '*', element: <Navigate to="/" replace /> },
])
