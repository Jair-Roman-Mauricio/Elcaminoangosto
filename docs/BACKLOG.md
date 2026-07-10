# BACKLOG.md — El Camino Angosto (Scrum)

> Producto gestionado con **Scrum**. Este backlog contiene épicas, historias de usuario (formato *Como… quiero… para…*), requisitos funcionales (RF) y no funcionales (RNF), criterios de aceptación (Gherkin: *Dado/Cuando/Entonces*) y un plan de sprints.
>
> **Roles:** ESTUDIANTE, MAESTRO, ADMIN.
> **Estimación:** puntos de historia (Fibonacci: 1,2,3,5,8,13).
> **Definition of Done (DoD)** al final del documento.

---

## Índice de épicas

| ID | Épica | Módulo |
|---|---|---|
| E0 | Fundaciones (monorepo, CI/CD, auth, design system) | plataforma |
| E1 | Identidad, roles y perfiles | users/auth |
| E2 | Alabanza — streaming de música | music |
| E3 | Tarjetas de Fe — feed de video/imagen | feed |
| E4 | Discipulado — cursos por niveles | discipleship |
| E5 | Flujo de aprobación de cursos | discipleship/admin |
| E6 | Chat mentor y subida de nivel | chat |
| E7 | Panel de administración y moderación | admin |
| E8 | Medios — ingesta, transcodificación y entrega | media |
| E9 | Migración de la landing a React | web |

---

## Requisitos no funcionales (globales)

| ID | RNF | Criterio medible |
|---|---|---|
| RNF-1 | Rendimiento de video | Arranque de reproducción < 2 s (p75). |
| RNF-2 | Rendimiento de API | Lecturas cacheables < 300 ms (p95). |
| RNF-3 | Escalabilidad | API stateless; jobs pesados en cola (BullMQ), no en el request. |
| RNF-4 | Seguridad | OWASP Top 10 mitigado; RLS activo; JWT verificado por JWKS; URLs firmadas de corta vida. |
| RNF-5 | Disponibilidad | 99.5% (MVP); health checks y reintentos en jobs. |
| RNF-6 | Accesibilidad | WCAG 2.1 AA en flujos clave; navegación por teclado; `prefers-reduced-motion`. |
| RNF-7 | Observabilidad | Logs estructurados (pino), errores en Sentry, métricas de dominio. |
| RNF-8 | Responsive | Funcional y pulido en 479/767/991/1600px. |
| RNF-9 | Privacidad | Datos personales mínimos; contenido de menores tratado con especial cuidado; consentimiento. |
| RNF-10 | Coste | Preferir servicios gestionados; transcodificación asíncrona; escalar video solo si el volumen lo exige. |
| RNF-11 | Internacionalización | Español por defecto; textos externalizados (i18n-ready). |
| RNF-12 | Calidad | Cobertura de tests ≥ 70% en dominio; lint y typecheck en CI. |

---

## E0 — Fundaciones

**RF asociados:** monorepo pnpm+Turborepo, apps `web`/`api`/`worker`, Supabase provisionado (DB/Auth/Storage/Realtime), CI/CD a Railway, design system base, CodeGraph indexado.

### HU-0.1 — Scaffolding del monorepo
> **Como** equipo de desarrollo **quiero** un monorepo con pnpm y Turborepo con las apps y packages base **para** trabajar de forma consistente y con builds cacheados. **(5 pts)**

**Criterios de aceptación**
- **Dado** el repo recién clonado, **cuando** ejecuto `pnpm install && pnpm build`, **entonces** compilan `apps/web`, `apps/api` y los `packages` sin errores.
- **Dado** el workspace, **entonces** existen `apps/web`, `apps/api`, `apps/worker`, `packages/shared-types`, `packages/config`, `packages/ui` y la carpeta `supabase/`.
- **Entonces** hay `lint`, `typecheck`, `test` y `build` orquestados por Turborepo.

### HU-0.2 — Autenticación base (Supabase + verificación JWKS en Nest)
> **Como** usuario **quiero** registrarme e iniciar sesión de forma segura **para** acceder a la plataforma. **(8 pts)**

