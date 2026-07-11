# PROGRESO.md — Checklist de historias

Estado real, verificado contra el código y contra la base de datos. Una historia solo se marca ✅ si cumple **todos** sus criterios de aceptación y su verificación consta en este documento.

Leyenda: ✅ hecha · 🟡 parcial · ⬜ pendiente

---

## Fase A — Andamiaje

| | Entregable | Verificación |
|---|---|---|
| ✅ | Monorepo pnpm + Turborepo | `pnpm install && pnpm build` en limpio: 5/5 tareas |
| ✅ | `packages/config` con preset de Tailwind | Tokens reales de la landing (ADR-001) |
| ✅ | `packages/shared-types` | 8 tests de la máquina de estados en verde |
| ✅ | `packages/ui` | Eyebrow, Boton, Card, Nav, Reveal, Verse, PlayPause, ProgressBar |
| ✅ | `apps/api` — 10 bounded contexts | `nest build` limpio; fronteras de módulo verificadas con violaciones deliberadas |
| ✅ | `apps/worker` — BullMQ + MediaProvider | `tsc` limpio; transcodificación pendiente (HU-8.2) |
| ✅ | `supabase/` — 26 tablas, RLS, 5 buckets, seed | `supabase db reset` limpio; 16/16 aserciones de RLS |
| ✅ | `apps/web` — Vite, router por rol, Query, Zustand | `vite build` limpio |
| ✅ | CI/CD | 3 jobs en verde en GitHub Actions, incluida la suite de RLS |
| ✅ | Infraestructura | Supabase migrado; Railway con `api`/`web`/`worker`/`Redis` **Online** |
| ✅ | CodeGraph | 98 archivos, 710 nodos, 1 292 aristas; telemetría desactivada |
| ✅ | ADRs | `docs/decisiones.md` — ADR-001..004, preguntas Q-1..Q-4 |

---

## S0 — Fundaciones

| | Historia | Estado |
|---|---|---|
| ✅ | **HU-0.1** Scaffolding del monorepo | `pnpm install && pnpm build` compila `web`, `api`, `worker` y los 3 packages. `lint`/`typecheck`/`test`/`build` orquestados por Turborepo. |
| ✅ | **HU-0.2** Autenticación base (Supabase + JWKS) | Verificado de punta a punta contra Supabase local (ver tabla abajo). |
| ✅ | **HU-0.3** CI/CD a Railway + migraciones | Un merge a `main` aplica las migraciones y despliega `api`, `worker` y `web` **automáticamente**, con smoke test del health check. Verificado en el run de Deploy #7. Queda el token de `staging` (el paso se omite con aviso, sin romper el pipeline). |
| ✅ | **HU-0.4** Design system base y tokens | Preset de Tailwind + `packages/ui`. Página de muestra en `/kit-ui`. *Sin `Marquee`*: no existe en la landing y choca con su estética (Q-1). |
| ✅ | **HU-0.5** CodeGraph indexado | `codegraph status` → 710 símbolos. Uso documentado en `AGENTS.md` §5. |
| ⬜ | **HU-1.1** Perfil de usuario | `GET/PATCH /users/me` implementados. Falta la subida de avatar al bucket y la pantalla. |

### Sprint S2 — Discipulado II & Aprobación ✅

Hito demostrable cumplido: **el maestro crea un borrador → lo envía → el admin lo aprueba → el estudiante lo ve publicado; todo auditado en `course_reviews`.**

- **HU-4.3** Autoría de cursos: crear borrador (nace en DRAFT), añadir módulos y lecciones. Solo se edita la estructura en DRAFT o REJECTED.
- **HU-4.4** Vista de estudiante: el maestro previsualiza su curso en cualquier estado; un tercero no puede.
- **HU-5.1/5.2/5.3** Flujo de aprobación completo. Toda transición pasa por `canTransition` (shared-types); **no existe DRAFT→PUBLISHED**. La decisión del admin se audita en `course_reviews` (un rechazo exige notas). Eventos `CourseSubmitted`/`CourseReviewed`/`CoursePublished`.
- **notifications**: nuevo bounded context que escucha esos eventos y notifica a los admins (envío) y al maestro (decisión), sin importar ningún módulo ajeno.

