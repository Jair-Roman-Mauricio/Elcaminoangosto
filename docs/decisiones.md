# decisiones.md — ADRs de El Camino Angosto

Registro de decisiones de arquitectura. Formato corto: **Contexto → Decisión → Consecuencias**.
Las **preguntas abiertas** viven al final del documento.

---

## ADR-001 — La landing real es la fuente de verdad visual, no la versión previa de DESIGN.md

**Fecha:** 2026-07-09 · **Estado:** Aceptada (decidida por el responsable humano)

**Contexto.**
`docs/DESIGN.md` afirmaba estar *"derivado de la landing HTML compartida"* y especificaba: paleta `meteorite-black #14110F` / `warm-white #F4F1EC` / `solar-orange #F0562A`, tipografías Phonic + Owners Text, curva *spring* con rebote `cubic-bezier(0.4,1.35,0.5,0.97)`, componentes Marquee y Nav de `8rem`, atributo `data-section-theme`, base tipográfica de `10px` (`html{font-size:62.5%}`), y la instrucción de *"quitar dependencias Webflow/Smootify"*.

Una verificación con `grep` sobre todo el árbol demostró que **ninguno** de esos tokens ni componentes existe fuera del propio `DESIGN.md`. La landing real (hoy en `docs/legacy-landing/`) usa:

| | DESIGN.md (previo) | Landing real |
|---|---|---|
| Base | `#14110F` / `#F4F1EC` | `--negro #0a0a0a` / `--hueso #f7f6f2` |
| Acento | `solar-orange #F0562A` | `--vino #b41e44` |
| Tipografía | Phonic + Owners Text | Space Mono + **Newsreader** |
| Easing | spring con rebote | `cubic-bezier(.22,.61,.36,1)`, comentado como *"lento, ease-out, **sin rebote**"* |
| Base tipográfica | 10 px | **16 px** |
| Componentes firma | Marquee, Nav 8rem, `data-section-theme` | ninguno existe |
| Libs | Webflow, Smootify, GSAP | GSAP + ScrollTrigger + **Lenis** |

Coincidían exactamente dos valores: `crimson #B41E44` = `--vino` y `navy #1B3460` = `--marino`. El documento estaba derivado de otro sitio (la estética "Vast"), no de esta landing. Lo corrobora `docs/README.md:24`, que instruye *"Pon tu landing HTML actual en `docs/legacy-landing/`"* — un paso que nunca se ejecutó, por lo que ningún documento llegó a ver la landing.

**Decisión.**
La **landing real manda**. Se reescribió `DESIGN.md` por completo, token por token, a partir de `docs/legacy-landing/styles.css` y `script.js`. La plataforma entera (música, feed, cursos, chat) hereda esa identidad: oscura, monocromática, mono por defecto, serif solo para versículos, movimiento lento sin rebote.

**Consecuencias.**
- ✅ Un solo lenguaje visual, anclado en código que existe y que fue diseñado e iterado de verdad.
- ⚠️ **Se contradice deliberadamente la instrucción literal del prompt maestro**, que pedía un preset con `meteorite/warm-white/solar` y *"conservar las curvas de easing spring"*. Esas curvas no existen. Decisión tomada explícitamente por el responsable humano tras exponerle la evidencia.
- La base tipográfica pasa de `10px` a **`16px`**. Toda la escala de `DESIGN.md` §3 se expresa en `rem` sobre 16.
- **No hay tema claro** ni `data-section-theme`. Si se necesita, requiere un ADR nuevo.
- **No se construye el componente `Marquee`** (HU-0.4 lo pedía): no existe en la landing y no encaja con la estética. Ver *Pregunta abierta Q-1*.
- `BACKLOG.md` HU-0.4 y HU-9.1 quedan desactualizados en su redacción; los criterios se reinterpretan contra el nuevo `DESIGN.md`.

---

## ADR-002 — La landing legacy se traslada a `docs/legacy-landing/`

**Fecha:** 2026-07-09 · **Estado:** Aceptada

**Contexto.** La landing (`index.html`, `styles.css`, `script.js`, `scripts/`, `media/`, `posters/`, `videos/`, `netlify.toml`, su `package.json`) vivía en la raíz del repositorio, que ahora debe alojar el monorepo (`apps/`, `packages/`, `supabase/`). `docs/README.md:24` ya prescribía esta ubicación.

**Decisión.** Mover el conjunto a `docs/legacy-landing/`, intacto y ejecutable. Se conserva como **referencia visual viva** durante la migración (HU-9.1), no como código de producción.