**Criterios de aceptación**
- **Dado** un email/contraseña válidos, **cuando** me registro, **entonces** se crea mi cuenta en Supabase Auth y una fila en `profiles` con rol `ESTUDIANTE` por defecto.
- **Cuando** inicio sesión, **entonces** el front obtiene un JWT y lo adjunta como `Bearer` en las llamadas al API.
- **Dado** un JWT, **cuando** llama al API, **entonces** NestJS lo **verifica contra el JWKS** del proyecto (claves asimétricas), no con secreto HS256.
- **Dado** un JWT inválido/expirado, **entonces** el API responde `401`.

### HU-0.3 — CI/CD a Railway + Supabase migraciones
> **Como** equipo **quiero** despliegue automático y migraciones versionadas **para** entregar con seguridad. **(5 pts)**

**Criterios de aceptación**
- **Dado** un push a `develop`, **entonces** se ejecutan lint+test+build y se despliega a *staging* en Railway.
- **Dado** un merge a `main`, **entonces** se despliega a *producción*.
- **Entonces** las migraciones SQL de Supabase se aplican de forma versionada y reproducible.

### HU-0.4 — Design system base y tokens
> **Como** frontend **quiero** el design system con los tokens de `DESIGN.md` **para** construir UI consistente con la marca. **(5 pts)**

**Criterios de aceptación**
- **Entonces** existe el preset de Tailwind con colores, tipografía (escala 10px), gaps y curvas *spring*.
- **Entonces** `packages/ui` expone Button, Eyebrow, Card, Nav y Marquee funcionando en un Storybook o página de muestra.

### HU-0.5 — CodeGraph indexado
> **Como** agente de IA **quiero** el grafo de código indexado **para** navegar el repo con menos tokens. **(2 pts)**

**Criterios de aceptación**
- **Entonces** `codegraph init` genera `.codegraph/` y `codegraph status` reporta símbolos > 0.
- **Entonces** `AGENTS.md` documenta cómo consultarlo.

---

## E1 — Identidad, roles y perfiles

### HU-1.1 — Perfil de usuario
> **Como** usuario **quiero** ver y editar mi perfil (nombre, avatar, bio) **para** representarme en la comunidad. **(3 pts)**
- **Dado** que estoy autenticado, **cuando** subo un avatar, **entonces** se guarda en el bucket `avatars` y se muestra.
- **Entonces** solo yo puedo editar mi perfil (RLS + guard de propiedad).

### HU-1.2 — Gestión de roles (ADMIN)
> **Como** ADMIN **quiero** asignar roles (ESTUDIANTE/MAESTRO/ADMIN) **para** habilitar capacidades. **(3 pts)**
- **Dado** un ADMIN, **cuando** cambio el rol de un usuario, **entonces** sus capacidades se actualizan y queda registro de auditoría.
- **Dado** un no-ADMIN, **cuando** intenta cambiar roles, **entonces** recibe `403`.

### HU-1.4 — Recuperar contraseña
> **Como** usuario **quiero** restablecer mi contraseña por correo **para** recuperar el acceso si la olvido. **(3 pts)**
- **Dado** un correo registrado, **cuando** pido recuperarla, **entonces** recibo un enlace de un solo uso (Supabase `resetPasswordForEmail`).
- **Dado** un correo no registrado, **entonces** la respuesta es idéntica: no se revela si la cuenta existe (enumeración de usuarios, OWASP).
- **Cuando** abro el enlace, **entonces** puedo fijar una contraseña nueva y la sesión anterior se invalida.

> Surgida al rediseñar el login (`/entrar`), que enlaza a `/recuperar`. Sin ella el enlace queda muerto.

### HU-1.3 — Niveles y mentoría
> **Como** MAESTRO **quiero** ser mentor de estudiantes y ver su nivel **para** acompañar su discipulado. **(5 pts)**
- **Entonces** existe `levels` (rank ordenable) y `mentorships` (mentor↔estudiante).
- **Dado** un maestro, **entonces** ve la lista de SUS estudiantes con su nivel actual.

---

## E2 — Alabanza (música)

### HU-2.1 — Reproductor persistente
> **Como** ESTUDIANTE **quiero** reproducir música con una barra persistente **para** escuchar mientras navego. **(8 pts)**
- **Dado** que selecciono una canción, **cuando** pulso play, **entonces** suena y aparece la *player bar* con carátula, título y controles.
- **Cuando** navego entre secciones, **entonces** la reproducción **no se interrumpe**.
- **Entonces** el audio se sirve por **URL firmada** desde el bucket privado `music`.

