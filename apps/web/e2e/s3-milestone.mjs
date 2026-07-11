import { chromium } from 'playwright'
const BASE = 'http://localhost:4173'
const fallos = []
const ok = (t, c, x = '') => { console.log(`  ${c ? 'PASA ' : 'FALLA'} │ ${t}${x ? ` — ${x}` : ''}`); if (!c) fallos.push(t) }
const browser = await chromium.launch()
const errores = []

async function login(p, email) {
  await p.goto(`${BASE}/entrar`, { waitUntil: 'networkidle' })
  await p.evaluate(() => localStorage.clear())
  await p.goto(`${BASE}/entrar`, { waitUntil: 'networkidle' })
  await p.fill('#email', email); await p.fill('#password', 'camino123')
  await p.click('button[type="submit"]'); await p.waitForTimeout(1600)
}

console.log('\n── HU-3.1: el estudiante ve el feed vertical ──')
const est = await browser.newPage({ viewport: { width: 420, height: 900 } })
est.on('pageerror', (e) => errores.push(String(e)))
est.on('console', (m) => m.type() === 'error' && errores.push(m.text()))
await login(est, 'esteban@elcaminoangosto.test')
await est.goto(`${BASE}/tarjetas`, { waitUntil: 'networkidle' })
await est.waitForTimeout(2500)

const secciones = est.locator('section')
ok('el feed muestra al menos una tarjeta', (await secciones.count()) >= 1, `n=${await secciones.count()}`)

const video = est.locator('video').first()
ok('la tarjeta tiene un <video>', await video.count() > 0)
const src = await video.getAttribute('src')
ok('el video usa una URL firmada', /token=/.test(src ?? ''), (src ?? '').slice(0, 55))

// El video en foco debe empezar a reproducirse (autoplay muted).
await est.waitForTimeout(1500)
const estadoVideo = await video.evaluate((v) => ({ paused: v.paused, t: v.currentTime, rs: v.readyState }))
ok('el video en foco se reproduce (autoplay)', !estadoVideo.paused, `paused=${estadoVideo.paused}`)
ok('el video avanza (currentTime > 0)', estadoVideo.t > 0, `t=${estadoVideo.t.toFixed(2)}s rs=${estadoVideo.rs}`)

// El caption y el autor están en el overlay.
ok('muestra el caption', await est.getByText(/Contad el costo/).first().isVisible())

console.log('\n── el estudiante NO ve el botón de publicar ──')
ok('sin botón "+ Publicar" para el estudiante', (await est.getByRole('link', { name: /Publicar/i }).count()) === 0)

console.log('\n── el maestro SÍ puede publicar ──')
const maes = await browser.newPage({ viewport: { width: 420, height: 900 } })
await login(maes, 'maestro@elcaminoangosto.test')
await maes.goto(`${BASE}/tarjetas`, { waitUntil: 'networkidle' })
await maes.waitForTimeout(1500)
ok('el maestro ve "+ Publicar"', await maes.getByRole('link', { name: /Publicar/i }).isVisible())
await maes.getByRole('link', { name: /Publicar/i }).click()
await maes.waitForURL('**/tarjetas/publicar')
ok('la página de publicar carga con el input de archivo', await maes.locator('input[type="file"]').isVisible())

console.log('\n── Consola ──')
ok('sin errores de JavaScript', errores.length === 0, errores.slice(0, 2).join(' | '))

await browser.close()
console.log(`\n${fallos.length === 0 ? '════ HITO S3 VERIFICADO EN NAVEGADOR ════' : `════ ${fallos.length} FALLARON: ${fallos.join(', ')} ════`}`)
process.exit(fallos.length === 0 ? 0 : 1)
