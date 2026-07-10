# El Camino

Landing cristiana de una sola página. El scroll **reproduce** el video
fotograma a fotograma (scrub), y al pasar de capítulo funde al siguiente clip.
Encima, una UI editorial minimalista en tipografía monoespaciada.

Estático puro: HTML + CSS + JS. GSAP/ScrollTrigger y Lenis por CDN.

---

## Correrlo en local

> **No sirve `python3 -m http.server`.** No soporta HTTP Range, y sin Range el
> navegador no puede buscar dentro del video: `video.seekable` queda vacío,
> asignar `currentTime` no hace nada y el scrub se queda congelado en el primer
> fotograma. Es el fallo más fácil de sufrir en este proyecto.

```bash
pnpm install
pnpm dev        # http://localhost:4173  (servidor con Range, scripts/serve.mjs)
```

Cualquier servidor con Range vale: `npx serve`, `php -S`, Caddy, nginx…

## Desplegar en Netlify (arrastrando la carpeta)

```bash
pnpm build       # arma dist/  (~20 MB)
pnpm preview     # opcional: pruébalo en http://localhost:4174
```

Y arrastra **`dist/`** a <https://app.netlify.com/drop>. Ya está: no hay build
en Netlify, y sirve HTTP Range de fábrica, que es lo único que el scrub necesita.

No arrastres la carpeta del proyecto: subiría `node_modules/`, `shots/` y los
`videos/` originales — cientos de MB que el sitio no usa. `dist/` lleva solo
`index.html`, `styles.css`, `script.js`, `media/`, `posters/` y `netlify.toml`
(que fija el cacheo: HTML siempre fresco, videos una semana).

> Después del primer deploy, cambia `og:image` en `index.html` por la URL
> absoluta de tu dominio (`https://tu-sitio.netlify.app/posters/1.jpg`). Los
> scrapers de redes sociales no resuelven rutas relativas.

Cualquier otro hosting estático vale igual (Vercel, Cloudflare Pages, GitHub
Pages): todos sirven Range.

---

## Estructura

```
index.html            marcado, SEO, Open Graph, carga de fuentes y CDNs
styles.css            todo el diseño; las variables viven en :root
script.js             CHAPTERS (contenido) + scrub + crossfade
netlify.toml          cacheo; viaja dentro de dist/
videos/1..4.mp4       los clips originales (fuente, NO se despliegan)
media/1..4.mp4        los clips preparados para scrub — es lo que carga la web
posters/1..4.jpg      primer fotograma de cada clip, usado como poster
scripts/              servidor local, codificación, build y tests
dist/                 lo que se arrastra a Netlify (lo genera `pnpm build`)
```

| comando | qué hace |
|---|---|
| `pnpm dev` | servidor local con Range en `:4173` |
| `pnpm media` | `videos/` → `media/` + `posters/` |
| `pnpm build` | arma `dist/` |
| `pnpm preview` | sirve `dist/` en `:4174` |
| `pnpm scrub` | test del scrub y su tope de velocidad |
| `pnpm shots` | barrido visual → `shots/` |

---

## Editar los textos

Todo el contenido está en un solo sitio: el objeto `CHAPTERS` al inicio de
[script.js](script.js). Un capítulo se ve así:

```js
{
  numero: "01",
  lugar:  "El desierto",
  video:  "media/1.mp4",
  poster: "posters/1.jpg",
  titulo: "El principio del camino",
  verso:  "Y el Espíritu le llevó al desierto…",
  ref:    "Marcos 1:12",
  pos:    "split",
  velocidad: 1,     // opcional; ver "Velocidad"
}
```

El cierre (CTA) es el objeto `CIERRE`, justo debajo. Ahí cambias el texto del
botón y los `href` — vienen como `"#"`.

### `pos` — dónde va el texto sobre el video

Se elige para **no tapar la figura** de cada escena:

