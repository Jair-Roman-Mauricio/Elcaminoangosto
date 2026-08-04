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

## ADR-010 — Llaves de publicación: excepción autorizada a "los cursos siempre pasan por revisión"

**Fecha:** 2026-07-24 · **Estado:** Aceptada

**Contexto.** La regla de oro (`contexto.md`, AGENTS.md) es que **un curso de maestro nunca se autopublica**: pasa por DRAFT→SUBMITTED→…→APPROVED→PUBLISHED con aprobación del admin. El responsable humano pidió una vía para que **maestros de confianza** publiquen sin esperar revisión, mediante un **código que genera el admin**.

**Decisión.** Introducir **llaves de publicación** (`public.publish_keys`): el admin genera un código de **un solo uso** y se lo entrega a un maestro. Con ese código, el maestro publica su borrador **directo a PUBLISHED**, saltándose SUBMITTED/UNDER_REVIEW/APPROVED. Sigue disponible la vía normal (enviar a revisión) para quien no tenga código.

La transición DRAFT→PUBLISHED por llave **no pasa por `canTransition`**: es un camino aparte, explícito, que solo se abre con una llave válida y no usada. El curso aún exige ≥1 lección. La tabla tiene RLS forzada: solo el admin la gestiona; la validación del maestro ocurre en el API (nunca leyendo la tabla desde el cliente).

**Por qué no viola el espíritu de la regla.** La autorización **sigue siendo del admin**: en vez de revisar cada curso, **pre-autoriza** a ciertos maestros generando llaves. El maestro no puede autopublicar por su cuenta; necesita una llave que solo el admin crea. La máquina de estados de la vía normal queda intacta.

**Consecuencias.**
- El maestro con llave publica al instante; el resto pasa por revisión como antes.
- Cada llave es de un solo uso y queda auditada (`used_by`, `used_course_id`, `used_at`).
- La invariante "no hay DRAFT→PUBLISHED en `canTransition`" se conserva; el bypass es un método dedicado y auditable, no un hueco en la máquina de estados.
- Riesgo aceptado: una llave filtrada permite publicar sin revisión. Mitigación: un solo uso, trazabilidad y que solo el admin las genera.

## ADR-011 — Moderación de cursos ya publicados: lo nuevo nace oculto

**Fecha:** 2026-07-29 · **Estado:** Aceptada

**Contexto.** Un curso publicado sigue vivo: el maestro añade contenido después de la aprobación. Sin control, ese contenido llegaría al alumno sin que nadie lo revise — justo lo que evita el flujo de E5 antes de publicar. La revisión previa (HU-5.2) no sirve aquí: no se puede devolver el curso entero a borrador cada vez que se añade una lección.

**Decisión.** Moderación por **contenido**, no por curso (HU-7.2):

- Toda lección añadida a un curso `PUBLISHED` nace con `moderation_status = 'PENDING'` y **no la ve el alumno** hasta que el admin la apruebe. En borrador/rechazado nace `APPROVED`: allí manda el flujo de revisión.
- El admin aprueba (`APPROVED`) o retira (`BLOCKED`) cada contenido desde Moderación, y puede **bloquear el curso completo** (`courses.blocked`) si el maestro no corrige.
- Un curso bloqueado no aparece en el catálogo, no abre su ficha y no admite inscripciones nuevas. El maestro dueño y el admin sí lo ven: el maestro necesita corregirlo.
- El **denominador del progreso** cuenta solo contenido aprobado; si no, el alumno no podría llegar al 100% mientras algo esté pendiente.
- Cada decisión se registra en `moderation_actions` (bitácora inmutable) y emite `content.moderated`, que `notifications` traduce en aviso al maestro. `LESSON_PENDING` no notifica: entrar en la cola no le exige nada.
- La autorización primaria vive en los guards (solo ADMIN modera); RLS repite el cerrojo: el estudiante no lee cursos bloqueados ni lecciones sin aprobar.

**Por qué no es otra máquina de estados.** `moderation_status` es **ortogonal** a `CourseStatus`: no toca `canTransition` ni la invariante de que un maestro no autopublica. Un curso publicado sigue publicado; lo que se controla es la visibilidad de cada pieza de contenido.

**Consecuencias.**
- El maestro puede seguir enriqueciendo un curso vivo sin pedir permiso para editar, y el alumno nunca ve contenido sin verificar.
- El editor del maestro muestra qué está pendiente y qué está bloqueado; sin eso, el bloqueo sería un mensaje que nadie recibe.
- La bitácora conserva el título de la lección (`lesson_title`) y no tiene FK a `lessons`: la auditoría sobrevive al borrado del contenido.
- Coste: una segunda dimensión de estado sobre las lecciones. Se acepta porque la alternativa —devolver el curso a revisión completa por cada cambio— paraliza cursos publicados.