**Consecuencias.**
- El monorepo tiene la raíz limpia.
- `videos/` (10 MB, másters) y `media/` (22 MB, encodeados por `scripts/encode.sh`) **sí** se versionan: son necesarios para reproducir la landing.
- `shots/` (58 MB de capturas de QA) queda en `.gitignore`; se regenera con `scripts/capture.mjs`.
- `dist/` y `node_modules/` de la landing se eliminaron (artefactos de build).

---

## ADR-003 — Se mantiene GSAP + ScrollTrigger + Lenis para la landing; Framer Motion para la app

**Fecha:** 2026-07-09 · **Estado:** Aceptada

**Contexto.** `arquitectura.md` §3.2 elige Framer Motion, y el `DESIGN.md` previo pedía *"reemplazar GSAP/ScrollTrigger por Framer Motion"*. Pero el efecto central de la landing es un **scrub de `<video>.currentTime` ligado al scroll**, con `ScrollTrigger({ scrub: true })` y smooth-scroll de Lenis sincronizado al ticker de GSAP.

**Decisión.** Convivencia por dominio de uso:
- **GSAP + ScrollTrigger + Lenis** → exclusivamente la landing (`apps/web/src/landing/`).
- **Framer Motion** → todo lo demás (reveals, morphs de play/pause, transiciones de ruta).

**Consecuencias.**
- Framer Motion no expone un equivalente robusto a `scrub` sobre `currentTime`; forzarlo significaría reescribir el corazón de la landing y perder fidelidad. Coste evitado > coste de una dependencia extra, cargada solo en la ruta `/`.
- GSAP se importa con `lazy` en la ruta de la landing para no penalizar el bundle de la app.
- Ambos deben respetar `prefers-reduced-motion` (RNF-6). Lenis se desactiva por completo, como ya hace la landing.

---

## ADR-004 — RLS se complementa con privilegios de columna

**Fecha:** 2026-07-09 · **Estado:** Aceptada

**Contexto.** Al ejecutar la suite `supabase/tests/rls.test.sql` contra la base local aparecieron dos defectos en las políticas escritas inicialmente:

1. **Las políticas RLS no conceden permisos, los restringen.** Las tablas creadas por nuestras migraciones solo heredaban `REFERENCES, TRIGGER, TRUNCATE` de los *default privileges* de Supabase. Sin `GRANT SELECT/INSERT/UPDATE/DELETE`, Postgres respondía `permission denied for table courses` **antes** de evaluar ninguna política. Toda la capa de autorización estaba muerta.

2. **RLS filtra filas, no columnas.** La política `profiles_editar_el_mio` (`update using (id = auth.uid())`) permitía a un ESTUDIANTE ejecutar `update profiles set role='ADMIN' where id = <yo>` y **ascenderse a administrador**. Verificado empíricamente antes del arreglo. El mismo agujero permitía subirse de nivel solo (desbloqueando cursos) y a un autor revertir la ocultación por moderación de su tarjeta.

**Decisión.** Añadir `supabase/migrations/20260709000150_grants.sql`:

- `GRANT` explícito del DML a `authenticated` (RLS filtra las filas). `anon` queda deliberadamente **sin privilegios**.
- **Privilegios de columna** sobre los campos de gobernanza:
  - `profiles`: solo `display_name, bio, avatar_url` son actualizables por el usuario. `role` y `current_level_id` no.
  - `posts`: solo `caption`. El `status` no (protege la moderación).
  - `courses`: todo menos `teacher_id` y `published_at`.
- Esos campos se mutan **exclusivamente** por el API con `service_role`, que tiene `BYPASSRLS`.

**Consecuencias.**
- La invariante "un maestro nunca autopublica" queda cerrada por **tres** cerrojos independientes: la máquina de estados en `packages/shared-types`, el `with check` de la política RLS y la ausencia del privilegio de columna sobre `published_at`.
- Un ADMIN tampoco puede cambiar roles vía PostgREST directo: debe pasar por el endpoint `PATCH /users/:id/role`. Es intencionado — así queda traza de auditoría.
- `supabase/tests/rls.test.sql` contiene 16 aserciones y **debe correr en CI**. Es el único sitio donde estos agujeros son visibles: ninguno produce error de compilación.

---

## ADR-005 — Registro sin confirmación de correo en el MVP

**Fecha:** 2026-07-10 · **Estado:** Reemplazada por ADR-009

**Contexto.** El proyecto Supabase remoto nacía con la confirmación de correo **activada** (`mailer_autoconfirm: false`). Un usuario recién registrado quedaba `Waiting for verification` y no podía iniciar sesión (`Email not confirmed`). Además, no hay proveedor de correo (SMTP) configurado, así que el correo de confirmación nunca llegaba: el registro era una vía muerta.

