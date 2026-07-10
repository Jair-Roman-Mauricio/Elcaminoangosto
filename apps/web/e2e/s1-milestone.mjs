import { chromium } from 'playwright'

const BASE = 'http://localhost:4173'
const fallos = []
const ok = (t, cond, extra = '') => {
  console.log(`  ${cond ? 'PASA ' : 'FALLA'} │ ${t}${extra ? ` — ${extra}` : ''}`)
  if (!cond) fallos.push(t)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const errores = []
page.on('pageerror', (e) => errores.push(String(e)))
page.on('console', (m) => m.type() === 'error' && errores.push(m.text()))

async function loginUI(email) {
  await page.goto(`${BASE}/entrar`, { waitUntil: 'networkidle' })
  await page.fill('#email', email)
  await page.fill('#password', 'camino123')
  await page.click('button[type="submit"]')
}

console.log('\n── HU-0.2 + HU-4.1: Esteban (nivel 1) entra y ve el catálogo ──')
await loginUI('esteban@elcaminoangosto.test')
await page.waitForURL('**/discipulado', { timeout: 12000 })
await page.waitForTimeout(1200)
ok('llega al catálogo tras iniciar sesión', page.url().endsWith('/discipulado'))
const tarjetas = page.locator('article')
ok('el catálogo muestra al menos un curso', (await tarjetas.count()) >= 1, `n=${await tarjetas.count()}`)
ok('aparece el curso publicado', await page.getByText('La puerta angosta').first().isVisible())

console.log('\n── HU-4.1: inscripción desde la tarjeta ──')
const cardPuerta = page.locator('article', { hasText: 'La puerta angosta' }).first()
await cardPuerta.getByRole('button', { name: /Inscribirme/i }).click()
await page.waitForURL('**/discipulado/la-puerta-angosta', { timeout: 12000 })
await page.waitForTimeout(1000)
ok('tras inscribirse abre el curso', page.url().includes('/discipulado/la-puerta-angosta'))
ok('el course shell muestra el sidebar de lecciones', (await page.locator('nav[aria-label="Lecciones"] button').count()) === 3,
   `lecciones=${await page.locator('nav[aria-label="Lecciones"] button').count()}`)
ok('el progreso arranca en 0%', (await page.getByText('0%').first().isVisible()))

console.log('\n── HU-4.2: completar lecciones sube y guarda el progreso ──')
for (let i = 1; i <= 3; i++) {
  const btn = page.getByRole('button', { name: /Marcar como completada/i })
  await btn.click()
  await page.waitForTimeout(900)
  // Avanza a la siguiente lección pendiente si queda alguna.
  const pct = (await page.locator('span.tabular-nums').first().innerText()).trim()
  console.log(`     completada ${i}/3 → progreso ${pct}`)
}
await page.waitForTimeout(600)
ok('el progreso llega al 100%', await page.getByText('100%').first().isVisible())
const checks = await page.locator('nav[aria-label="Lecciones"]').getByText('✓').count()
ok('las 3 lecciones quedan marcadas ✓', checks === 3, `checks=${checks}`)

console.log('\n── HU-4.2: el progreso PERSISTE tras recargar ──')
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
ok('sigue al 100% tras recargar', await page.getByText('100%').first().isVisible())
const checks2 = await page.locator('nav[aria-label="Lecciones"]').getByText('✓').count()
ok('las 3 lecciones siguen ✓ tras recargar', checks2 === 3, `checks=${checks2}`)

console.log('\n── HU-4.1: bloqueo por nivel visible en el catálogo ──')
await page.goto(`${BASE}/discipulado`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)
const bloqueado = page.locator('article', { hasText: 'Cumbre' }).first()
if (await bloqueado.count()) {
  ok('el curso de nivel superior muestra el candado', await bloqueado.getByText(/🔒|Requiere el nivel/).first().isVisible())
} else {
  ok('(curso de nivel 3 no sembrado, se omite)', true)
}

console.log('\n── HU-1.2: el admin gestiona roles ──')
await page.goto(`${BASE}/entrar`, { waitUntil: 'networkidle' })
await page.evaluate(() => window.localStorage.clear())
await loginUI('admin@elcaminoangosto.test')
await page.waitForTimeout(1500)
await page.goto(`${BASE}/admin/usuarios`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
ok('el panel de usuarios lista filas', (await page.locator('tbody tr').count()) === 4, `filas=${await page.locator('tbody tr').count()}`)
ok('cada fila tiene un selector de rol', (await page.locator('tbody select').count()) === 4)

console.log('\n── Consola ──')
ok('sin errores de JavaScript', errores.length === 0, errores.slice(0, 2).join(' | '))

await browser.close()
console.log(`\n${fallos.length === 0 ? '════ HITO S1 VERIFICADO EN NAVEGADOR ════' : `════ ${fallos.length} FALLARON: ${fallos.join(', ')} ════`}`)
process.exit(fallos.length === 0 ? 0 : 1)
