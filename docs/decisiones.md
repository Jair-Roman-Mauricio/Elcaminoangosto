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

## Preguntas abiertas

| ID | Pregunta | Estado | Propuesta por defecto |
|---|---|---|---|
| **Q-1** | HU-0.4 exige un componente `Marquee` que no existe en la landing y choca con su estética sobria. ¿Se descarta, o se rediseña con la nueva identidad? | Abierta | **Descartarlo.** No se implementa. Si el Product Owner lo quiere, entra como historia nueva. |
| **Q-2** | HU-3.3 deja explícitamente sin definir si las Tarjetas de Fe de un MAESTRO requieren aprobación previa del ADMIN. | Abierta | **Publicación directa + moderación posterior**, configurable por ADMIN — el valor por defecto que el propio backlog sugiere. Los **cursos** sí requieren aprobación siempre (regla inviolable de `contexto.md`). |
| **Q-3** | ¿Existen ya un proyecto Supabase y un proyecto Railway a los que enlazar? | Abierta | El andamiaje se entrega con `.env.example` y migraciones versionadas **sin aplicar**. Requiere credenciales del responsable humano. |
| **Q-4** | `gh` no está autenticado, por lo que no se puede hacer `push` a `github.com/Jair-Roman-Mauricio/Elcaminoangosto`. | Abierta | Commits creados en local sobre `main`; el `push` queda pendiente de `gh auth login`. |
