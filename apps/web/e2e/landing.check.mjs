import { chromium } from 'playwright'

const BASE = process.argv[2] ?? 'http://localhost:4173'
const SHOTS = process.argv[3] ?? '/tmp/landing-shots'
const fallos = []
// `innerText` devuelve el texto ya transformado por `text-transform: uppercase`,
// que es justo lo que la landing hace con nav, botones y microlabels.
const norm = (s) => s.replace(/\s+/g, ' ').trim().toLocaleUpperCase('es')
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
ok('sin el contador "04 capítulos" en el nav', (await page.locator('.nav__meta').count()) === 0)
ok('nav con la marca "El Camino"', norm(await page.locator('.nav__brand').innerText()).includes('CAMINO'))

console.log('\n── Capítulo 01 visible al cargar ──')
const t1 = await page.locator('.overlay[data-step="0"] .overlay__title').innerText()
ok('título del capítulo 01', t1 === 'El principio del camino', t1)
const label1 = await page.locator('.overlay[data-step="0"] .overlay__label').innerText()
ok('microlabel del capítulo', norm(label1).includes('CAPÍTULO 01') && norm(label1).includes('EL DESIERTO'), label1)
ok('overlay 01 visible', (await page.locator('.overlay[data-step="0"]').evaluate((e) => getComputedStyle(e).opacity)) > 0.5)

console.log('\n── Identidad visual (tokens reales) ──')
// La landing es oscura vía `.landing-root` (el body es temático desde ADR-007).
const bg = await page.evaluate(() => {
  const r = document.querySelector('.landing-root')
  return r ? getComputedStyle(r).backgroundColor : getComputedStyle(document.body).backgroundColor
})
ok('la landing es oscura #0a0a0a', bg === 'rgb(10, 10, 10)', bg)
const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily)
ok('cuerpo en Space Mono', font.includes('Space Mono'), font.split(',')[0])
const verseFont = await page.locator('.overlay__verse').first().evaluate((e) => getComputedStyle(e).fontFamily)
ok('versículo en Newsreader (serif)', verseFont.includes('Newsreader'), verseFont.split(',')[0])

console.log('\n── Nav: iniciar sesión (el registro vive en el cierre) ──')
const cta = page.locator('.nav__cta')
ok('CTA en el nav', await cta.isVisible())
ok('dice "Iniciar sesión"', norm(await cta.innerText()) === 'INICIAR SESIÓN', await cta.innerText())
ok('apunta a /entrar', (await cta.getAttribute('href')) === '/entrar', await cta.getAttribute('href'))

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
ok('llega a El Camino Angosto', norm(heading).includes('CAMINO ANGOSTO'), norm(heading))
const submit = await page.locator('button[type="submit"]').innerText()
ok('el formulario arranca en "Registrarme"', norm(submit) === 'REGISTRARME', submit)
ok('pide el nombre (solo en registro)', await page.locator('#displayName').isVisible())

console.log('\n── Login: paisaje limpio + panel dibujado por código ──')
await page.goto(`${BASE}/entrar`, { waitUntil: 'networkidle' })
await page.waitForTimeout(600)
const foto = page.locator('img[src="/brand/paisaje.jpg"]')
ok('la fotografía limpia es el fondo', await foto.isVisible())
ok('la foto es decorativa (alt vacío)', (await foto.getAttribute('alt')) === '')
const panel = page.locator('svg[viewBox="0 0 100 100"]').first()
ok('el panel curvo se dibuja en escritorio', await panel.isVisible())
ok('el panel es SVG, no una imagen', (await panel.evaluate((e) => e.tagName.toLowerCase())) === 'svg')
ok('el panel se estira sin deformarse', (await panel.getAttribute('preserveAspectRatio')) === 'none')
ok('la marca es texto real, no está quemada', norm(await page.locator('h1').innerText()).includes('EL CAMINO'))
ok('el versículo está en la columna de marca', (await page.locator('blockquote').innerText()).includes('camino'))
ok('modo inicio de sesión por defecto', norm(await page.locator('button[type="submit"]').innerText()) === 'ENTRAR')
ok('no pide el nombre al iniciar sesión', (await page.locator('#displayName').count()) === 0)
ok('enlace de recuperación no está muerto', (await page.locator('a[href="/recuperar"]').getAttribute('href')) === '/recuperar')
ok('inputs en Space Mono', (await page.locator('#email').evaluate((e) => getComputedStyle(e).fontFamily)).includes('Space Mono'))

console.log('\n── El formulario no invade el paisaje iluminado ──')
for (const [w, h] of [[1024, 900], [1440, 900], [2560, 1080]]) {
  const p = await browser.newPage({ viewport: { width: w, height: h } })
  await p.goto(`${BASE}/entrar`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(500)
  const caja = await p.locator('#email').boundingBox()
  const svg = await p.locator('svg[viewBox="0 0 100 100"]').first().boundingBox()
  // El vértice de la curva está al 32.9% del ancho del panel: el input debe
  // arrancar a su derecha, o caería sobre el valle iluminado.
  const vertice = svg.x + svg.width * 0.329
  ok(`${w}px: el input arranca tras el vértice de la curva`, caja.x >= vertice,
     `input=${Math.round(caja.x)}px · vértice=${Math.round(vertice)}px`)
  await p.close()
}

console.log('\n── Login en móvil: la foto es el fondo, el panel desaparece ──')
const movil = await browser.newPage({ viewport: { width: 390, height: 844 } })
await movil.goto(`${BASE}/entrar`, { waitUntil: 'networkidle' })
await movil.waitForTimeout(500)
ok('la fotografía sigue de fondo', await movil.locator('img[src="/brand/paisaje.jpg"]').isVisible())
ok('el panel curvo se retira', !(await movil.locator('svg[viewBox="0 0 100 100"]').first().isVisible()))
ok('la marca se repone sobre la foto', await movil.locator('h1').isVisible())
ok('el formulario queda encima', await movil.locator('#email').isVisible())
await movil.close()

console.log('\n── prefers-reduced-motion ──')
await page.goto(BASE, { waitUntil: 'networkidle' })
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
