import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'

// Cada pantalla se descarga al visitar su ruta. Así el login no arrastra
// cursos, feed, música, video, chat ni administración; sus animaciones se
// conservan en el chunk de la experiencia correspondiente.
const LandingPage = lazy(() =>
  import('./landing/landing-page').then((m) => ({ default: m.LandingPage })),
)
const EntrarPage = lazy(() => import('./pages/entrar').then((m) => ({ default: m.EntrarPage })))
const RecuperarContrasenaPage = lazy(() =>
  import('./pages/recuperar-contrasena').then((m) => ({ default: m.RecuperarContrasenaPage })),
)
const RestablecerContrasenaPage = lazy(() =>
  import('./pages/recuperar-contrasena').then((m) => ({ default: m.RestablecerContrasenaPage })),
)
const VerificarCorreoPage = lazy(() =>
  import('./pages/verificar-correo').then((m) => ({ default: m.VerificarCorreoPage })),
)
const KitUiPage = lazy(() => import('./pages/kit-ui').then((m) => ({ default: m.KitUiPage })))
const AuthenticatedShell = lazy(() =>
  import('./auth/authenticated-shell').then((m) => ({ default: m.AuthenticatedShell })),
)
const MaestroRoute = lazy(() =>
  import('./auth/authenticated-shell').then((m) => ({ default: m.MaestroRoute })),
)
const AdminRoute = lazy(() =>
  import('./auth/authenticated-shell').then((m) => ({ default: m.AdminRoute })),
)
const PanelRoute = lazy(() =>
  import('./auth/authenticated-shell').then((m) => ({ default: m.PanelRoute })),
)
const DashboardHomePage = lazy(() =>
  import('./modules/dashboard/dashboard-page').then((m) => ({ default: m.DashboardHomePage })),
)
const CatalogoPage = lazy(() =>
  import('./modules/discipleship/catalogo-page').then((m) => ({ default: m.CatalogoPage })),
)
const CursoPage = lazy(() =>
  import('./modules/discipleship/curso-page').then((m) => ({ default: m.CursoPage })),
)
const EstudiantesPage = lazy(() =>
  import('./modules/discipleship/estudiantes-page').then((m) => ({ default: m.EstudiantesPage })),
)
const MisCursosPage = lazy(() =>
  import('./modules/discipleship/mis-cursos-page').then((m) => ({ default: m.MisCursosPage })),
)
const EditorCursoPage = lazy(() =>
  import('./modules/discipleship/editor-curso-page').then((m) => ({ default: m.EditorCursoPage })),
)
const UsuariosPage = lazy(() =>
  import('./modules/admin/usuarios-page').then((m) => ({ default: m.UsuariosPage })),
)
const RevisionesPage = lazy(() =>
  import('./modules/admin/revisiones-page').then((m) => ({ default: m.RevisionesPage })),
)
const RevisionDetallePage = lazy(() =>
  import('./modules/admin/revision-detalle-page').then((m) => ({ default: m.RevisionDetallePage })),
)
const ModeracionPage = lazy(() =>
  import('./modules/admin/moderacion-page').then((m) => ({ default: m.ModeracionPage })),
)
const ContenidoPage = lazy(() =>
  import('./modules/admin/contenido/contenido-page').then((m) => ({ default: m.ContenidoPage })),
)
const ModeracionDetallePage = lazy(() =>
  import('./modules/admin/moderacion-detalle-page').then((m) => ({
    default: m.ModeracionDetallePage,
  })),
)
const FeedPage = lazy(() =>
  import('./modules/feed/feed-page').then((m) => ({ default: m.FeedPage })),
)
const PublicarTarjetaPage = lazy(() =>
  import('./modules/feed/publicar-tarjeta-page').then((m) => ({ default: m.PublicarTarjetaPage })),
)
const VideosCristianosPage = lazy(() =>
  import('./modules/videos/videos-cristianos-page').then((m) => ({ default: m.VideosCristianosPage })),
)
const AlabanzaPage = lazy(() =>
  import('./modules/music/alabanza-page').then((m) => ({ default: m.AlabanzaPage })),
)
const MentorChatPage = lazy(() =>
  import('./modules/chat/chat-page').then((m) => ({ default: m.MentorChatPage })),
)
const ChatConEstudiantesPage = lazy(() =>
  import('./modules/chat/chat-page').then((m) => ({ default: m.ChatConEstudiantesPage })),
)
const StudentProfilePage = lazy(() =>
  import('./modules/profile/student-profile-page').then((m) => ({ default: m.StudentProfilePage })),
)