| valor | dónde queda el texto | úsalo cuando |
|---|---|---|
| `split` | título arriba, versículo abajo | la figura ocupa el centro (hero) |
| `top-center` | bloque arriba, centrado | hay cielo limpio arriba |
| `top-left` | columna arriba a la izquierda | la figura o su rostro están arriba al centro |
| `bottom-left` | columna abajo a la izquierda | la figura ocupa el centro |
| `center` | bloque centrado | el centro es luz, no figura |

En móvil las posiciones laterales se centran solas: el recorte vertical es muy
agresivo y una columna a un lado se saldría de cuadro.

---

## Reemplazar los videos

1. Deja los `.mp4` nuevos en `videos/` con los mismos nombres.
2. Prepáralos para scrub (esto regenera también los posters):

```bash
pnpm media       # videos/*.mp4  ->  media/*.mp4 + posters/*.jpg
```

3. Revisa el `pos` de cada capítulo según la composición del nuevo clip, y su
   `velocidad` si el clip se siente lento o nervioso.

### Por qué hay un paso de codificación

Un H.264 normal solo puede saltar a **keyframes**; para mostrar un fotograma
intermedio tiene que decodificar desde el keyframe anterior. Buscar en cada
frame del scroll con eso es inviable: se ve a tirones.

`scripts/encode.sh` recodifica con `-g 1`, es decir, **cada fotograma es
keyframe**, y el seek pasa a ser directo. Cuesta ~1.5x de peso en estos clips
(21 MB los cuatro), porque son tomas lentas.

Los videos 1 y 2 se precargan; 3 y 4 se cargan al acercarse (`data-src` en el
`<video>`, resuelto por `cargarVideo()`).

---

## Retocar el diseño

Todo en `:root` de [styles.css](styles.css):

- **Color** — `--negro`, `--hueso`, y dos acentos: `--vino`, `--marino`.
- **Tipografía** — `--mono` (Space Mono) para toda la UI, `--serif`
  (Newsreader) solo para los versículos. Tracking en `--track-*`.
- **Forma** — `--radius: 0.8rem`, `--borde` de 1px.
- **Aire** — `--gutter`, `--aire-*`.
- **Movimiento** — `--fade`, `--ease`.
- **`--video-scale`** — overscan del video (`1.04`). No lo bajes de `1.02`:
  ver "Notas sobre los assets".

Los tiempos de la animación están arriba de `script.js`: `CROSSFADE`,
`TEXTO_IN`, `TEXTO_OUT`, `TEXTO_Y`.

---

## Cómo funciona el scrub

Ningún video se reproduce solo. **El scroll no controla la velocidad, controla
el destino.**

1. Cada capítulo tiene un `ScrollTrigger` que traduce tu posición de scroll a un
   `destino` entre 0 y 1 (el punto del clip donde deberías estar).
2. Un bucle en `requestAnimationFrame` mueve la `cabeza` del video hacia ese
   destino, pero **nunca más rápido que `VELOCIDAD_MAX`** (1 = velocidad natural
   del clip).
3. `seek()` traduce la cabeza a `video.currentTime`.

Por eso, si scrolleas a lo bestia, el video **no** va en cámara rápida: se queda
atrás y sigue avanzando a ritmo de cine hasta alcanzarte. Si scrolleas despacio,
va pegado a tu dedo.

Los videos apilados en el `.stage` fijo solo cambian de opacidad. El crossfade
está atado al scroll (no al reloj) y **solo funde el entrante**: como está por
encima en el DOM, al llegar a opacidad 1 ya tapa al anterior. Un solo fundido en
vez de dos evita el bache oscuro de bajar uno mientras sube el otro.

Un capítulo tapado no recibe ni un `seek`: se teletransporta a su destino.

### Velocidad

- `VELOCIDAD_MAX` (arriba de `script.js`) es el tope global, en segundos de video
  por segundo real. Súbelo si quieres que el video responda más al scroll.
- `velocidad` en cada capítulo de `CHAPTERS` lo multiplica solo para ese clip.
  El capítulo 04 va a `1.9` porque la toma de la tumba casi no tiene movimiento
  y a 1x se arrastraba.

### Otros detalles