## ADR-012 — La plataforma cambia a negro y oro; el oscuro pasa a ser el tema base

**Fecha:** 2026-08-04 · **Estado:** Aceptada (decidida por el responsable humano)

**Contexto.** El acento de marca era `vino` (#b41e44), heredado de la landing (ADR-001). El emblema de El Camino Angosto —el sol sobre la cruz, el camino y el disco que los enmarca— no tiene nada de vino: es **oro sobre azul noche**. La plataforma y su propio logotipo decían dos cosas distintas. El responsable humano pidió alinearlas y, con ello, que el **tema oscuro** deje de ser la alternativa.

**Decisión.**

- **El acento pasa a ser el oro del emblema.** `--oro: #e3ac33` (relleno), `--oro-claro: #f6d689` (destello), `--oro-hondo: #8a6212` (oro legible sobre blanco), `--sobre-oro: #0b0a07` (texto encima del relleno) y `--noche: #0c1322` (apoyo frío, antes `marino`).
- **`--acento` es el único acento que cambia con el tema:** en oscuro `#efc25c`, en claro `--oro-hondo`. Existe porque el oro del emblema no se lee sobre blanco. **Los rellenos siguen siendo `--oro` en ambos temas**, siempre con `--sobre-oro` encima: hueso o blanco sobre oro no alcanza contraste.
- **El error deja de compartir color con el acento.** `--peligro` era `var(--vino)`; ahora es `#d0463a`. Un campo inválido en oro se leería como énfasis de marca, no como alarma.
- **Oscuro por defecto** (`:root`); `[data-theme="light"]` invierte. Esto revisa el "claro por defecto" de **ADR-007**; el resto de ADR-007 (tokens semánticos, toggle, pantallas forzadas a oscuro) sigue vigente. El `ThemeProvider` estrena clave de `localStorage` (`ec-tema-2`): la anterior ya tenía `light` grabado para todo el que hubiera entrado, así que nadie habría visto el nuevo tema base.
- **La landing no se migra todavía** (petición explícita). `--vino` y `--marino` siguen definidos en `tokens.css` y en el preset **solo para ella**; no se usan en pantallas nuevas.

**Qué no cambia.** El enum `alabanza_tono` conserva sus valores (`vino`, `marfil`, `azul`): son **identificadores de datos** ya escritos en la base, no colores. Lo que se repinta es lo que dibujan — el tono `vino` se sella ahora en oro profundo. Renombrar el enum exigiría una migración sin beneficio para el usuario.

**Consecuencias.**
- Un solo acento en toda la plataforma, y es el del logotipo.
- Regla nueva y obligatoria: `bg-oro` va siempre con `text-sobreoro`; para texto y trazos, `acento`.
- El tema claro sobrevive como alternativa del interruptor, con el acento en oro profundo.
- Deuda asumida: la landing sigue en vino. Hasta que se migre, conviven dos acentos en el repositorio.

## ADR-013 — La comunidad conversa con un solo nivel de anidamiento

**Fecha:** 2026-08-04 · **Estado:** Aceptada (decidida por el responsable humano)

**Contexto.** Las respuestas de un hilo eran una lista plana: quien contestaba a alguien en concreto tenía que nombrarlo dentro del texto («respondiendo a Caminante 2…»), y al leer no se distinguía qué contestaba a qué.

**Decisión.** `hilo_respuestas` gana `respuesta_padre_id`, y la interfaz sangra la contestación bajo la respuesta a la que pertenece.

- **Un solo nivel.** Se contesta al hilo o a una respuesta suya, **nunca a una contestación**. Una cadena sin fondo obliga a sangrar sin límite y en un móvil la cuarta respuesta acaba en una columna de tres palabras. Con un nivel ya se lee «esto es para aquello», que era el problema; lo demás es hilo nuevo.
- **La regla vive en la base**, en el trigger `hilo_respuestas_un_solo_nivel`, y se repite en el servicio. Es una invariante del dato —una respuesta colgada de otro hilo, o una cadena de tres, dejan la conversación imposible de dibujar—, no una comprobación de una llamada concreta.
- **`on delete cascade` del padre**: retirar una respuesta se lleva sus contestaciones, que sin ella no significan nada.
- El **alias sigue siendo por hilo** («Caminante 2»): anidar no crea identidad nueva ni la hace perseguible entre hilos.
- Una contestación cuyo padre no se ve —lo ocultó un admin— **se dibuja arriba, no desaparece**: moderar un mensaje no debe llevarse por delante lo que otros escribieron debajo.

**Consecuencias.**
- El contador `hilos.respuestas` cuenta todas las respuestas visibles, anidadas incluidas: para el listado lo que importa es cuánta conversación hay.
- La interfaz publica un botón «Responder» por respuesta del hilo; las contestaciones no lo llevan, porque no admiten hijas.
- Coste: una consulta más al responder (buscar el padre y comprobar su nivel). Se acepta: es una lectura por índice primario en una acción que ya escribe.

## ADR-014 — La conversación de la comunidad se anida sin tope; el límite es visual

**Fecha:** 2026-08-04 · **Estado:** Aceptada (decidida por el responsable humano) · **Revisa:** ADR-013

**Contexto.** ADR-013 topó la conversación en un nivel para no tener que sangrar sin fondo. En uso quedó corto de inmediato: quien recibía una contestación no podía responderla y el diálogo se cortaba justo donde empezaba.

**Decisión.** El anidamiento pasa a ser **libre en el dato**, y el tope se muda a la interfaz.

- El trigger `hilo_respuestas_un_solo_nivel` se sustituye por `hilo_respuestas_padre_valido`, que sigue exigiendo padre existente y del mismo hilo, y además **impide ciclos** subiendo por la cadena de antepasados (con un corte a 200 saltos, por si algún dato ya viniera torcido).
- **La sangría se detiene en el nivel 6** (`TOPE_DE_SANGRIA`), el mismo tope que Old Reddit. Más adentro la conversación sigue anidando, pero pegada a esa columna: en un móvil, a la séptima contestación no queda ancho ni para una palabra.
- **El dibujo es una sola línea de hilo**, fina y del color de `--linea`, que baja por la izquierda y entra en cada mensaje con un codo. Se descartaron el recuadro, el fondo propio y la etiqueta «en respuesta a»: tres marcos para decir lo mismo cargaban la pantalla, y dos líneas verticales seguidas se leían como dos sangrías encajadas.
- **Quien abrió el hilo lleva una insignia** «Autor» junto a su alias. Se probó correr sus mensajes a la derecha, pero eso rompía la columna de la línea de hilo, que es lo que ordena la lectura.

**Consecuencias.**
- El render del hilo es recursivo; el árbol se arma en el cliente desde la lista plana que devuelve el servidor.
- Una contestación cuyo padre no se ve —lo ocultó un admin— se dibuja a nivel de hilo en lugar de desaparecer, igual que en ADR-013.
- Queda pendiente, si un hilo crece mucho: plegar ramas («N respuestas más») y paginar. Hoy el hilo se sirve entero.

## Preguntas abiertas

| ID | Pregunta | Estado | Propuesta por defecto |
|---|---|---|---|
| **Q-1** | HU-0.4 exige un componente `Marquee` que no existe en la landing y choca con su estética sobria. ¿Se descarta, o se rediseña con la nueva identidad? | Abierta | **Descartarlo.** No se implementa. Si el Product Owner lo quiere, entra como historia nueva. |
| **Q-2** | HU-3.3 deja explícitamente sin definir si las Tarjetas de Fe de un MAESTRO requieren aprobación previa del ADMIN. | Abierta | **Publicación directa + moderación posterior**, configurable por ADMIN — el valor por defecto que el propio backlog sugiere. Los **cursos** sí requieren aprobación siempre (regla inviolable de `contexto.md`). |
| **Q-3** | ¿Existen ya un proyecto Supabase y un proyecto Railway a los que enlazar? | **Cerrada** (2026-07-10) | Se reutilizó el proyecto Supabase `gcxewueeidygglprxigx` (ya existía en la org `Elcaminoangosto`) y se creó el proyecto Railway `elcaminoangosto` con `api`, `worker`, `web` y Redis en dos entornos. Ver `docs/despliegue.md`. |
| **Q-4** | `gh` no está autenticado, por lo que no se puede hacer `push` a `github.com/Jair-Roman-Mauricio/Elcaminoangosto`. | **Cerrada** (2026-07-10) | Autenticado. `main` y `develop` publicadas y protegidas; el trabajo entra por Pull Request. |
| **Q-5** | Staging y producción comparten el mismo proyecto Supabase. | Abierta | Aceptable sin usuarios reales. Antes de abrir la plataforma, crear un segundo proyecto y separar `SUPABASE_PROJECT_REF` por entorno de GitHub. |
