# arquitectura.md — El Camino Angosto

> Arquitectura de referencia, patrones de diseño, stack detallado y modelo de datos.
> Objetivo rector: **escalabilidad sin sobre-ingeniería**. Empezamos como *monolito modular* bien delimitado por dominios, listo para extraer servicios cuando (y solo si) el tráfico lo justifique.

---

## 1. Decisión arquitectónica principal: Monolito Modular

Para el estado actual (equipo pequeño, MVP, 3 dominios de producto), **microservicios sería sobre-ingeniería**: multiplica la complejidad de despliegue, red y datos sin beneficio real todavía. Elegimos un **Monolito Modular** en NestJS: un solo desplegable, pero internamente dividido en **módulos = contextos acotados (bounded contexts)** con fronteras explícitas.

**Ventajas para nosotros:**
- Un solo build/deploy en Railway → coste y operación mínimos.
- Transacciones ACID entre módulos cuando se necesitan (Postgres único).
- Fronteras claras: cada módulo expone una API interna; nadie accede a las tablas de otro módulo directamente.
- **Camino de evolución**: cuando un módulo (p. ej. *media/transcoding* o *feed*) necesite escalar aparte, se extrae a servicio propio sin reescribir el dominio, porque ya está aislado y se comunica por eventos.

### Estilo de capas por módulo (Clean/Hexagonal ligero)

```
┌──────────────────────────────────────────────┐
│  Interface (HTTP)   controllers, DTOs, guards  │  ← entra la petición
├──────────────────────────────────────────────┤
│  Application        use-cases / services       │  ← orquesta reglas
├──────────────────────────────────────────────┤
│  Domain             entities, value objects,    │  ← reglas de negocio puras
│                     domain events, policies     │
├──────────────────────────────────────────────┤
│  Infrastructure     repositories, Supabase      │  ← detalles técnicos
│                     adapters, storage, queue     │
└──────────────────────────────────────────────┘
```

Regla: **las dependencias apuntan hacia adentro**. El dominio no conoce a Supabase; se accede a él por interfaces (puertos) implementadas en infraestructura (adaptadores). Esto permite testear el dominio sin base de datos y cambiar de proveedor sin tocar reglas de negocio.

## 2. Mapa de módulos (bounded contexts)

| Módulo NestJS | Responsabilidad | Publica eventos | Escucha eventos |
|---|---|---|---|
| `auth` | Verificación de JWT de Supabase (JWKS), sesión, contexto de usuario | — | — |
| `users` | Perfiles, roles, niveles, relación mentor–estudiante | `UserLevelChanged` | `LevelUpRequestApproved` |
| `music` | Catálogo, playlists, reproducciones, likes | `SongPlayed` | — |
| `feed` | Tarjetas de Fe (video/imagen), likes, comentarios, follows | `PostPublished` | `MediaAssetReady` |
| `discipleship` | Cursos, módulos, lecciones, inscripciones, progreso, flujo de aprobación | `CourseSubmitted`, `CoursePublished`, `LessonCompleted` | `MediaAssetReady` |
| `chat` | Conversaciones mentor–estudiante, solicitudes de subida de nivel | `LevelUpRequested`, `LevelUpRequestApproved` | — |
| `media` | Ingesta de archivos, subida reanudable, transcodificación, URLs firmadas | `MediaAssetReady`, `MediaAssetFailed` | `MediaUploadRequested` |
| `admin` | Aprobación de cursos, gestión de usuarios/roles, moderación | `CourseReviewed` | `CourseSubmitted`, `PostReported` |
| `notifications` | Notificaciones in-app / email | — | (varios) |
| `shared` (común) | Guards RBAC, filtros de excepción, logging, config, tipos comunes | — | — |

