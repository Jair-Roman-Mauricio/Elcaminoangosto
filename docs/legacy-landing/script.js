/* ═══════════════════════════════════════════════════════════
   EL CAMINO — lógica de escena
   Todo el contenido editable está en CHAPTERS y CIERRE.
   ═══════════════════════════════════════════════════════════ */

/* ───────────────────────────────────────────────────────────
   1. CONTENIDO EDITABLE
   ───────────────────────────────────────────────────────────
   numero  → se pinta en el microlabel ("CAPÍTULO 01")
   lugar   → segunda mitad del microlabel
   video   → ruta del mp4 (el orden aquí = el orden de scroll)
   poster  → frame extraído; evita el pantallazo negro
   titulo  → título del capítulo
   verso   → frase / versículo (corto, respira mejor)
   ref     → referencia bíblica
   pos     → dónde se coloca el texto sobre el video. Elegido para NO
             tapar la figura de cada escena. Valores:
               "split"      título arriba + versículo abajo (deja libre el centro)
               "top-center" | "top-left" | "bottom-left" | "center"
   velocidad → multiplica el tope de VELOCIDAD_MAX solo en este capítulo.
             1 = ritmo natural. Súbelo si el clip se siente lento.
   ─────────────────────────────────────────────────────────── */
const CHAPTERS = [
  {
    numero: "01",
    lugar: "El desierto",
    video: "videos/1.mp4",
    poster: "posters/1.jpg",
    titulo: "El principio del camino",
    verso: "Y el Espíritu le llevó al desierto, donde el silencio enseña a escuchar.",
    ref: "Marcos 1:12",
    // La figura camina justo por el centro del encuadre: el título se
    // queda en el cielo y el versículo baja al pie, sin cruzarla.
    pos: "split",
  },
  {
    numero: "02",
    lugar: "La ladera",
    video: "videos/2.mp4",
    poster: "posters/2.jpg",
    titulo: "El Sermón del Monte",
    verso: "Bienaventurados los de limpio corazón, porque ellos verán a Dios.",
    ref: "Mateo 5:8",
    // Su rostro queda arriba-al-centro: el texto se va a la columna
    // izquierda (cielo y ladera limpios) para no cruzarle la cara.
    pos: "top-left",
  },
  {
    numero: "03",
    lugar: "El camino",
    video: "videos/3.mp4",
    poster: "posters/3.jpg",
    titulo: "Caminando juntos",
    verso: "Ya no os llamo siervos, sino amigos. Nadie recorre este camino a solas.",
    ref: "Juan 15:15",
    // La figura ocupa el centro: el texto baja al lateral inferior izquierdo.
    pos: "bottom-left",
  },
  {
    numero: "04",
    lugar: "El amanecer",
    video: "videos/4.mp4",
    poster: "posters/4.jpg",
    titulo: "Ha resucitado",
    verso: "No está aquí, pues ha resucitado, así como dijo. Venid, ved el lugar.",
    ref: "Mateo 28:6",
    // Centro luminoso: el texto se apoya justo sobre el resplandor.
    pos: "center",
    // El clip de la tumba apenas tiene movimiento; a 1x se arrastra.
    velocidad: 1.9,
  },
];

/* El cierre reutiliza el último video (la tumba vacía) y añade el CTA. */
const CIERRE = {
  label: "El camino continúa",
  titulo: "Comienza tu camino",
  verso: "La historia no termina en la tumba. Empieza contigo.",
  cta: { texto: "Quiero conocerle", href: "#" }, // ← reemplaza el href
  ctaSecundario: { texto: "Escríbenos", href: "#" }, // ← reemplaza el href
  pie: "El Camino · Hecho con reverencia",
};

/* ───────────────────────────────────────────────────────────
   2. AJUSTES DE MOVIMIENTO
   ─────────────────────────────────────────────────────────── */
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const TEXTO_IN = reduced ? 0.25 : 1.1; // entrada del texto
const TEXTO_OUT = reduced ? 0.2 : 0.55; // salida del texto
const TEXTO_Y = reduced ? 0 : 22; // translate-up del texto (px)
const EASE = "power2.out";

