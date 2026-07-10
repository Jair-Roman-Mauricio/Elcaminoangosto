/**
 * Barrido de scroll con Playwright.
 * Usa Chrome real (channel: "chrome") porque el Chromium empaquetado
 * de Playwright no trae el códec H.264 de los .mp4.
 *
 *   pnpm dev      # en otra terminal
 *   pnpm shots
 */
import { chromium } from "@playwright/test";
import { mkdir, rm } from "node:fs/promises";

const BASE = process.env.BASE ?? "http://localhost:4173/";
const OUT = "shots";

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

// Pasos del barrido: más densos cerca de los límites de capítulo,
// que es donde ocurre el crossfade.
const STEPS = 34;

async function sweep(browser, vp) {
  const page = await browser.newPage({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    isMobile: vp.name === "mobile",
    hasTouch: vp.name === "mobile",
  });

  const errores = [];
  page.on("console", (m) => m.type() === "error" && errores.push(m.text()));
  page.on("pageerror", (e) => errores.push(String(e)));

  // "networkidle" nunca llega: los videos en loop mantienen la red ocupada.
  await page.goto(BASE, { waitUntil: "load" });
  await page.waitForFunction(() => {
    const v = document.querySelector('.video-layer[data-video="0"] video');
    return v && v.readyState >= 3;
  }, null, { timeout: 20000 });
  await page.waitForTimeout(1500);

  const alto = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight
  );

  for (let i = 0; i <= STEPS; i++) {
    const y = Math.round((alto * i) / STEPS);
    await page.evaluate((y) => {
      if (window.__lenis) window.__lenis.scrollTo(y, { immediate: true });
      else window.scrollTo(0, y);
    }, y);
    // El scrub tiene tope de velocidad: hay que dejarle alcanzar al scroll
    // antes de la captura, o saldrían fotogramas a medio camino.
    await page.waitForTimeout(2200);

    const estado = await page.evaluate(() => {
      const ops = [...document.querySelectorAll(".video-layer")].map(
        (l) => +(+getComputedStyle(l).opacity).toFixed(2)
      );
      let visible = 0;
      for (let k = ops.length - 1; k >= 0; k--) if (ops[k] > 0.5) { visible = k; break; }
      return {
        step: window.__estado?.(),
        visible,
        t: [...document.querySelectorAll(".video-layer video")].map((v) => +v.currentTime.toFixed(1)),
      };
    });

    console.log(
      `${vp.name} ${String(i).padStart(2, "0")}  y=${String(y).padStart(5)}  ` +
        `step=${estado.step}  visible=${estado.visible}  t=[${estado.t.join(" ")}]`
    );

    await page.screenshot({
      path: `${OUT}/${vp.name}/${String(i).padStart(2, "0")}.png`,
    });
  }

  // Barrido inverso: verifica que el crossfade también funciona subiendo.
  for (let i = STEPS; i >= 0; i -= 6) {
    const y = Math.round((alto * i) / STEPS);
    await page.evaluate((y) => {
      if (window.__lenis) window.__lenis.scrollTo(y, { immediate: true });
      else window.scrollTo(0, y);
    }, y);
    await page.waitForTimeout(1300);
    await page.screenshot({ path: `${OUT}/${vp.name}/up-${String(i).padStart(2, "0")}.png` });
  }

  await page.close();
  return errores;
}

const browser = await chromium.launch({ channel: "chrome" });
await rm(OUT, { recursive: true, force: true });
for (const vp of VIEWPORTS) await mkdir(`${OUT}/${vp.name}`, { recursive: true });

let errores = [];
for (const vp of VIEWPORTS) errores = errores.concat(await sweep(browser, vp));
await browser.close();

console.log("\n─────────────");
if (errores.length) {
  console.log("ERRORES DE CONSOLA:");
  [...new Set(errores)].forEach((e) => console.log(" ·", e));
  process.exitCode = 1;
} else {
  console.log("Sin errores de consola.");
}