**Comunicación entre módulos:** por **eventos de dominio in-process** (NestJS `EventEmitter2`). Nunca un módulo importa el repositorio de otro. Si necesita datos de otro contexto, lo pide por su servicio público o reacciona a un evento. Esto es lo que hace posible extraer un módulo a microservicio después (los eventos se redirigen a un broker sin cambiar los emisores/consumidores).

## 3. Stack detallado y justificación

### 3.1 Monorepo
- **pnpm workspaces** (requerido) + **Turborepo** para orquestar builds y cachear tareas.
- Estructura:

```
elcaminoangosto/
├─ apps/
│  ├─ web/            # React + Vite (frontend, incluye landing migrada)
│  ├─ api/            # NestJS (monolito modular)
│  └─ worker/         # Procesos async (transcodificación, jobs) — puede vivir dentro de api al inicio
├─ packages/
│  ├─ shared-types/   # tipos e interfaces compartidos (contratos DTO/API)
│  ├─ config/         # eslint, tsconfig, tailwind preset compartidos
│  └─ ui/             # design system (componentes React reutilizables)
├─ supabase/          # migraciones SQL, políticas RLS, seed
├─ docs/              # contexto.md, arquitectura.md, DESIGN.md, BACKLOG.md, AGENTS.md
├─ .codegraph/        # índice del grafo de código (generado)
├─ pnpm-workspace.yaml
├─ turbo.json
└─ package.json
```

### 3.2 Frontend (`apps/web`)
| Pieza | Elección | Por qué |
|---|---|---|
| Framework | **React 18/19 + Vite** | SPA rápida; el usuario ya tiene landing en HTML/JS a migrar. |
| Lenguaje | **TypeScript** | contratos tipados de punta a punta. |
| Estilos | **TailwindCSS** + preset del design system | traduce los tokens de `DESIGN.md` (colores, escala 10px=1rem, spacing). |
| Componentes base | **shadcn/ui** (headless, reestilizado a la marca) | accesibles y sin lock-in visual. |
| Estado servidor | **TanStack Query** | caché, revalidación, estados de carga; ideal para catálogos/feed. |
| Estado cliente | **Zustand** | reproductor de música global, sesión, UI ligera. |
| Routing | **React Router** | rutas por rol y layouts anidados. |
| Formularios | **React Hook Form + Zod** | validación compartida con el back (mismos esquemas Zod). |
| Video (feed/lecciones) | **hls.js** + `<video>` | HLS donde exista; MP4 progresivo como fallback. |
| Audio (música) | **Howler.js** o Web Audio API | control fino de cola, gapless, buffering. |
| Animación | **Framer Motion** | replica la sensación *spring* de la landing (ver curva de easing en DESIGN.md). |
| Realtime | **@supabase/supabase-js** (canal Realtime) | chat y notificaciones en vivo. |

### 3.3 Backend (`apps/api`)
| Pieza | Elección | Por qué |
|---|---|---|
| Framework | **NestJS 11** | DI, módulos, guards, interceptores → encaja con monolito modular. |
| ORM | **Drizzle ORM** (recomendado) o Prisma | Drizzle: SQL tipado, ligero, excelente con Postgres/Supabase y migraciones versionadas. Prisma como alternativa si el equipo prefiere DX más guiada. |
| Validación | **Zod** vía `nestjs-zod` (o class-validator) | esquemas Zod reutilizables en front y back. |
| Auth | **Supabase Auth** en el front + verificación **JWKS asimétrica** en Nest con `jose` | ver §5. |
| Colas/Jobs | **BullMQ + Redis** (plugin Redis de Railway) | transcodificación, notificaciones, workflows de aprobación fiables. |
| Realtime chat | **Supabase Realtime** (MVP) con opción a **WebSocket Gateway** de Nest | menos infra al inicio; se puede migrar a gateway propio si se necesita lógica servidor. |
| Logging | **pino** (`nestjs-pino`) | logs estructurados JSON. |
| Errores/APM | **Sentry** + OpenTelemetry | trazas y errores en prod. |
| Docs API | **Swagger/OpenAPI** (`@nestjs/swagger`) | contrato vivo para el front. |