const Cargando = () => <div className="min-h-screen bg-fondo" role="status" aria-label="Cargando" />
const conCarga = (elemento: ReactNode) => <Suspense fallback={<Cargando />}>{elemento}</Suspense>

/** Restringe una pantalla a ciertos roles (el ADMIN siempre pasa). */
const soloMaestro = (el: ReactNode) => conCarga(<MaestroRoute>{el}</MaestroRoute>)
const soloAdmin = (el: ReactNode) => conCarga(<AdminRoute>{el}</AdminRoute>)
const soloPanel = (el: ReactNode) => conCarga(<PanelRoute>{el}</PanelRoute>)

/**
 * Rutas. Toda la app autenticada vive bajo un único layout, cuya nav se deriva
 * del rol efectivo (`VistaComoProvider`). Las guardias por ruta son de UX; la
 * autorización real vive en los guards de NestJS y en RLS.
 */
export const router = createBrowserRouter([
  // Público
  {
    path: '/',
    element: conCarga(<LandingPage />),
  },
  { path: '/entrar', element: conCarga(<EntrarPage />) },
  { path: '/recuperar', element: conCarga(<RecuperarContrasenaPage />) },
  { path: '/restablecer-contrasena', element: conCarga(<RestablecerContrasenaPage />) },
  { path: '/verificar-correo', element: conCarga(<VerificarCorreoPage />) },
  { path: '/kit-ui', element: conCarga(<KitUiPage />) },

  // App autenticada (nav por rol efectivo)
  {
    element: conCarga(<AuthenticatedShell />),
    children: [
      { path: '/discipulado', element: conCarga(<CatalogoPage />) },
      { path: '/discipulado/:slug', element: conCarga(<CursoPage />) },
      { path: '/tarjetas', element: conCarga(<FeedPage />) },
      { path: '/tarjetas/publicar', element: conCarga(<PublicarTarjetaPage />) },
      { path: '/videos', element: conCarga(<VideosCristianosPage />) },
      { path: '/alabanza', element: conCarga(<AlabanzaPage />) },
      { path: '/chat', element: conCarga(<MentorChatPage />) },
      { path: '/perfil', element: conCarga(<StudentProfilePage />) },

      // Base de la navegación para MAESTRO y ADMIN.
      { path: '/dashboard', element: soloPanel(conCarga(<DashboardHomePage />)) },

      { path: '/maestro/cursos', element: soloMaestro(conCarga(<MisCursosPage />)) },
      { path: '/maestro/cursos/:id', element: soloMaestro(conCarga(<EditorCursoPage />)) },
      { path: '/maestro/chat', element: soloMaestro(conCarga(<ChatConEstudiantesPage />)) },
      { path: '/maestro/estudiantes', element: soloMaestro(conCarga(<EstudiantesPage />)) },

      // El panel del admin ahora vive en /dashboard (base compartida).
      { path: '/admin', element: <Navigate to="/dashboard" replace /> },
      { path: '/admin/revisiones', element: soloAdmin(conCarga(<RevisionesPage />)) },
      { path: '/admin/revisiones/:id', element: soloAdmin(conCarga(<RevisionDetallePage />)) },
      { path: '/admin/usuarios', element: soloAdmin(conCarga(<UsuariosPage />)) },
      { path: '/admin/moderacion', element: soloAdmin(conCarga(<ModeracionPage />)) },
      { path: '/admin/moderacion/:id', element: soloAdmin(conCarga(<ModeracionDetallePage />)) },
      { path: '/admin/contenido', element: soloAdmin(conCarga(<ContenidoPage />)) },
    ],
  },

  { path: '*', element: <Navigate to="/" replace /> },
])
