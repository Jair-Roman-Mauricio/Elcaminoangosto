/**
 * Comprueba prefers-reduced-motion: Lenis no debe instanciarse y el
 * scroll nativo debe seguir cambiando de capítulo.
 */
import { chromium } from "@playwright/test";

const BASE = process.env.BASE ?? "http://localhost:4173/";

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  reducedMotion: "reduce",
});

const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
page.on("console", (m) => m.type() === "error" && errores.push(m.text()));

await page.goto(BASE, { waitUntil: "load" });
await page.waitForTimeout(2000);

console.log("Lenis desactivado:", await page.evaluate(() => window.__lenis === null));

const alto = await page.evaluate(
  () => document.documentElement.scrollHeight - window.innerHeight
);
for (const f of [0.25, 0.5, 0.75, 1]) {
  await page.evaluate((y) => window.scrollTo(0, y), Math.round(alto * f));
  await page.waitForTimeout(900);
  console.log(`  f=${f}  step=${await page.evaluate(() => window.__estado())}`);
}

await page.screenshot({ path: "shots/reduced-motion.png" });
console.log(errores.length ? "ERRORES: " + errores.join(" | ") : "Sin errores.");
await browser.close();