### 3.4 Datos y almacenamiento (Supabase)
- **Postgres** como única fuente de verdad relacional.
- **Supabase Storage (buckets)**:
  - `avatars` (público) — fotos de perfil.
  - `thumbnails` (público) — miniaturas de tarjetas/cursos/música (con *image transforms* de Supabase).
  - `music` (privado) — pistas de audio, servidas por URL firmada.
  - `feed-media` (privado) — videos/imágenes del feed.
  - `course-media` (privado) — videos/recursos de lecciones (gated por inscripción/nivel).
- **Supabase Realtime** — canales para chat y notificaciones.
- **RLS** activado en todas las tablas como **defensa en profundidad** (la autorización primaria vive en los guards de Nest; RLS es el segundo cerrojo).

### 3.5 Infraestructura / despliegue (Railway)
- **Servicio `api`** (NestJS) + **servicio `worker`** (BullMQ) + **Redis** (plugin) en Railway.
- **Servicio `web`** (build estático de Vite servido por Railway, o CDN).
- **Supabase Cloud** gestiona DB/Auth/Storage/Realtime (fuera de Railway, como pediste).
- Variables de entorno por servicio; secretos nunca en el repo.
- **CI/CD:** GitHub Actions → lint + test + build; despliegue automático a Railway por rama (`main` = prod, `develop` = staging).

## 4. Patrones de diseño aplicados

| Patrón | Dónde | Para qué |
|---|---|---|
| **Repository** | infraestructura de cada módulo | aislar acceso a datos; el dominio depende de una interfaz, no de Drizzle/Supabase. |
| **Strategy** | `media` (proveedor de storage/transcodificación), `notifications` (email/in-app) | poder cambiar de Supabase Storage a Mux/Cloudflare Stream, o de canal de notificación, sin tocar el consumidor. |
| **Adapter** | wrappers de `@supabase/supabase-js`, `jose`, BullMQ | encapsular SDKs externos detrás de puertos. |
| **Factory** | creación de estrategias/proveedores según config | selección en runtime del adaptador correcto. |
| **Guard + Policy (RBAC/ABAC)** | `shared` | `RolesGuard` (rol) + `PolicyGuard` (propiedad/nivel del recurso). |
| **DTO + Mapper** | interface layer | separar el contrato HTTP del modelo de dominio. |
| **Domain Events / Observer** | comunicación entre módulos | desacoplar (p. ej. `CoursePublished` → `notifications`). |
| **CQRS ligero** | `feed`, `music` | modelos de lectura optimizados (feed personalizado) separados de la escritura. |
| **State Machine** | `discipleship` (publicación de curso), `chat` (solicitud de nivel) | transiciones válidas y auditables (ver máquina de estados en `contexto.md`). |
| **Outbox (opcional, fase 2)** | eventos críticos | entrega fiable de eventos si se extrae a microservicios. |

## 5. Seguridad y autenticación (detalle)

**Flujo:**
1. El **frontend** usa `@supabase/supabase-js` para registro/login → obtiene un **access token (JWT)** y lo refresca solo.
2. Cada llamada al **API NestJS** viaja con `Authorization: Bearer <jwt>`.
3. NestJS **verifica el JWT con las claves asimétricas (JWKS)** de Supabase usando `jose`, **no** con el secreto HS256 legacy.
   - Motivo (verificado en docs de Supabase, 2025+): Supabase recomienda **JWT Signing Keys asimétricas** (ES256/RS256) publicadas en el endpoint JWKS del proyecto. Verificar contra JWKS (con caché ~10 min) es más seguro y permite **rotación sin downtime**; el secreto compartido HS256 queda **desaconsejado**.
