/**
 * Verifica el SCRUB dirigido por scroll:
 *   1. El currentTime de cada capítulo avanza con el scroll, sin retroceder.
 *   2. Al subir, el video va hacia atrás.
 *   3. Un salto de scroll brusco NO acelera el video: sigue a <= 1x.
 *
 * Ojo: `visible` es la capa MÁS ALTA con opacidad > 0.5. Las de debajo se
 * quedan en 1 a propósito — solo se funde la entrante, que las tapa.
 */
import { chromium } from "@playwright/test";

const BASE = process.env.BASE ?? "http://localhost:4173/";
const VELOCIDAD_MAX = 1; // debe coincidir con script.js
const VEL_CAP = [1, 1, 1, 1.9]; // el campo `velocidad` de cada capítulo

/* El tope de velocidad implica que el video tarda en alcanzar al scroll:
   volver arriba desde el final son ~10s reales. Esperar un timeout fijo
   da falsos negativos; esperamos a que el currentTime deje de moverse. */
async function asentar(page, maxMs = 20000) {
  const leer = () => page.evaluate(() => document.querySelector(".video-layer video").currentTime);
  let previo = await leer();
  const limite = Date.now() + maxMs;
  while (Date.now() < limite) {
    await page.waitForTimeout(300);
    const ahora = await leer();
    if (Math.abs(ahora - previo) < 0.02) return ahora;
    previo = ahora;
  }
  return previo;
}

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));

await page.goto(BASE, { waitUntil: "load" });
await page.waitForFunction(
  () => document.querySelector('.video-layer[data-video="0"] video')?.readyState >= 2,
  null,
  { timeout: 25000 }
);

// Sin Range no hay seek posible: fallamos temprano y con un mensaje claro.
const seekable = await page.evaluate(() => {
  const v = document.querySelector(".video-layer video");
  return v.seekable.length ? v.seekable.end(0) : 0;
});
if (seekable < 1) {
  console.error(
    `✗ El servidor no soporta HTTP Range (video.seekable = ${seekable}s).\n` +
      `  Usa 'pnpm dev' (scripts/serve.mjs), no 'python3 -m http.server'.`
  );
  await browser.close();
  process.exit(1);
}
console.log(`video.seekable hasta ${seekable}s → el servidor sirve Range ✓\n`);
await page.waitForTimeout(800);

const irA = (y) =>
  page.evaluate((y) => {
    if (window.__lenis) window.__lenis.scrollTo(y, { immediate: true });
    else window.scrollTo(0, y);
  }, y);

const estado = () =>
  page.evaluate(() => {
    const ops = [...document.querySelectorAll(".video-layer")].map((l) =>
      +(+getComputedStyle(l).opacity).toFixed(3)
    );
    let visible = 0;
    for (let i = ops.length - 1; i >= 0; i--)
      if (ops[i] > 0.5) { visible = i; break; }
    return {
      y: Math.round(window.scrollY),
      visible,
      t: [...document.querySelectorAll(".video-layer video")].map((v) => +v.currentTime.toFixed(2)),
    };
  });

const alto = await page.evaluate(
  () => document.documentElement.scrollHeight - window.innerHeight
);

// ── 1 y 2: barrido bajando, dejando que el video alcance en cada paso ──
const N = 44;
const muestras = [];
for (let i = 0; i <= N; i++) {
  await irA(Math.round((alto * i) / N));
  await page.waitForTimeout(700); // margen para que la cabeza alcance el destino
  muestras.push(await estado());
}