**Decisión.** Desactivar la confirmación de correo en el MVP: `mailer_autoconfirm: true`. El `signUp` devuelve sesión al instante y el usuario entra directo. Se aplicó por la Management API sobre el proyecto remoto (`PATCH /v1/projects/{ref}/config/auth`) y ya estaba así en `supabase/config.toml` para local (`[auth.email] enable_confirmations = false`). De paso se corrigió `site_url`, que apuntaba a `http://localhost:3000`, al dominio real del front.

**Consecuencias.**
- ✅ El registro funciona de punta a punta sin infraestructura de correo.
- ⚠️ **Cualquiera puede registrarse con un correo que no le pertenece.** Aceptable en el MVP (sin pagos, sin datos sensibles todavía), pero **antes de abrir la plataforma** hay que: configurar un SMTP propio, reactivar `mailer_autoconfirm: false` y añadir la recuperación de contraseña (HU-1.4).
- El ajuste del remoto vive en el panel/API, **no en git**. `supabase/config.toml` tiene `site_url` local, así que **no se debe hacer `supabase config push`** al remoto sin antes parametrizar las URLs por entorno; sobrescribiría el `site_url` de producción con localhost. Anotado en `docs/despliegue.md`.
- El formulario de `/entrar` muestra ahora feedback explícito: éxito ("¡Cuenta creada! Entrando…") o, si algún día se reactiva la confirmación, el aviso de "revisa tu correo".

---

## ADR-006 — Entrega de medios del feed: MP4 progresivo con faststart, no HLS (todavía)

**Fecha:** 2026-07-11 · **Estado:** Aceptada

**Contexto.** El hito de S3 pide "transcodificar a HLS y verlo en el feed vertical con arranque <2s". Pero servir HLS desde Supabase Storage con **URLs firmadas** (RNF-4, exigido para medio privado) es complejo: cada segmento `.ts` es un objeto independiente y las signed URLs de Supabase son por objeto, así que el manifiesto `.m3u8` tendría que reescribirse firmando N segmentos en cada petición. Es una pieza grande y frágil de construir y verificar bien.

`arquitectura.md` §6 ya prevé esta tensión: *"para el MVP, Supabase Storage + hls.js + worker ffmpeg es suficiente… mover **solo** el video a Cloudflare Stream/Mux **si el volumen lo exige**"*.

**Decisión.** Para el MVP, el worker transcodifica cada video a un **MP4 normalizado con `-movflags +faststart`** (el átomo `moov` al principio → el navegador empieza a reproducir sin descargar el archivo entero) y genera un **póster**. El feed lo sirve por **URL firmada** de corta vida. HTTP Range + faststart dan arranque <2s en clips cortos verticales, y ya está verificado que el hosting sirve Range (206).

La abstracción `MediaProvider` (Strategy) y la generación de derivados quedan preparadas para añadir HLS o `MuxMediaProvider` cuando el volumen de video lo justifique, **sin tocar el dominio**.

**Consecuencias.**
- ✅ Pipeline completo, real y verificable de punta a punta con ffmpeg local.
- ✅ Cumple RNF-1 (<2s p75) para los clips cortos del feed y RNF-4 (URL firmada de corta vida).
- ⚠️ No hay *adaptive bitrate*: un clip largo en una red lenta no baja de calidad. Aceptable para tarjetas de fe (cortas). Cuando el feed crezca, se añade HLS/Mux tras la misma interfaz `MediaProvider`.
- El campo `media_assets.hls_path` queda `null` por ahora; el reproductor usa el MP4 normalizado (guardado en `media_assets.path`, o un derivado).

---

## ADR-007 — Se añade tema claro/oscuro; el claro pasa a ser el tema base

**Fecha:** 2026-07-11 · **Estado:** Aceptada (decidida por el responsable humano)

**Contexto.** ADR-001 fijó una plataforma **oscura de extremo a extremo** ("No existe un tema claro"). El responsable humano pidió ahora un **cambio de tema claro/oscuro con el claro como base**.

**Decisión.** Se introduce un sistema de temas por `data-theme` en `<html>`:

- **Tokens semánticos** en `packages/ui/src/tokens.css`, con dos temas. Cambian con el tema: `--fondo`, `--superficie-0/1/2`, `--contenido` (+ tenue/débil), `--linea` (+ fuerte). Los acentos de marca (`--vino`, `--marino`) y los absolutos (`--negro`, `--hueso`) son **fijos**.
- El preset de Tailwind mapea `bg-fondo`, `text-contenido`, `bg-superficie-*`, `border-linea` (y los alias `text-texto-*`) a esas variables, así que las clases existentes se vuelven theme-aware.
- **Claro por defecto** (`:root`); `[data-theme="dark"]` invierte. El `ThemeProvider` persiste la elección en `localStorage`; un toggle sol/luna vive en el nav de la app.
- **La landing y el login se fuerzan a oscuro** con su propio `data-theme="dark"`: son experiencias inmersivas sobre video/fotografía oscura donde un tema claro no tiene sentido. Las secciones de video del feed también (overlays claros sobre video oscuro).

