import { chromium } from 'playwright'

const BASE = process.argv[2] ?? 'http://localhost:4173'
const SHOTS = process.argv[3] ?? '/tmp/landing-shots'
const fallos = []
// `innerText` devuelve el texto ya transformado por `text-transform: uppercase`,
// que es justo lo que la landing hace con nav, botones y microlabels.
const norm = (s) => s.trim().toLocaleUpperCase('es')
const ok = (etiqueta, cond, extra = '') => {
  console.log(`  ${cond ? 'PASA ' : 'FALLA'} │ ${etiqueta}${extra ? ` — ${extra}` : ''}`)
  if (!cond) fallos.push(etiqueta)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

const errores = []
page.on('pageerror', (e) => errores.push(String(e)))
page.on('console', (m) => m.type() === 'error' && errores.push(m.text()))

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)

console.log('\n── Estructura portada desde la landing original ──')
ok('4 capas de video', (await page.locator('.video-layer').count()) === 4)
ok('5 overlays (4 capítulos + cierre)', (await page.locator('.overlay').count()) === 5)
ok('4 items del contador lateral', (await page.locator('.counter__item').count()) === 4)
ok('indicador de scroll presente', await page.locator('[data-hint]').isVisible())
ok('nav con la marca "El Camino"', norm(await page.locator('.nav__brand').innerText()).includes('CAMINO'))

console.log('\n── Capítulo 01 visible al cargar ──')
const t1 = await page.locator('.overlay[data-step="0"] .overlay__title').innerText()
ok('título del capítulo 01', t1 === 'El principio del camino', t1)
const label1 = await page.locator('.overlay[data-step="0"] .overlay__label').innerText()
ok('microlabel del capítulo', norm(label1).includes('CAPÍTULO 01') && norm(label1).includes('EL DESIERTO'), label1)
ok('overlay 01 visible', (await page.locator('.overlay[data-step="0"]').evaluate((e) => getComputedStyle(e).opacity)) > 0.5)

console.log('\n── Identidad visual (tokens reales) ──')
const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
ok('fondo negro #0a0a0a', bg === 'rgb(10, 10, 10)', bg)
const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily)
ok('cuerpo en Space Mono', font.includes('Space Mono'), font.split(',')[0])
const verseFont = await page.locator('.overlay__verse').first().evaluate((e) => getComputedStyle(e).fontFamily)
ok('versículo en Newsreader (serif)', verseFont.includes('Newsreader'), verseFont.split(',')[0])

console.log('\n── Botón de registro que conecta con la plataforma ──')
const cta = page.locator('.nav__cta')
ok('CTA en el nav', await cta.isVisible())
ok('dice "Crear cuenta"', norm(await cta.innerText()) === 'CREAR CUENTA', await cta.innerText())
ok('apunta a /entrar?registro=1', (await cta.getAttribute('href')) === '/entrar?registro=1', await cta.getAttribute('href'))

console.log('\n── El scroll mueve el currentTime del video (scrub) ──')
const t0 = await page.locator('.video-layer[data-video="0"] video').evaluate((v) => v.currentTime)
await page.mouse.wheel(0, 1400)
await page.waitForTimeout(2500)
const tAfter = await page.locator('.video-layer[data-video="0"] video').evaluate((v) => v.currentTime)
ok('currentTime avanza al scrollear', tAfter > t0, `${t0.toFixed(2)}s → ${tAfter.toFixed(2)}s`)
const playing = await page.locator('.video-layer[data-video="0"] video').evaluate((v) => !v.paused)
ok('el video NO se reproduce solo', !playing)

console.log('\n── Avance de capítulos ──')
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.32))
await page.waitForTimeout(2200)
const op2 = await page.locator('.overlay[data-step="1"]').evaluate((e) => getComputedStyle(e).opacity)
ok('el capítulo 02 aparece al avanzar', Number(op2) > 0.5, `opacity=${op2}`)
const t2 = await page.locator('.overlay[data-step="1"] .overlay__title').innerText()
ok('título del capítulo 02', t2 === 'El Sermón del Monte', t2)

console.log('\n── Cierre con el CTA de registro ──')
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
await page.waitForTimeout(2500)
const cierre = page.locator('.overlay[data-step="4"]')
ok('overlay de cierre visible', Number(await cierre.evaluate((e) => getComputedStyle(e).opacity)) > 0.5)
const botonCta = cierre.locator('a.boton').first()
ok('CTA principal "Crear mi cuenta"', norm(await botonCta.innerText()) === 'CREAR MI CUENTA', await botonCta.innerText())
ok('lleva al registro', (await botonCta.getAttribute('href')) === '/entrar?registro=1')

console.log('\n── El CTA navega y abre el formulario en modo registro ──')
await botonCta.click()
await page.waitForURL('**/entrar**', { timeout: 8000 })
await page.waitForTimeout(800)
ok('URL de registro', page.url().includes('/entrar?registro=1'), page.url())
const heading = await page.locator('h1').innerText()
ok('llega a El Camino Angosto', heading.includes('Camino Angosto'), heading)
const submit = await page.locator('button[type="submit"]').innerText()
ok('el formulario arranca en "Registrarme"', norm(submit) === 'REGISTRARME', submit)
ok('pide el nombre (solo en registro)', await page.locator('#displayName').isVisible())

console.log('\n── prefers-reduced-motion ──')
const page2 = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
await page2.goto(BASE, { waitUntil: 'networkidle' })
await page2.waitForTimeout(1200)
const lenisActivo = await page2.evaluate(() => document.documentElement.classList.contains('lenis'))
ok('Lenis desactivado con reduced-motion', !lenisActivo)
ok('capítulo 01 visible igualmente', Number(await page2.locator('.overlay[data-step="0"]').evaluate((e) => getComputedStyle(e).opacity)) > 0.5)

console.log('\n── Errores de consola ──')
ok('sin errores de JS', errores.length === 0, errores.slice(0, 2).join(' | '))

await browser.close()
console.log(`\n${fallos.length === 0 ? '════ TODAS LAS COMPROBACIONES PASAN ════' : `════ ${fallos.length} FALLARON: ${fallos.join(', ')} ════`}`)
process.exit(fallos.length === 0 ? 0 : 1)