4. Del token se extrae `sub` (user id) y claims; se carga el **perfil/rol** desde `public.profiles`.
5. **Autorización:**
   - `RolesGuard` valida el rol (ESTUDIANTE/MAESTRO/ADMIN).
   - `PolicyGuard` valida acceso fino: propiedad del recurso (maestro ↔ sus cursos), nivel del estudiante ↔ nivel requerido del curso.
6. **RLS en Supabase** como segunda barrera: aunque alguien saltara el API, las políticas de fila impiden leer/escribir lo indebido. El backend usa la **service key** solo en operaciones administrativas controladas; el resto respeta el contexto del usuario.

**Buenas prácticas adicionales:** rate limiting (`@nestjs/throttler`), CORS restringido, Helmet, validación estricta de DTOs, sanitización de contenido de usuario (feed/chat), y **URLs firmadas de corta duración** para todo medio privado.

## 6. Estrategia de medios (música, feed y lecciones)

**Hecho clave (verificado):** Supabase Storage **no transcodifica** video/audio automáticamente. Sirve archivos tal cual (MP4 progresivo reproducible en `<video>`, o HLS si tú subes los segmentos y usas `hls.js`). Por tanto, diseñamos una **capa de medios propia** con abstracción de proveedor:

**Pipeline de ingesta:**
```
Cliente ──(subida reanudable TUS/Uppy)──► bucket privado (raw)
        └─ crea fila media_assets (status = UPLOADED)
                         │
        emite MediaUploadRequested
                         ▼
   worker (BullMQ) ── ffmpeg ──► genera:
        · variantes HLS (feed/lecciones)  ·  thumbnails/poster
        · audio normalizado (música)
                         │
   sube derivados a bucket ──► media_assets.status = READY
                         │
        emite MediaAssetReady ──► feed/discipleship publican el contenido
```

- **Subidas grandes:** protocolo **TUS (resumable)** con Uppy → tolerante a cortes de red.
- **Entrega privada:** **URLs firmadas** de corta vida (p. ej. 60 min) generadas por el API tras validar autorización. Las signed URLs de Storage usan una clave interna independiente del JWT de Auth (no se invalidan al rotar Auth).
- **Miniaturas:** *image transforms* nativos de Supabase (resize/quality) + caché CDN.
- **Abstracción (Strategy):** `MediaProvider` con implementación `SupabaseMediaProvider` hoy; interfaz lista para `MuxMediaProvider` / `CloudflareStreamProvider` mañana si el volumen de video lo pide (esos servicios traen transcodificación y CDN de video llave en mano). **El dominio nunca sabe cuál se usa.**

> Recomendación de coste/escala: para el MVP, Supabase Storage + `hls.js` + worker ffmpeg es suficiente y barato. Si el feed vertical explota en volumen, mover **solo** el video a Cloudflare Stream/Mux detrás de la misma interfaz, sin tocar el resto.

## 7. Modelo de datos (esquema lógico)

> Postgres. `auth.users` lo gestiona Supabase; el resto vive en el esquema `public`. Todas las tablas llevan `id uuid pk`, `created_at`, `updated_at`. RLS activado en todas.

### Identidad y roles
- **profiles** `(id → auth.users, role[ESTUDIANTE|MAESTRO|ADMIN], display_name, avatar_url, bio, current_level_id, created_at)`
- **levels** `(id, name, rank int, description)` — niveles de madurez (ej. 1..N).
- **mentorships** `(id, mentor_id → profiles, student_id → profiles, status, started_at)`

### Discipulado (cursos)
- **courses** `(id, teacher_id, title, slug, description, thumbnail_asset_id, required_level_id, is_free, status[DRAFT|SUBMITTED|UNDER_REVIEW|APPROVED|PUBLISHED|REJECTED|ARCHIVED], planned_modules int)`
- **course_modules** `(id, course_id, title, order_index)`
- **lessons** `(id, module_id, title, type[VIDEO|TEXT], content, media_asset_id, order_index, duration_seconds)`
- **course_reviews** `(id, course_id, reviewer_id → admin, decision[APPROVED|REJECTED], notes, reviewed_at)` — auditoría del flujo de aprobación.
- **enrollments** `(id, student_id, course_id, status[ACTIVE|COMPLETED|DROPPED], progress_pct, enrolled_at)`
- **lesson_progress** `(id, enrollment_id, lesson_id, completed_at)`

