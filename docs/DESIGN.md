# DESIGN.md — Sistema de diseño de El Camino Angosto

> **Fuente de verdad visual.** Tailwind, `packages/ui` y todo `apps/web` deben implementar estos tokens.
>
> **Reescrito el 2026-07-09** (ver `decisiones.md` → **ADR-001**). La versión anterior describía una identidad ("meteorite-black / warm-white / solar-orange", tipografías Phonic + Owners Text, curvas *spring* con rebote, marquees, Webflow/Smootify) que **no correspondía a la landing de este repositorio**: ninguno de esos tokens existía en el código. Este documento está derivado, token por token, de la landing real que ahora vive en [`docs/legacy-landing/`](./legacy-landing/) (`styles.css`, `script.js`).

---

## 1. Principios visuales

1. **Editorial y cinematográfico**: la landing es un recorrido de video a pantalla completa con texto sobrepuesto. La sensación es de cine y de revista, no de app.
2. **Monocromático con dos acentos**: negro cálido + hueso. `vino` y `marino` se usan **con moderación** (hover, énfasis, estados).
3. **Aire**: mucho espacio negativo. La jerarquía nace de la tipografía y el espacio, no de bordes ni sombras.
4. **Movimiento lento y sin rebote**: la curva de la landing es un ease-out puro (`cubic-bezier(.22,.61,.36,1)`) con transiciones largas (0.9 s). **No hay rebote.** Nunca introduzcas curvas *springy*.
5. **Mono como voz por defecto**: el cuerpo de la landing es Space Mono. El serif (Newsreader) está reservado a los **versículos**.
6. **Móvil primero**: el feed y la música se diseñan para el pulgar; el escritorio expande, no rediseña.

## 2. Tokens de color

Valores exactos de `docs/legacy-landing/styles.css`.

```css
:root {
  /* — Base — */
  --negro:  #0a0a0a;   /* fondo global */
  --hueso:  #f7f6f2;   /* texto principal */

  /* — Acentos (usar con moderación) — */
  --vino:   #b41e44;   /* acción, hover, énfasis devocional, peligro */
  --marino: #1b3460;   /* estados fríos, enlaces sutiles, gráficos */

  /* — Derivados del hueso (opacidades) — */
  --texto:        var(--hueso);
  --texto-tenue:  rgba(247, 246, 242, 0.55);  /* metadatos, secundario */
  --texto-debil:  rgba(247, 246, 242, 0.35);  /* pie, deshabilitado */
  --linea:        rgba(247, 246, 242, 0.15);  /* bordes */
  --linea-fuerte: rgba(247, 246, 242, 0.40);  /* bordes con foco */

  /* — Superficies elevadas (extensión para la app) — */
  --superficie-0: #0a0a0a;  /* = negro; fondo */
  --superficie-1: #101010;  /* tarjetas, player bar */
  --superficie-2: #181818;  /* modales, dropdowns, hover de fila */

  /* — Semánticos de estado (extensión para la app) — */
  --exito:   #2e7d5b;
  --aviso:   #c9862b;
  --peligro: var(--vino);
}
```

**Detalles de la landing que se conservan:**
- **Selección de texto**: fondo `vino`, texto `hueso`.
- **Foco visible**: `outline: 1px solid var(--hueso); outline-offset: 4px;` — nunca `outline: none`.
- El acento `vino` en hover se usa **al 12% de opacidad como fondo** más el borde a color sólido (`.nav__cta`), o como fondo sólido con texto hueso (`.boton`).

> **Tema claro/oscuro (ADR-007).** La app tiene dos temas con el **claro por defecto**, mediante tokens semánticos (`--fondo`, `--contenido`, `--superficie-*`, `--linea`) que cambian con `data-theme` en `<html>`. Los acentos de marca (`vino`, `marino`) y los absolutos (`negro`, `hueso`) son fijos. **La landing, el login y las secciones de video del feed se fuerzan a oscuro** (experiencias inmersivas). El toggle vive en el nav; la elección persiste en `localStorage`.