### HU-2.2 — Catálogo y búsqueda
> **Como** ESTUDIANTE **quiero** explorar artistas, álbumes y buscar **para** encontrar música. **(5 pts)**
- **Cuando** busco por texto, **entonces** obtengo canciones/artistas/álbumes coincidentes.
- **Entonces** solo se muestran canciones `is_published = true`.

### HU-2.3 — Playlists y "me gusta"
> **Como** ESTUDIANTE **quiero** crear playlists y dar "me gusta" **para** organizar mi música. **(5 pts)**
- **Cuando** creo una playlist y añado canciones, **entonces** se persiste con su orden.
- **Cuando** doy "me gusta", **entonces** se registra y puedo ver mis favoritas.

### HU-2.4 — Publicar música (ADMIN)
> **Como** ADMIN **quiero** subir/publicar artistas, álbumes y canciones **para** poblar el catálogo. **(5 pts)**
- **Cuando** subo un audio, **entonces** se ingesta vía pipeline de medios y queda `READY` antes de publicarse.

---

## E3 — Tarjetas de Fe (feed)

### HU-3.1 — Feed vertical
> **Como** ESTUDIANTE **quiero** un feed vertical de videos/imágenes con *snap* **para** consumir contenido devocional fácilmente. **(8 pts)**
- **Dado** el feed, **cuando** deslizo, **entonces** avanza tarjeta a tarjeta (scroll-snap) y el video en foco se reproduce (los demás se pausan).
- **Entonces** el video se sirve por HLS (o MP4 fallback) con URL firmada; arranque < 2 s (p75).

### HU-3.2 — Interacciones (like, comentar, compartir, seguir)
> **Como** ESTUDIANTE **quiero** reaccionar y comentar **para** participar. **(5 pts)**
- **Cuando** doy like/comento/sigo, **entonces** se registra y el contador se actualiza en vivo.
- **Entonces** los comentarios se sanitizan (anti-XSS) y respetan moderación.

### HU-3.3 — Publicar tarjeta (MAESTRO/ADMIN)
> **Como** MAESTRO **quiero** publicar una tarjeta de fe **para** edificar a la comunidad. **(5 pts)**
- **Cuando** subo un video/imagen, **entonces** pasa por el pipeline de medios y se publica al quedar `READY`.
- **Nota de gobernanza:** definir si tarjetas de maestro requieren o no aprobación (por defecto: publicación directa con moderación posterior; configurable por ADMIN).

### HU-3.4 — Reporte y moderación
> **Como** ESTUDIANTE **quiero** reportar contenido **para** mantener la sana doctrina y seguridad. **(3 pts)**
- **Cuando** reporto una tarjeta, **entonces** se marca `REPORTED` y aparece en la cola de moderación del ADMIN.

---

## E4 — Discipulado (cursos)

### HU-4.1 — Catálogo por nivel e inscripción
> **Como** ESTUDIANTE **quiero** ver cursos acordes a mi nivel e inscribirme **para** formarme. **(8 pts)**
- **Dado** mi nivel actual, **cuando** abro el catálogo, **entonces** veo cursos publicados de mi nivel o inferior; los de nivel superior aparecen bloqueados con motivo.
- **Cuando** me inscribo a un curso permitido, **entonces** se crea `enrollment` y accedo a sus lecciones.
- **Dado** un curso gated por nivel/maestro, **cuando** no cumplo, **entonces** recibo `403` con mensaje claro.

### HU-4.2 — Consumo de lecciones y progreso
> **Como** ESTUDIANTE **quiero** ver lecciones (video/texto) y que se guarde mi progreso **para** avanzar. **(5 pts)**
- **Cuando** completo una lección, **entonces** se registra en `lesson_progress` y sube el `progress_pct` del curso.
- **Entonces** los videos de lección se sirven por URL firmada solo si estoy inscrito.

### HU-4.3 — Crear curso (borrador) (MAESTRO)
> **Como** MAESTRO **quiero** crear un borrador de curso con idea y N módulos **para** proponerlo a revisión. **(8 pts)**
- **Cuando** creo un curso, **entonces** nace en estado `DRAFT`, editable libremente.
- **Entonces** puedo definir módulos y lecciones (video/texto) y una miniatura.