**Backend:** `CourseAuthoringService` + `course_reviews` + módulo `notifications`. **11 tests de dominio** de la máquina de estados (incluida la regla inviolable). Verificado contra el API real (`apps/api/e2e/s2-flow.mjs`, 24 aserciones): creación, envío, notificación al admin, imposibilidad de autopublicar, aprobación, auditoría, notificación al maestro, publicación, visibilidad para el estudiante, y el flujo de rechazo con notas.

**Frontend:** «Mis cursos» + editor (módulos/lecciones, enviar, publicar, notas de rechazo), cola de revisión del admin (tomar, aprobar, rechazar con notas). Verificado en Chromium (`apps/web/e2e/s2-milestone.mjs`): el hito completo de punta a punta.

### Sprint S1 — Identidad & Discipulado I ✅

Hito demostrable cumplido: **un estudiante ve el catálogo de su nivel, se inscribe y completa una lección con el progreso guardado.**

- **HU-4.1** Catálogo por nivel e inscripción. El catálogo devuelve todos los cursos publicados; los de nivel superior llegan marcados `unlocked:false` con su motivo. La inscripción valida nivel (403 legible) y es idempotente.
- **HU-4.2** Consumo de lecciones y progreso. `POST /lessons/:id/complete` es idempotente y transaccional; recalcula `progress_pct` desde el recuento real. El medio privado de una lección solo se autoriza al inscrito (base de HU-8.3).
- **HU-1.3** Niveles y mentoría. `GET /users/my-students` (MAESTRO) lista a sus estudiantes con su nivel.
- **HU-1.2** Gestión de roles. `GET /users` + `PATCH /users/:id/role` (ADMIN) con pantalla en `/admin/usuarios`.

**Backend:** módulo `discipleship` completo (4 capas), `course` registrado en el `PolicyRegistry`, **13 tests de dominio** con repos en memoria. Verificado contra el API real: catálogo, inscripción idempotente, progreso 33→67→100%, persistencia, 403 por nivel con un curso de nivel 3 real.

**Frontend:** catálogo (`CatalogoPage`), course shell con sidebar de lecciones y barra de progreso (`CursoPage`), panel de roles (`UsuariosPage`), mis estudiantes (`EstudiantesPage`). Verificado en Chromium con `apps/web/e2e/s1-milestone.mjs` — el flujo completo del hito, incluida la **persistencia del progreso tras recargar**.

### HU-9.1 — Migración de la landing (adelantada de S6)

La landing original se portó a React **sin tocar el diseño**: mismos videos, mismos versículos, mismos scrims, mismo scrub. Único añadido: la entrada a la plataforma (`Crear cuenta` en el nav y `Crear mi cuenta` en el cierre, ambos a `/entrar?registro=1`).

Verificado en Chromium con `apps/web/e2e/landing.check.mjs` — **47 aserciones** (landing + login):

- Estructura: 4 capas de video, 5 overlays, contador lateral, indicador de scroll.
- Identidad: fondo `#0a0a0a`, cuerpo en Space Mono, versículo en Newsreader.
- **Scrub real**: el `currentTime` del video avanza al scrollear (`0.00s → 2.50s`) y el video **no se reproduce solo**.
- Crossfade entre capítulos y overlay de cierre.
- El CTA navega a `/entrar?registro=1` y el formulario arranca en modo registro.
- `prefers-reduced-motion` desactiva Lenis y el capítulo 01 sigue visible.
- Cero errores de JavaScript en consola.
- **Login**: la fotografía limpia es el fondo y la banda oscura se dibuja con `PanelCurvo` (SVG). El input arranca siempre a la derecha del vértice de la curva, comprobado a 1024, 1440 y 2560 px. En móvil el panel se retira y el formulario se apoya sobre la foto.

Se mantiene GSAP + ScrollTrigger + Lenis (ADR-003), cargados en un chunk aparte (142 KB) que solo se descarga en `/`.

### Evidencia de HU-0.2

Ejecutado contra el stack local (`supabase start` + `node dist/main.js`):

| Caso | Esperado | Obtenido |
|---|---|---|
| `GET /api/health` (ruta `@Public`) | 200 | ✅ 200 |
| `GET /api/users/me` sin token | 401 | ✅ 401 |
| `GET /api/users/me` con token malformado | 401 | ✅ 401 |
| `GET /api/users/me` con **JWT HS256** firmado con el secreto legacy | 401 | ✅ 401 |
| `GET /api/users/me` con **JWT ES256** verificado por JWKS | 200 + perfil | ✅ 200, `role=ESTUDIANTE`, `levelRank=2` |
| Registro → fila en `profiles` con rol `ESTUDIANTE` | sí | ✅ trigger `crear_perfil_al_registrarse` |
| `PATCH /users/:id/role` como ESTUDIANTE | 403 | ✅ 403 (`RolesGuard`) |
| `PATCH /users/:id/role` con rol inexistente | 400 | ✅ 400 (`ZodValidationPipe`) |
| `PATCH /users/:id/role` como ADMIN | 200 | ✅ 200 |