**Única excepción documentada:** `#0d1117`, el negro azulado del panel del login (`apps/web/src/pages/panel-curvo.tsx`). No es un token ni un tercer acento: existe solo ahí, para que el panel continúe la atmósfera fría de la fotografía en vez de cortar contra el `--negro` puro. No lo uses en ningún otro sitio.

## 3. Tipografía

Dos familias, ambas libres y ya cargadas por la landing desde Google Fonts:

| Rol | Familia | Uso |
|---|---|---|
| **Mono** (por defecto) | `Space Mono` (400, 700) | cuerpo, nav, botones, eyebrows, metadatos, títulos de capítulo |
| **Serif** | `Newsreader` (300, 400, italic 300) | **solo versículos bíblicos** y citas editoriales |

```css
--mono:  "Space Mono", ui-monospace, "SFMono-Regular", Menlo, monospace;
--serif: "Newsreader", Georgia, "Times New Roman", serif;
```

### Escala base

La landing usa **`body { font-size: 16px }`** — base estándar del navegador, `1rem = 16px`.
**No** se aplica el truco `html{font-size:62.5%}`; los tamaños se expresan en `rem` sobre 16px.

### Tracking (letter-spacing) — firma visual

```css
--track-label:  0.14em;  /* eyebrows, nav, microlabels */
--track-boton:  0.10em;  /* botones */
--track-titulo: 0.01em;  /* títulos */
```

### Escala tipográfica

| Token | Tamaño | Familia | Uso |
|---|---|---|---|
| `text-display` | `clamp(2rem, 6vw, 4.5rem)` | mono | portadas de la app |
| `text-h-xl` | `clamp(1.6rem, 3.5vw, 3.2rem)` | mono | título de capítulo (landing), hero |
| `text-h-l` | `2rem` | mono | títulos de sección |
| `text-h-m` | `1.5rem` | mono | subtítulos |
| `text-h-s` | `1.25rem` | mono | encabezado de tarjeta |
| `text-verse` | `clamp(1.0625rem, 1.55vw, 1.6rem)` | **serif** 300 | versículo, `line-height: 1.55` |
| `text-body-l` | `1.125rem` | mono | cuerpo grande |
| `text-body` | `1rem` | mono | cuerpo por defecto, `line-height: 1.5` |
| `text-body-s` | `0.8125rem` | mono | secundario, marca del nav |
| `text-label` | `0.6875rem` | mono | botones pequeños, meta del nav |
| `text-eyebrow` | `0.625rem` | mono | **uppercase + `--track-label`** |

> **Eyebrow** = el microlabel mono en mayúsculas de la landing (`CAPÍTULO 01 — EL DESIERTO`). Lleva una **regla de 2.5 rem** dibujada con `::after`. Es la firma visual del sistema: úsala para categorizar (`DISCIPULADO`, `ALABANZA`, `NIVEL 3`).

## 4. Espaciado, formas y layout

```css
/* Ritmo vertical */
--aire-xs: 0.75rem;  --aire-s: 1.25rem;  --aire-m: 2rem;  --aire-l: 3.5rem;

/* Canalón lateral, fluido */
--gutter: clamp(1.5rem, 5vw, 5rem);   /* móvil (≤820px): 1.5rem fijo */

/* Formas */
--radius: 0.8rem;
--borde:  1px solid var(--linea);
```

**Breakpoints.** La landing solo distingue uno (`820px`). Para la app se adopta la escala que exige `BACKLOG.md` (RNF-8) y se conserva el de la landing:

| Alias | Ancho | Origen |
|---|---|---|
| `xs` | `479px` | RNF-8 |
| `sm` | `767px` | RNF-8 |
| `cine` | `820px` | **landing** — colapsa el contador lateral y centra los overlays |
| `md` | `991px` | RNF-8 |
| `xl` | `1600px` | RNF-8 |