### HU-4.4 — Vista de estudiante (MAESTRO)
> **Como** MAESTRO **quiero** previsualizar mi curso como lo ve un estudiante **para** validar la experiencia. **(3 pts)**
- **Cuando** activo "vista de estudiante", **entonces** veo el curso con la UI del alumno (sin controles de edición), incluso en `DRAFT`.

### HU-4.5 — Gestión de mis estudiantes (MAESTRO)
> **Como** MAESTRO **quiero** ver a mis estudiantes y su progreso **para** acompañarlos. **(5 pts)**
- **Entonces** veo, por curso, quién está inscrito, su progreso y última actividad.

---

## E5 — Flujo de aprobación de cursos

### HU-5.1 — Enviar curso a revisión (MAESTRO)
> **Como** MAESTRO **quiero** enviar mi borrador al ADMIN **para** que lo apruebe. **(3 pts)**
- **Cuando** envío, **entonces** el curso pasa `DRAFT → SUBMITTED`, se emite `CourseSubmitted` y se notifica al ADMIN.
- **Dado** un curso `SUBMITTED`, **entonces** el maestro no puede alterar su estructura crítica hasta que se resuelva.

### HU-5.2 — Revisar y aprobar/rechazar (ADMIN)
> **Como** ADMIN **quiero** revisar borradores y aprobarlos o rechazarlos con notas **para** garantizar calidad y doctrina. **(8 pts)**
- **Cuando** tomo un curso, **entonces** pasa `SUBMITTED → UNDER_REVIEW`.
- **Cuando** apruebo, **entonces** pasa a `APPROVED` y puede publicarse (`PUBLISHED`); se notifica al maestro.
- **Cuando** rechazo con notas, **entonces** pasa a `REJECTED`, el maestro ve las notas y puede volver a `DRAFT`.
- **Entonces** cada decisión queda auditada en `course_reviews`.

### HU-5.3 — Publicación
> **Como** ADMIN/MAESTRO **quiero** publicar un curso aprobado **para** que los estudiantes elegibles lo vean. **(3 pts)**
- **Cuando** publico un curso `APPROVED`, **entonces** pasa a `PUBLISHED` y aparece en el catálogo para los niveles habilitados.

---

## E6 — Chat mentor y subida de nivel

### HU-6.1 — Chat 1:1 en tiempo real
> **Como** ESTUDIANTE **quiero** chatear con mi mentor en vivo **para** resolver dudas y ser discipulado. **(8 pts)**
- **Dado** un estudiante y su mentor, **cuando** envío un mensaje, **entonces** llega en tiempo real (Supabase Realtime) y se marca leído/no leído.
- **Entonces** solo los dos participantes (y el ADMIN para moderación) pueden ver la conversación (RLS).

### HU-6.2 — Solicitar subir de nivel
> **Como** ESTUDIANTE **quiero** pedir a mi mentor subir de nivel **para** acceder a más cursos. **(5 pts)**
- **Cuando** solicito, **entonces** se crea `level_up_request (PENDING)` y se notifica al mentor.
- **Cuando** el mentor aprueba, **entonces** mi `current_level` sube, se emite `LevelUpRequestApproved` y se desbloquean cursos del nuevo nivel.
- **Cuando** el mentor rechaza, **entonces** veo el motivo y mi nivel no cambia.

---

## E7 — Panel de administración y moderación

### HU-7.1 — Dashboard de administración
> **Como** ADMIN **quiero** un panel central **para** gestionar cursos, usuarios, contenido y ver métricas. **(8 pts)**
- **Entonces** veo colas de: cursos por revisar, contenido reportado, usuarios; y métricas clave (usuarios activos, cursos publicados, reproducciones).

### HU-7.2 — Moderación de contenido
> **Como** ADMIN **quiero** ocultar/eliminar contenido reportado **para** proteger la comunidad. **(5 pts)**
- **Cuando** resuelvo un reporte, **entonces** puedo ocultar la tarjeta/comentario y notificar (o no) al autor; queda auditado.

---

## E8 — Medios (ingesta, transcodificación, entrega)