/* Velocidad máxima de reproducción, en segundos de video por segundo real.
   El scroll marca ADÓNDE debe ir el video, no a qué velocidad: por muy
   rápido que scrollees, el video nunca corre más de este ritmo. Se queda
   atrás y sigue avanzando, a velocidad de cine, hasta alcanzar el punto.
   1 = velocidad natural del clip. Súbelo si lo quieres más reactivo.
   Cada capítulo puede escalarlo con su campo `velocidad`. */
const VELOCIDAD_MAX = reduced ? Infinity : 1;

/* Ventana del crossfade, en fracción de viewport: el video entrante
   empieza a aparecer cuando su sección llega al 72% de la pantalla y
   termina de cubrir al anterior en el 28%. */
const FADE_START = "top 72%";
const FADE_END = "top 28%";

/* El scrub de un capítulo termina justo cuando el siguiente acaba de
   taparlo (su borde inferior en el 28% de la pantalla). Si lo dejáramos
   correr hasta "bottom bottom", los últimos segundos de cada clip se
   reproducirían ya invisibles: el capítulo 01 solo llegaba a t=5.6s. */
const SCRUB_END = "bottom 28%";

gsap.registerPlugin(ScrollTrigger);

/* ───────────────────────────────────────────────────────────
   3. CONSTRUCCIÓN DE OVERLAYS
   ─────────────────────────────────────────────────────────── */
const overlaysRoot = document.querySelector(".overlays");

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const overlaysHTML = CHAPTERS.map(
  (c, i) => `
  <section class="overlay" data-pos="${c.pos}" data-step="${i}" aria-label="Capítulo ${esc(c.numero)}">
    <div class="overlay__scrim"></div>
    <div class="overlay__stack">
      <div class="overlay__inner">
        <p class="overlay__label">Capítulo ${esc(c.numero)} — ${esc(c.lugar)}</p>
        <h2 class="overlay__title">${esc(c.titulo)}</h2>
      </div>
      <div class="overlay__inner">
        <p class="overlay__verse">${esc(c.verso)}</p>
        <p class="overlay__ref">${esc(c.ref)}</p>
      </div>
    </div>
  </section>`
).join("");

const cierreHTML = `
  <section class="overlay" data-pos="center" data-step="4" aria-label="Cierre">
    <div class="overlay__scrim"></div>
    <div class="overlay__stack">
      <div class="overlay__inner">
        <p class="overlay__label">${esc(CIERRE.label)}</p>
        <h2 class="overlay__title">${esc(CIERRE.titulo)}</h2>
        <p class="overlay__verse">${esc(CIERRE.verso)}</p>
        <div class="overlay__actions">
          <a class="boton" href="${esc(CIERRE.cta.href)}">${esc(CIERRE.cta.texto)}</a>
          <a class="boton boton--sutil" href="${esc(CIERRE.ctaSecundario.href)}">${esc(CIERRE.ctaSecundario.texto)}</a>
          <p class="overlay__pie">${esc(CIERRE.pie)}</p>
        </div>
      </div>
    </div>
  </section>`;

overlaysRoot.innerHTML = overlaysHTML + cierreHTML;

const overlays = [...overlaysRoot.querySelectorAll(".overlay")];
const layers = [...document.querySelectorAll(".video-layer")];
const videos = layers.map((l) => l.querySelector("video"));
const counters = [...document.querySelectorAll(".counter__item")];
const hint = document.querySelector("[data-hint]");

/* ───────────────────────────────────────────────────────────
   4. VIDEO: carga diferida + seek dirigido por scroll
   ───────────────────────────────────────────────────────────
   Ningún video se reproduce solo. El scroll mueve su currentTime
   fotograma a fotograma. Por eso media/ va codificado con todos
   los fotogramas en keyframe (ver scripts/encode.sh): si no, cada
   seek obligaría a decodificar desde el keyframe anterior y el
   scrub iría a tirones.
   ─────────────────────────────────────────────────────────── */

/* Los videos 3 y 4 llegan con data-src: se cargan al acercarse. */
function cargarVideo(i) {
  const v = videos[i];
  if (!v || v.src) return;
  const src = v.dataset.src;
  if (!src) return;
  v.src = src;
  v.load();
}

/* Mueve el video al fotograma que toca. `p` va de 0 a 1.
   - Nos paramos un pelo antes del final: el último fotograma a veces
     no existe y el navegador se queda en negro.
   - Si el salto es menor que medio fotograma, no pedimos seek: cada
     petición cuesta y a 24fps no se notaría. */