**Grid**: contenedor centrado con `--gutter`. Grid de 12 columnas con utilidades *split* para layouts editoriales (texto + media).

## 5. Motion

La firma de movimiento es **una sola curva**, lenta y sin rebote. Cópiala literalmente.

```css
--ease: cubic-bezier(0.22, 0.61, 0.36, 1);  /* ease-out, sin rebote */
--fade: 0.9s;                                /* transición por defecto */
```

> ⚠️ La curva *spring* con rebote (`cubic-bezier(0.4,1.35,0.5,0.97)`) descrita en la versión anterior de este documento **no existe en la landing** y contradice su comentario fuente: *"Movimiento: lento, ease-out, sin rebote"*. No la uses.

**Librerías reales de la landing:** GSAP 3.12 + ScrollTrigger + **Lenis** (smooth scroll). No hay Webflow, Smootify ni marquees.

**Patrones a replicar** (con Framer Motion en `packages/ui`, o GSAP donde el scrub lo exija):

- **Cross-fade de capas de video** al hacer scroll (`.video-layer.is-active` → `opacity 1`).
- **Scrub de video por scroll**: cada capítulo consume ~10 s de video a lo largo de `260vh`.
- **Reveal de overlay**: `opacity` + `translateY` con `--ease`, escalonado por bloque.
- **Contador de capítulos** lateral: el ítem activo pasa de `opacity .5` a `1`.
- **Botón**: en hover, `border-color` → `vino` y fondo → `vino` (o `rgba(vino,.12)` en la variante del nav). Es un **fill**, no un *wipe* de subrayado.
- **Play/pause morph**: transición del icono para el reproductor de música y el video del feed. *(Componente nuevo; no existe en la landing.)*

**`prefers-reduced-motion`** (obligatorio, RNF-6): la landing reduce `--fade` a `0.25s`, **desactiva Lenis por completo** y salta los reveals. Replícalo: sin smooth-scroll, sin scrub, transiciones cortas.

## 6. Componentes base (design system → `packages/ui`)

**Derivados de la landing** (existen hoy, migrarlos fielmente):

- **Eyebrow** — microlabel mono uppercase con regla `::after`.
- **BrandLogo** — símbolo de puerta angosta + cruz + camino, con lockup horizontal `ElCaminoAngosto`; variantes `light`, `dark`, `wine` y `adaptive` para landing, login y plataforma.
- **Boton** — variantes `primary` (borde `linea-fuerte`, fondo `rgba(negro,.2)`; hover → fondo `vino`) y `sutil` (sin borde, subrayado con `text-underline-offset: .45em`; hover → subrayado `marino`).
- **Nav** — fija arriba, `padding: clamp(1.1rem,2.4vw,2rem) var(--gutter)` respetando `env(safe-area-inset-top)`. Marca + enlaces + CTA. **No tiene altura fija de 8 rem.**
- **Counter** — contador vertical de capítulos (lateral izquierdo; oculto ≤820px).
- **ScrollHint** — indicador inferior con línea en degradado.
- **Overlay** — bloque de texto sobre video, con `scrim` (degradado local, nunca un velo sobre todo el video) y posiciones `top-center | top-left | bottom-left | center | split`.
- **Verse** — versículo en Newsreader 300 + su referencia en eyebrow. En superficies fotográficas puede usar la variante `login`, que fija el texto en hueso y añade subrayado vino para preservar contraste.
- **Stage** — capas de video fijas con viñeta (`stage-vignette`) y `--video-scale: 1.04` (1.06 en móvil) para ocultar barras negras quemadas en los archivos fuente.

**Nuevos, para los módulos de la plataforma** (heredan los tokens de arriba):