### Evidencia de RLS (`supabase/tests/rls.test.sql`)

16 aserciones, todas en verde. Las relevantes:

- 26/26 tablas con RLS activo y **forzado**.
- Esteban (nivel 1) y Ester (nivel 2) **no ven** un curso de nivel 3; el maestro dueño y el admin sí.
- Un ESTUDIANTE **no puede** ascenderse a ADMIN ni subirse de nivel solo — pero **sí** edita su nombre.
- Un MAESTRO **no puede autopublicar** su curso; **sí** puede enviarlo a revisión.
- El autor **no puede** revertir la ocultación por moderación de su tarjeta.
- Un no inscrito lee 0 lecciones; una inscrita lee las 3.
- Un tercero ve 0 mensajes de una conversación ajena; el mentor y el admin, 1.
- Un estudiante solo ve canciones `is_published = true`.

---

## Sprints siguientes

Ninguna historia empezada. El esqueleto de módulos y las rutas placeholder ya señalan dónde va cada una.

| Sprint | Historias | Estado |
|---|---|---|
| **S1** Identidad & Discipulado I | HU-1.2 ✅, HU-1.3 ✅, HU-4.1 ✅, HU-4.2 ✅ | ✅ |
| **S2** Discipulado II & Aprobación | HU-4.3 ✅, 4.4 ✅, 5.1 ✅, 5.2 ✅, 5.3 ✅ · (4.5 pendiente) | ✅ |
| **S3** Medios & Feed | HU-8.1, 8.2, 8.3, 3.1, 3.3 | ⬜ |
| **S4** Feed social & Chat | HU-3.2, 3.4, 6.1, 6.2 | ⬜ |
| **S5** Alabanza | HU-2.1 🟡 *(store + player bar)*, 2.2, 2.3, 2.4 | ⬜ |
| **S6** Admin & Landing & Hardening | HU-7.1, 7.2, **HU-9.1 ✅**, + RNF | 🟡 |

---

## Infraestructura viva

| Recurso | Estado |
|---|---|
| Repositorio | https://github.com/Jair-Roman-Mauricio/Elcaminoangosto · `main` y `develop` protegidas |
| Supabase | `gcxewueeidygglprxigx` (us-east-2) · 4 migraciones aplicadas · JWKS **ES256** |
| Railway `api` | https://api-production-f113.up.railway.app · **Online** |
| Railway `web` | https://web-production-551e4.up.railway.app · **Online** |
| Railway `worker` | **Online** |
| Railway `Redis` | **Online** |

### Verificación en producción (no solo en local)

| Prueba | Resultado |
|---|---|
| Registro → trigger crea `profiles` con rol `ESTUDIANTE` | ✅ |
| Login → token **ES256** | ✅ |
| `GET /api/users/me` en Railway verificando por JWKS | `200` + perfil |
| Sin token / token basura | `401` |
| 26/26 tablas con RLS en el proyecto remoto | ✅ (64 políticas) |
| `profiles.role` actualizable por `authenticated` | **No** — protegido por privilegio de columna |

## Bloqueos actuales

| # | Bloqueo | Qué desbloquea | Acción del responsable humano |
|---|---|---|---|
| 1 | `RAILWAY_TOKEN` de `staging` ausente | Despliegue automático a staging desde `develop` | Los project tokens de Railway son por entorno. Crear el de `staging` y `gh secret set RAILWAY_TOKEN --env staging` |
| 2 | Staging y producción comparten proyecto Supabase | Aislar datos antes de tener usuarios reales | Crear un segundo proyecto y separar `SUPABASE_PROJECT_REF` por entorno |
| 3 | Credenciales expuestas en el chat de desarrollo | — | **Rotar** el Personal Access Token de Supabase y la contraseña de la BD |

Todo el desarrollo local funciona sin ninguno: `supabase start` levanta Postgres, Auth, Storage y Realtime.
