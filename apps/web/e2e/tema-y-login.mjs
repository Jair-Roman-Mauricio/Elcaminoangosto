import { chromium } from 'playwright'
const BASE = 'http://localhost:4173'
const fallos = []
const ok = (t, c, x='') => { console.log(`  ${c?'PASA ':'FALLA'} │ ${t}${x?` — ${x}`:''}`); if(!c) fallos.push(t) }
const b = await chromium.launch()

async function login(p, email) {
  await p.goto(`${BASE}/entrar`, { waitUntil: 'networkidle' })
  await p.evaluate(() => localStorage.clear())
  await p.goto(`${BASE}/entrar`, { waitUntil: 'networkidle' })
  await p.fill('#email', email); await p.fill('#password', 'camino123')
  await p.click('button[type="submit"]'); await p.waitForTimeout(1600)
}

console.log('\n── BUG: registrarse con email existente → lleva a iniciar sesión ──')
const p = await b.newPage({ viewport: { width: 1200, height: 900 } })
await p.goto(`${BASE}/entrar?registro=1`, { waitUntil: 'networkidle' })
await p.fill('#displayName', 'Dup'); await p.fill('#email', 'ester@elcaminoangosto.test'); await p.fill('#password', 'camino123')
await p.click('button[type="submit"]'); await p.waitForTimeout(1500)
const aviso = (await p.getByRole('status').count()) ? await p.getByRole('status').innerText() : ''
ok('avisa que ya existe la cuenta', /Ya tienes una cuenta/i.test(aviso), aviso.trim())
ok('cambia a modo iniciar sesión', (await p.locator('button[type="submit"]').innerText()).toUpperCase().includes('ENTRAR'))

console.log('\n── BUG: credenciales incorrectas → mensaje en español ──')
await p.goto(`${BASE}/entrar`, { waitUntil: 'networkidle' })
await p.fill('#email', 'ester@elcaminoangosto.test'); await p.fill('#password', 'contraseñamala')
await p.click('button[type="submit"]'); await p.waitForTimeout(1500)
const err = (await p.getByRole('alert').count()) ? await p.getByRole('alert').innerText() : ''
ok('mensaje claro en español', /incorrectos/i.test(err), err.trim())

console.log('\n── TEMA: base es CLARO ──')
await login(p, 'ester@elcaminoangosto.test')
await p.goto(`${BASE}/discipulado`, { waitUntil: 'networkidle' }); await p.waitForTimeout(1200)
const theme1 = await p.evaluate(() => document.documentElement.dataset.theme)
ok('el tema por defecto es light', theme1 === 'light', `data-theme=${theme1}`)
const bg1 = await p.evaluate(() => getComputedStyle(document.body).backgroundColor)
ok('el fondo es claro', bg1 === 'rgb(244, 242, 236)', bg1)

console.log('\n── TEMA: el toggle cambia a oscuro y persiste ──')
await p.getByRole('button', { name: /Cambiar a tema oscuro/i }).click()
await p.waitForTimeout(1400)
const theme2 = await p.evaluate(() => document.documentElement.dataset.theme)
ok('el toggle cambia a dark', theme2 === 'dark', `data-theme=${theme2}`)
const bg2 = await p.evaluate(() => getComputedStyle(document.body).backgroundColor)
ok('el fondo pasa a oscuro', bg2 === 'rgb(10, 10, 10)', bg2)
await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(800)
ok('el tema persiste tras recargar', (await p.evaluate(() => document.documentElement.dataset.theme)) === 'dark')

console.log('\n── TEMA: la landing es SIEMPRE oscura (aunque la app esté en claro) ──')
await p.getByRole('button', { name: /Cambiar a tema claro/i }).click() // volver a claro
await p.waitForTimeout(500)
await p.goto(`${BASE}/`, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500)
const landingBg = await p.evaluate(() => {
  const r = document.querySelector('.landing-root'); return r ? getComputedStyle(r).backgroundColor : ''
})
ok('la landing sigue oscura con tema claro', landingBg === 'rgb(10, 10, 10)', landingBg)

console.log('\n── TEMA: el login es SIEMPRE oscuro ──')
await p.evaluate(() => localStorage.clear())
await p.goto(`${BASE}/entrar`, { waitUntil: 'networkidle' }); await p.waitForTimeout(800)
const loginDark = await p.evaluate(() => {
  const el = document.querySelector('[data-theme="dark"]'); return el ? getComputedStyle(el).backgroundColor : ''
})
ok('el login mantiene fondo oscuro', /rgb\(10, 10, 10\)|rgb\(13, 17, 23\)/.test(loginDark), loginDark)

await b.close()
console.log(`\n${fallos.length===0?'════ TEMA + LOGIN VERIFICADOS ════':`════ ${fallos.length} FALLARON: ${fallos.join(', ')} ════`}`)
process.exit(fallos.length===0?0:1)