- `prefers-reduced-motion`: no se instancia Lenis y el tope de velocidad se quita
  (el video sigue al scroll directamente, sin inercia añadida).
- Nada se reproduce en segundo plano, así que ocultar la pestaña no cuesta nada:
  sin scroll no hay seeks.

---

## Verificación (Playwright)

Usan **Chrome real** (`channel: "chrome"`), porque el Chromium que empaqueta
Playwright no trae el códec H.264 de los `.mp4`.

Con `pnpm dev` corriendo en otra terminal:

```bash
pnpm scrub                      # el test importante: el scrub y su tope de velocidad
pnpm shots                      # barrido de scroll completo -> shots/
node scripts/reduced-motion.mjs # comprueba que Lenis se desactiva
```

`pnpm scrub` comprueba que el servidor sirve Range, que el `currentTime` de cada
capítulo avanza sin retroceder, que al subir rebobina, y que **un salto brusco
de scroll no acelera el video** por encima de su tope.

`pnpm shots` recorre desktop (1440×900) y móvil (390×844), bajando y subiendo,
guarda una captura por paso en `shots/` e imprime el `currentTime` de los 4.

### Estado verificado

- El servidor sirve Range; `video.seekable` llega a 10 s.
- Los 4 capítulos scrubean con el scroll, sin retrocesos, y rebobinan al subir.
- Tras un salto brusco el video avanza a ~1x (medido 1.12x, dentro del ruido de
  muestreo), no se teletransporta.
- El capítulo 04 corre a ~2x, como pide su `velocidad: 1.9`.
- Cada capítulo consume su clip entero (t≈9.1–9.9 s) antes de ceder al siguiente.
- Crossfade limpio a mitad de fundido; disolvencia real entre las dos tomas.
- Texto entra con fade + translate-up escalonado y no tapa la figura.
- Móvil 390×844: el video cubre sin barras, el texto se recoloca.
- `prefers-reduced-motion` sin errores.
- Sin errores de consola en ningún pase.

No verificado sin dispositivo real: **el scrub en iOS Safari**. iOS admite
`currentTime` en videos `muted playsinline`, pero es más tacaño con el `preload`
y puede exigir un gesto antes de bufferizar. Si en un iPhone el primer capítulo
se ve congelado, la solución habitual es un `video.play(); video.pause();` dentro
del primer `touchstart`. Conviene probarlo en un iPhone físico.

---

## Notas sobre los assets

Tres cosas que encontré en los videos actuales, por si los regeneras:

1. **`3.mp4` y `4.mp4` traen barras negras y esquinas redondeadas quemadas** en
   el propio archivo. Se ocultan con el overscan `--video-scale: 1.04`. Si
   pones videos limpios, puedes bajarlo a `1.0`.

2. **Los 4 videos traían una marca de agua** del generador (un destello ✦ abajo
   a la derecha). Ya está quitada: `scripts/encode.sh` aplica un filtro `delogo`
   sobre la caja `x=1136 y=570 w=56 h=60` al generar `media/`, así que los
   originales de `videos/` siguen intactos.

   Estaba fija en los 4 clips y en todos los fotogramas, por eso basta una caja.
   La caja lleva ~7 px de margen para atrapar el halo: con una más ajustada
   asoman las puntas de la estrella. `delogo` interpola desde el borde, así que
   deja un parche suave, invisible a tamaño real y tapado además por la viñeta
   de la esquina.

   Si cambias de videos y la marca está en otro sitio, localízala así y ajusta
   `MARCA` en `scripts/encode.sh`:

   ```bash
   ffmpeg -i videos/1.mp4 -frames:v 1 \
     -vf "crop=200:160:1080:560,scale=600:480:flags=neighbor" /tmp/wm.png
   ```

3. **`3.mp4` contiene un fundido interno entre dos tomas distintas** (Jesús de
   frente → Jesús de espaldas caminando hacia un pueblo). Durante ese fundido se
   ve un doble expuesto. Es del clip, no de la web. Además el punto de loop es
   un corte duro entre las dos tomas.