const fallos = [];
for (let cap = 0; cap < 4; cap++) {
  const suyas = muestras.filter((m) => m.visible === cap);
  if (suyas.length < 3) {
    fallos.push(`cap ${cap}: casi nunca es la capa visible (${suyas.length})`);
    continue;
  }
  const ts = suyas.map((m) => m.t[cap]);
  const avance = ts[ts.length - 1] - ts[0];
  if (avance <= 1) fallos.push(`cap ${cap}: el video no avanza (Δt=${avance.toFixed(2)}s)`);

  let retro = 0;
  for (let i = 1; i < ts.length; i++) if (ts[i] < ts[i - 1] - 0.08) retro++;
  if (retro) fallos.push(`cap ${cap}: ${retro} retrocesos bajando`);

  console.log(
    `cap ${cap}: visible en ${String(suyas.length).padStart(2)} muestras · ` +
      `t ${ts[0].toFixed(1)}s → ${ts[ts.length - 1].toFixed(1)}s (Δ${avance.toFixed(1)}s)`
  );
}

// ── 3: salto brusco. El video NO debe teletransportarse ni ir en cámara rápida ──
console.log("\n─ salto brusco de scroll ─");
await irA(0);
await asentar(page);
const t0 = (await estado()).t[0];

// Saltamos al final del capítulo 1 de golpe: destino = 1, unos ~10s de video.
await irA(Math.round(alto * 0.16));
const marcas = [];
for (let i = 0; i < 8; i++) {
  await page.waitForTimeout(250);
  marcas.push((await estado()).t[0]);
}
console.log(`t antes=${t0.toFixed(2)}s  luego: ${marcas.map((x) => x.toFixed(2)).join(" ")}`);

// Velocidad observada entre muestras: nunca por encima del tope (+10% de holgura).
let maxV = 0;
for (let i = 1; i < marcas.length; i++) maxV = Math.max(maxV, (marcas[i] - marcas[i - 1]) / 0.25);
console.log(`velocidad máxima observada: ${maxV.toFixed(2)}x  (tope ${VELOCIDAD_MAX}x)`);
if (maxV > VELOCIDAD_MAX * 1.15)
  fallos.push(`el video corre a ${maxV.toFixed(2)}x tras un salto (tope ${VELOCIDAD_MAX}x)`);
if (marcas[0] > t0 + VELOCIDAD_MAX * 0.6)
  fallos.push(`el video saltó de golpe a ${marcas[0].toFixed(2)}s`);

// ── 3b: el capítulo 4 debe correr a su propio tope (más rápido) ──
console.log("\n─ velocidad del capítulo 04 ─");
await irA(Math.round(alto * 0.72)); // dentro del cap 3, ya visible
await page.waitForTimeout(2500);
await irA(alto); // saltamos a su final
const m4 = [];
for (let i = 0; i < 8; i++) {
  await page.waitForTimeout(250);
  m4.push((await estado()).t[3]);
}
let v4 = 0;
for (let i = 1; i < m4.length; i++) v4 = Math.max(v4, (m4[i] - m4[i - 1]) / 0.25);
console.log(`cap 3: ${m4.map((x) => x.toFixed(2)).join(" ")}`);
console.log(`velocidad máxima observada: ${v4.toFixed(2)}x  (tope ${VEL_CAP[3]}x)`);
if (v4 > VEL_CAP[3] * 1.15) fallos.push(`cap 3 corre a ${v4.toFixed(2)}x (tope ${VEL_CAP[3]}x)`);
if (v4 < 1.2) fallos.push(`cap 3 no va más rápido que el resto (${v4.toFixed(2)}x)`);

// ── 4: volver arriba. Rebobina a <=1x, así que hay que darle tiempo. ──
await irA(0);
const tFin = await asentar(page);
console.log(`\nvuelta al inicio (tras asentarse): t[0]=${tFin.toFixed(2)}s`);
if (tFin > 0.3) fallos.push(`al volver arriba el video 0 quedó en ${tFin.toFixed(2)}s`);

console.log("\n─────────────");
if (errores.length) errores.forEach((e) => console.log(" ✗ error de página:", e));
if (fallos.length) fallos.forEach((f) => console.log(" ✗", f));
if (!fallos.length && !errores.length) console.log("Scrub correcto en los 4 capítulos.");
process.exitCode = fallos.length || errores.length ? 1 : 0;

await browser.close();