### Música (Alabanza)
- **artists** `(id, name, bio, avatar_asset_id)`
- **albums** `(id, artist_id, title, cover_asset_id, released_at)`
- **songs** `(id, album_id, artist_id, title, audio_asset_id, duration_seconds, is_published)`
- **playlists** `(id, owner_id, title, is_public)` · **playlist_songs** `(playlist_id, song_id, order_index)`
- **song_plays** `(id, song_id, user_id, played_at)` · **song_likes** `(song_id, user_id)`

### Feed (Tarjetas de Fe)
- **posts** `(id, author_id, type[VIDEO|IMAGE], media_asset_id, caption, status[PUBLISHED|HIDDEN|REPORTED], published_at)`
- **post_likes** `(post_id, user_id)` · **post_comments** `(id, post_id, author_id, body)`
- **follows** `(follower_id, followee_id)`
- **post_reports** `(id, post_id, reporter_id, reason, status)` — moderación.

### Chat y niveles
- **conversations** `(id, mentor_id, student_id, last_message_at)`
- **messages** `(id, conversation_id, sender_id, body, read_at)`
- **level_up_requests** `(id, student_id, mentor_id, from_level_id, to_level_id, message, status[PENDING|APPROVED|REJECTED], resolved_at)`

### Medios y notificaciones (transversal)
- **media_assets** `(id, owner_id, bucket, path, kind[AUDIO|VIDEO|IMAGE], status[UPLOADED|PROCESSING|READY|FAILED], hls_path, poster_path, duration_seconds, bytes)`
- **notifications** `(id, user_id, type, payload jsonb, read_at)`

### Diagrama de relaciones (resumen)

```
profiles ──< enrollments >── courses ──< course_modules ──< lessons ──> media_assets
   │  │                         │
   │  └──< mentorships >── profiles (mentor)      course_reviews ──> profiles (admin)
   │
   ├──< level_up_requests >── levels
   ├──< conversations >── messages
   ├──< posts >── post_comments / post_likes / post_reports
   └──< playlists >── playlist_songs ── songs ── albums ── artists
```

## 8. Requisitos no funcionales (referencia rápida; detalle en BACKLOG.md)

- **Rendimiento:** arranque de video < 2 s (p75); respuestas API < 300 ms (p95) en lecturas cacheables.
- **Escalabilidad:** stateless en API (sesión en JWT); jobs pesados fuera del request (BullMQ).
- **Disponibilidad:** objetivo 99.5% MVP; health checks y reintentos en jobs.
- **Seguridad:** OWASP Top 10, RLS, URLs firmadas, rate limiting, validación estricta.
- **Observabilidad:** logs estructurados, trazas, métricas de dominio (reproducciones, completado de lecciones).
- **Accesibilidad:** WCAG 2.1 AA en componentes clave.
- **Coste:** preferir soluciones serverless/gestionadas; escalar video solo si el volumen lo exige.

## 9. Camino de evolución (cuándo dejar el monolito)

Extraer un módulo a servicio propio **solo** cuando se cumpla al menos uno:
- El módulo tiene un perfil de carga muy distinto (p. ej. `media`/transcodificación satura CPU).
- Necesita escalar o desplegar en cadencia independiente.
- Requiere un stack distinto (p. ej. workers en Go/Rust para procesamiento pesado).

Como los módulos ya se comunican por eventos y no comparten tablas ajenas, la extracción es incremental: se cambia el `EventEmitter` in-process por un broker (Redis Streams/NATS/RabbitMQ) para ese módulo y se le da su propio despliegue.