function seek(v, p) {
  if (!v || !v.duration || !Number.isFinite(v.duration)) return;
  if (v.readyState < 1) return;
  const t = Math.max(0, Math.min(p, 1)) * (v.duration - 0.06);
  if (Math.abs(v.currentTime - t) < 1 / 48) return;
  v.currentTime = t;
}

/* ── El bucle que persigue al scroll a velocidad de cine ──
   `destino[i]` lo fija el scroll (0 a 1). `cabeza[i]` es dónde está de
   verdad el video, y solo puede moverse VELOCIDAD_MAX segundos de video
   por segundo real. Scrollear a lo bestia no acelera el clip: lo deja
   atrás, y el video sigue avanzando a su ritmo hasta alcanzarlo. */
const destino = CHAPTERS.map(() => 0);
const cabeza = CHAPTERS.map(() => 0);

let ultimoTick = performance.now();

function tick(ahora) {
  // Si la pestaña estuvo oculta, dt sería enorme y el video saltaría.
  const dt = Math.min((ahora - ultimoTick) / 1000, 0.05);
  ultimoTick = ahora;

  // El capítulo más alto que ya cubre del todo la pantalla: lo que quede
  // por debajo está tapado y no merece un solo seek.
  let techo = 0;
  for (let i = CHAPTERS.length - 1; i >= 0; i--) {
    if (parseFloat(layers[i].style.opacity || "0") >= 0.999) {
      techo = i;
      break;
    }
  }

  for (let i = techo; i < CHAPTERS.length; i++) {
    const v = videos[i];
    if (!v || !v.duration || !Number.isFinite(v.duration)) continue;

    // Un video invisible no se persigue: se teletransporta. Así no
    // gastamos seeks en lo que no se ve, y al reaparecer ya está en su sitio.
    const visible = parseFloat(layers[i].style.opacity || "0") > 0.01;
    if (!visible) {
      cabeza[i] = destino[i];
      continue;
    }

    const diff = destino[i] - cabeza[i];
    if (Math.abs(diff) > 1e-4) {
      // El tope de velocidad está en segundos de video; lo pasamos a
      // unidades de progreso (0–1) dividiendo por la duración.
      const vel = VELOCIDAD_MAX * (CHAPTERS[i].velocidad ?? 1);
      const tope = (vel * dt) / (v.duration - 0.06);
      cabeza[i] += Math.sign(diff) * Math.min(Math.abs(diff), tope);
    }
    seek(v, cabeza[i]);
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

let stepActual = -1;

function setActive(step, instant = false) {
  if (step === stepActual) return;
  stepActual = step;

  // El cierre (step 4) se queda sobre el último video.
  const vIdx = Math.min(step, CHAPTERS.length - 1);

  // Precarga anticipada: el siguiente ya está listo cuando toca.
  cargarVideo(vIdx);
  cargarVideo(vIdx + 1);

  // ── Overlays: sale el anterior, entra el nuevo ──
  overlays.forEach((ov, i) => {
    const bloques = ov.querySelectorAll(".overlay__inner");
    if (i === step) {
      gsap.killTweensOf([ov, ...bloques]);
      gsap.set(ov, { visibility: "visible" });
      gsap.to(ov, { opacity: 1, duration: instant ? 0 : TEXTO_IN * 0.6, ease: EASE });
      // Fade + leve translate-up, escalonado: entra el título, luego el versículo.
      gsap.fromTo(
        bloques,
        { y: TEXTO_Y, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: instant ? 0 : TEXTO_IN,
          ease: EASE,
          delay: instant ? 0 : 0.12,
          stagger: instant ? 0 : 0.1,
        }
      );
    } else if (ov.style.visibility !== "hidden") {
      gsap.killTweensOf(ov);
      gsap.to(ov, {
        opacity: 0,
        duration: instant ? 0 : TEXTO_OUT,
        ease: "power1.in",
        onComplete: () => gsap.set(ov, { visibility: "hidden" }),
      });
    }
  });

  // ── Contador lateral ──
  counters.forEach((c, i) => c.classList.toggle("is-on", i === vIdx));

  // ── El indicador de scroll solo vive en el hero ──
  gsap.to(hint, { opacity: step === 0 ? 1 : 0, duration: instant ? 0 : 0.5, ease: EASE });
}

/* ───────────────────────────────────────────────────────────
   5. ESTADO INICIAL
   ─────────────────────────────────────────────────────────── */
layers.forEach((l, i) => {
  l.classList.remove("is-active");
  // El capítulo 01 arranca visible; los demás aparecen encima al
  // scrollear (el orden del DOM ya los apila en el orden correcto,
  // así que basta con hacer aparecer el entrante).
  gsap.set(l, { opacity: i === 0 ? 1 : 0 });
});
cargarVideo(0);
cargarVideo(1);
overlays.forEach((ov) => gsap.set(ov, { opacity: 0, visibility: "hidden" }));
setActive(0, true);

/* ───────────────────────────────────────────────────────────
   6. SMOOTH SCROLL (Lenis) — se omite con reduced-motion
   ─────────────────────────────────────────────────────────── */
let lenis = null;

if (!reduced && typeof Lenis !== "undefined") {
  lenis = new Lenis({
    duration: 1.25,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // ease-out exponencial
    smoothWheel: true,
    touchMultiplier: 1.4,
  });

  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

/* ───────────────────────────────────────────────────────────
   7. SCROLL → ESCENA
   ─────────────────────────────────────────────────────────── */
const secciones = [...document.querySelectorAll("main .chapter")];

secciones.forEach((sec) => {
  const step = Number(sec.dataset.step);

  // ── a) Overlays y contador: el capítulo "manda" mientras su
  //       centro cruza el centro de la pantalla. Igual bajando
  //       (onEnter) que subiendo (onEnterBack).
  ScrollTrigger.create({
    trigger: sec,
    start: "top center",
    end: "bottom center",
    onEnter: () => setActive(step),
    onEnterBack: () => setActive(step),
  });

  if (step >= CHAPTERS.length) return; // el cierre no tiene video propio

  const layer = layers[step];

  // ── b) SCRUB: el scroll fija el DESTINO del video (0 a 1).
  //       Quién lo persigue —y a qué velocidad— es el bucle de abajo.
  //       Arranca un poco antes de que la sección llene la pantalla, para
  //       que el video ya esté en movimiento durante el fundido y no
  //       aparezca congelado en su primer fotograma.
  ScrollTrigger.create({
    trigger: sec,
    start: step === 0 ? "top top" : FADE_START,
    end: SCRUB_END,
    onUpdate: (self) => (destino[step] = self.progress),
    onLeave: () => (destino[step] = 1),
    onLeaveBack: () => (destino[step] = 0),
    onRefresh: (self) => (destino[step] = self.progress),
  });

  // ── c) CROSSFADE: solo hace falta hacer aparecer el entrante.
  //       Está por encima en el DOM, así que al llegar a opacidad 1
  //       ya cubre al anterior. Un solo fundido = disolvencia limpia,
  //       sin el bache oscuro de bajar uno mientras sube el otro.
  if (step > 0) {
    gsap.fromTo(
      layer,
      { opacity: 0 },
      {
        opacity: 1,
        ease: "none",
        scrollTrigger: {
          trigger: sec,
          start: FADE_START,
          end: FADE_END,
          scrub: true,
        },
      }
    );
  }
});

/* ───────────────────────────────────────────────────────────
   8. DETALLES
   ─────────────────────────────────────────────────────────── */

// Anclas internas a través de Lenis (si no, pelean entre sí).
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener("click", (e) => {
    const id = a.getAttribute("href");
    if (id === "#") return;
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target, { duration: 1.6 });
    else target.scrollIntoView();
  });
});

// Si el navegador restaura el scroll a media página, recalculamos.
window.addEventListener("load", () => ScrollTrigger.refresh());

// Gancho para el script de capturas (scripts/capture.mjs). Inocuo en producción.
window.__lenis = lenis;
window.__estado = () => stepActual;

// Ningún video se reproduce por su cuenta, así que no hay nada que pausar
// al ocultar la pestaña: sin scroll no hay seeks y el coste es cero.

// Al volver de un bfcache o de un resize, el scroll puede haber cambiado
// sin que ScrollTrigger lo sepa: recolocamos cada video en su fotograma.
ScrollTrigger.addEventListener("refresh", () => ScrollTrigger.update());