### HU-8.1 — Subida reanudable
> **Como** MAESTRO/ADMIN **quiero** subir archivos grandes con reanudación **para** no perder trabajo si se corta la red. **(5 pts)**
- **Cuando** subo con TUS/Uppy, **entonces** puedo pausar/reanudar; al terminar se crea `media_assets (UPLOADED)`.

### HU-8.2 — Pipeline de transcodificación
> **Como** sistema **quiero** transcodificar a HLS y generar miniaturas de forma asíncrona **para** entregar video eficiente. **(8 pts)**
- **Dado** `MediaUploadRequested`, **cuando** el worker procesa, **entonces** genera HLS + poster, marca `READY` y emite `MediaAssetReady`.
- **Dado** un fallo, **entonces** marca `FAILED`, reintenta y notifica.

### HU-8.3 — Entrega segura
> **Como** sistema **quiero** servir medios privados con URLs firmadas de corta vida **para** proteger el contenido gated. **(3 pts)**
- **Cuando** un usuario autorizado pide un medio privado, **entonces** el API emite una URL firmada (~60 min) tras validar permiso/nivel/inscripción.
- **Dado** un usuario no autorizado, **entonces** no obtiene URL (`403`).

---

## E9 — Migración de la landing a React

### HU-9.1 — Migrar landing conservando identidad
> **Como** visitante **quiero** una landing en React fiel a la estética actual **para** conocer y entrar a la plataforma. **(8 pts)**
- **Entonces** hero, franjas, marquees, nav y footer se reconstruyen en React con los tokens de `DESIGN.md`.
- **Entonces** se reemplazan GSAP/Webflow/Smootify por Framer Motion (o GSAP propio) conservando reveals, marquee direccional y *wipe* de botones.
- **Entonces** respeta `prefers-reduced-motion` y es responsive (479/767/991/1600).

---

## Plan de sprints (sugerido, sprints de 2 semanas)

| Sprint | Objetivo | Historias | Entregable demostrable |
|---|---|---|---|
| **S0 – Fundaciones** | Base técnica | HU-0.1..0.5, HU-1.1 | Login funcionando, monorepo desplegado en Railway, design system base, CodeGraph indexado. |
| **S1 – Identidad & Discipulado I** | Roles y cursos base | HU-1.2, 1.3, 4.1, 4.2 | Estudiante ve catálogo por nivel, se inscribe y consume una lección con progreso. |
| **S2 – Discipulado II & Aprobación** | Autoría y gobernanza | HU-4.3, 4.4, 4.5, 5.1, 5.2, 5.3 | Maestro crea borrador → admin aprueba → estudiante lo ve publicado. |
| **S3 – Medios & Feed** | Pipeline + Tarjetas de Fe | HU-8.1, 8.2, 8.3, 3.1, 3.3 | Subir video, transcodificar y verlo en el feed vertical. |
| **S4 – Feed social & Chat** | Interacción y mentoría | HU-3.2, 3.4, 6.1, 6.2 | Likes/comentarios/reportes + chat mentor + solicitud de subir de nivel. |
| **S5 – Alabanza** | Música | HU-2.1, 2.2, 2.3, 2.4 | Reproductor persistente, catálogo, playlists, publicación admin. |
| **S6 – Admin & Landing & Hardening** | Cierre MVP | HU-7.1, 7.2, 9.1 + RNF | Panel admin, moderación, landing migrada, pulido de rendimiento/seguridad/accesibilidad. |

> El orden prioriza el **corazón del producto (discipulado + gobernanza)** antes que música, porque es la propuesta de valor diferencial. Ajustable por el Product Owner.

---

## Definition of Ready (DoR)
Una historia entra a sprint si: tiene criterios de aceptación claros, está estimada, sus dependencias están resueltas o identificadas, y el diseño (si aplica) está enlazado.

## Definition of Done (DoD)
Una historia está "hecha" si:
- Cumple **todos** sus criterios de aceptación.
- Tiene tests (unitarios de dominio y, si aplica, e2e del flujo) y pasa CI (lint, typecheck, test, build).
- Respeta los RNF pertinentes (seguridad, accesibilidad, rendimiento).
- RLS/guards verificados para el recurso tocado.
- Documentación actualizada (contratos API/OpenAPI, y `contexto.md`/`arquitectura.md` si cambia una decisión).
- Revisada por al menos un par y desplegada en staging.
- CodeGraph reindexado (automático en CI o commit hook).