**Consecuencias.**
- ✅ Tema claro/oscuro con base clara, persistente, sin recargar. Respeta `prefers-reduced-motion` (la transición de color se anula).
- La hoja de la landing pasa de estilar `body` a `.landing-root`: si no, el chunk lazy de la landing forzaría fondo oscuro al resto de la app una vez visitada.
- Los botones de marca (relleno `vino`) conservan texto `hueso` (blanco fijo) en hover, legible sobre el acento en ambos temas.
- **ADR-001 queda revisado** en su punto "no hay tema claro"; el resto (paleta, tipografía, easing) sigue vigente. `DESIGN.md` §2 se actualiza.

---

## ADR-008 — La marca adopta un lockup de símbolo + wordmark

**Fecha:** 2026-07-14 · **Estado:** Aceptada

**Contexto.** La landing y el login usaban texto y una cruz aislada como marca. Eso no daba un identificador único ni una versión consistente para la plataforma, el favicon y los tamaños pequeños.

**Decisión.** La identidad usa un símbolo SVG de puerta angosta, cruz y camino convergente, acompañado por el wordmark `ElCaminoAngosto`. El sistema se entrega en variantes de color claro, oscuro y vino, además de un lockup horizontal y un mark independiente. El componente `BrandLogo` vive en `packages/ui` y se reutiliza en landing, login, cabecera móvil y sidebar.

**Consecuencias.** La marca es legible y escalable sin depender de una imagen raster. La exploración raster queda documentada en `apps/web/public/brand/logo/el-camino-logo-exploraciones.png`; los SVG son los assets de producción.

---

## ADR-009 — El correo debe confirmarse antes de iniciar una sesión

**Fecha:** 2026-07-21 · **Estado:** Aceptada

**Contexto.** La recuperación de contraseña depende de que el usuario controle una dirección real. El registro sin confirmación permitía crear cuentas con correos inexistentes o ajenos y dejaba a esas personas sin una vía de recuperación.

**Decisión.** Reactivar la confirmación de Supabase (`mailer_autoconfirm: false`), enviar cada registro a `/verificar-correo` y considerar inválida en el cliente cualquier sesión que no tenga `email_confirmed_at`. El despliegue aplica la configuración de Auth y conserva en la lista permitida las rutas de verificación y recuperación de todos los entornos conocidos.

**Consecuencias.**
- El registro solo se completa cuando el usuario abre el enlace recibido.
- Los correos inexistentes no pueden activar una cuenta ni recuperar su contraseña.
- Producción necesita SMTP propio para una entrega fiable y límites adecuados.
- Las cuentas creadas anteriormente con confirmación automática conservan su estado de Supabase; deben auditarse o corregirse administrativamente si se sospecha que usan correos falsos.

## Preguntas abiertas

| ID | Pregunta | Estado | Propuesta por defecto |
|---|---|---|---|
| **Q-1** | HU-0.4 exige un componente `Marquee` que no existe en la landing y choca con su estética sobria. ¿Se descarta, o se rediseña con la nueva identidad? | Abierta | **Descartarlo.** No se implementa. Si el Product Owner lo quiere, entra como historia nueva. |
| **Q-2** | HU-3.3 deja explícitamente sin definir si las Tarjetas de Fe de un MAESTRO requieren aprobación previa del ADMIN. | Abierta | **Publicación directa + moderación posterior**, configurable por ADMIN — el valor por defecto que el propio backlog sugiere. Los **cursos** sí requieren aprobación siempre (regla inviolable de `contexto.md`). |
| **Q-3** | ¿Existen ya un proyecto Supabase y un proyecto Railway a los que enlazar? | **Cerrada** (2026-07-10) | Se reutilizó el proyecto Supabase `gcxewueeidygglprxigx` (ya existía en la org `Elcaminoangosto`) y se creó el proyecto Railway `elcaminoangosto` con `api`, `worker`, `web` y Redis en dos entornos. Ver `docs/despliegue.md`. |
| **Q-4** | `gh` no está autenticado, por lo que no se puede hacer `push` a `github.com/Jair-Roman-Mauricio/Elcaminoangosto`. | **Cerrada** (2026-07-10) | Autenticado. `main` y `develop` publicadas y protegidas; el trabajo entra por Pull Request. |
| **Q-5** | Staging y producción comparten el mismo proyecto Supabase. | Abierta | Aceptable sin usuarios reales. Antes de abrir la plataforma, crear un segundo proyecto y separar `SUPABASE_PROJECT_REF` por entorno de GitHub. |