- **Card** — tarjeta editorial: thumbnail, eyebrow, título, meta. Base de tarjeta de curso, canción y tarjeta de fe.
- **MediaControls** — play/pause morph, barra de progreso, volumen.
- **PlayerBar** (Spotify-like) — barra inferior persistente sobre `--superficie-1`.
- **FeedViewport** (TikTok-like) — contenedor vertical con `scroll-snap`, controles laterales (like/comentar/compartir), overlay de autor y caption.
- **CourseShell** (Udemy-like) — sidebar de módulos/lecciones + área de contenido + barra de progreso.
- **ChatPanel** — lista de conversaciones + hilo + composer + botón "Solicitar subir de nivel".
- **FormControls** — inputs con borde `--linea`, foco `--hueso` (outline, no glow); `textarea { resize: none }`. En el login, los campos se expresan como líneas inferiores y el CTA como cápsula rellena en `vino`, de color fijo incluso en hover; `IBM Plex Sans` se usa en título y controles para reforzar legibilidad, mientras los eyebrows conservan Space Mono.
- **PanelCurvo** — banda oscura con borde en S para el login. La curva se midió píxel a píxel sobre la obra original y se reproduce con un `path` SVG normalizado (`viewBox 100×100` + `preserveAspectRatio="none"`), no con una imagen: así se estira a cualquier ancho y el formulario nunca se queda sin sitio. Su amplitud se reduce al 70% de la original por esa razón.

### Preset de Tailwind

```js
// packages/config/tailwind-preset.js
export default {
  theme: {
    extend: {
      colors: {
        negro: '#0a0a0a', hueso: '#f7f6f2', vino: '#b41e44', marino: '#1b3460',
        superficie: { 0: '#0a0a0a', 1: '#101010', 2: '#181818' },
        exito: '#2e7d5b', aviso: '#c9862b',
      },
      fontFamily: {
        mono:  ['"Space Mono"', 'ui-monospace', 'Menlo', 'monospace'],
        serif: ['Newsreader', 'Georgia', 'serif'],
      },
      letterSpacing: { label: '0.14em', boton: '0.10em', titulo: '0.01em' },
      borderRadius: { DEFAULT: '0.8rem' },
      transitionTimingFunction: { camino: 'cubic-bezier(.22,.61,.36,1)' },
      transitionDuration: { fade: '900ms' },
      screens: { xs: '479px', sm: '767px', cine: '820px', md: '991px', xl: '1600px' },
    },
  },
}
```

## 7. Migración de la landing HTML → React

La landing usa **GSAP + ScrollTrigger + Lenis** (no Webflow). Plan:

1. **Extraer tokens** → `packages/config` (preset de Tailwind + CSS vars globales). *(Hecho: §2–§5.)*
2. **Componetizar** → `Stage`, `Nav`, `Counter`, `ScrollHint`, `Overlay`, `Verse`, `Boton`, `Eyebrow`.
3. **Mantener GSAP + ScrollTrigger** para el *scrub* de video: Framer Motion no cubre bien el scrubbing de `<video>.currentTime` ligado al scroll. Usar Framer Motion para el resto (reveals, morphs de la app). **Mantener Lenis.**
4. **Assets**: `media/*.mp4` (encodeados), `posters/*.jpg` (preload del primero), favicon SVG inline.
5. **Responsive**: reproducir el breakpoint `820px` y su variante `portrait` (`.chapter` pasa de `260vh` a `240vh`).
6. **Accesibilidad**: foco `1px solid hueso` con `offset 4px`, contraste AA, `alt` en imágenes, navegación por teclado, `prefers-reduced-motion` completo.

## 8. Do / Don't

**Do**
- Usa el *eyebrow* mono con su regla para categorizar todo (es la firma).
- Deja respirar: `--gutter` generoso, pocas cosas por pantalla.
- Un solo acento por acción: `vino` para la principal.
- Pon el *scrim* **solo bajo el texto**, con un degradado direccional; nunca un velo plano sobre todo el video.

**Don't**
- No introduzcas un tercer acento ni un tema claro.
- No sobrecargues de bordes/sombras: la jerarquía es tipografía y espacio.
- **No uses curvas con rebote.** Solo `--ease`.
- No uses el serif fuera de los versículos.
- No inventes tamaños fuera de la escala tipográfica.
