import { chromium } from 'playwright'
const BASE = process.argv[2] ?? 'https://web-production-551e4.up.railway.app'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1200, height: 900 } })
const logs = []
p.on('console', m => logs.push(`[${m.type()}] ${m.text()}`))
p.on('pageerror', e => logs.push(`[pageerror] ${e}`))

const email = `bug-${Date.now()}@gmail.com`
const pass = 'camino123'
console.log('email:', email)

// 1. Registrarse
await p.goto(`${BASE}/entrar?registro=1`, { waitUntil: 'networkidle' })
await p.fill('#displayName', 'Bug Repro')
await p.fill('#email', email)
await p.fill('#password', pass)
await p.click('button[type="submit"]')
await p.waitForTimeout(4000)
console.log('tras registro, url:', p.url())

// 2. Cerrar sesión
const salir = p.getByRole('button', { name: /Salir/i })
if (await salir.count()) { await salir.click(); await p.waitForTimeout(2500) }
else { console.log('  (no encontré botón Salir; url=' + p.url() + ')') }
console.log('tras cerrar sesión, url:', p.url())

// 3. Login con las MISMAS credenciales
await p.goto(`${BASE}/entrar`, { waitUntil: 'networkidle' })
await p.waitForTimeout(600)
await p.fill('#email', email)
await p.fill('#password', pass)
await p.click('button[type="submit"]')
await p.waitForTimeout(4500)
console.log('tras re-login, url:', p.url())

const alerta = await p.getByRole('alert').count() ? await p.getByRole('alert').innerText() : '(sin alerta)'
console.log('mensaje de error en pantalla:', alerta)
const entro = p.url().includes('/discipulado') || p.url().includes('/tarjetas')
console.log(entro ? '  RESULTADO: ENTRÓ ✓' : '  RESULTADO: NO ENTRÓ ✗')

console.log('\n── logs de consola ──')
logs.slice(-12).forEach(l => console.log('  '+l))
await b.close()
