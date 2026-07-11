import { chromium } from 'playwright'
const BASE = 'http://localhost:4173'
const fallos = []
const ok = (t, c, x = '') => { console.log(`  ${c ? 'PASA ' : 'FALLA'} │ ${t}${x ? ` — ${x}` : ''}`); if (!c) fallos.push(t) }
const browser = await chromium.launch()
const errores = []

async function ventana() {
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  p.on('pageerror', (e) => errores.push(String(e)))
  p.on('console', (m) => m.type() === 'error' && errores.push(m.text()))
  return p
}
async function login(p, email) {
  await p.goto(`${BASE}/entrar`, { waitUntil: 'networkidle' })
  await p.evaluate(() => window.localStorage.clear())
  await p.goto(`${BASE}/entrar`, { waitUntil: 'networkidle' })
  await p.fill('#email', email); await p.fill('#password', 'camino123')
  await p.click('button[type="submit"]'); await p.waitForTimeout(1600)
}

const titulo = `Curso E2E ${Date.now()}`

console.log('\n── HU-4.3: el maestro crea un borrador ──')
const maestro = await ventana()
await login(maestro, 'maestro@elcaminoangosto.test')
await maestro.goto(`${BASE}/maestro/cursos`, { waitUntil: 'networkidle' }); await maestro.waitForTimeout(1000)
await maestro.getByRole('button', { name: 'Nuevo curso' }).click()
await maestro.waitForTimeout(300)
await maestro.locator('input').first().fill(titulo)
await maestro.locator('textarea').first().fill('Un curso creado por el flujo E2E.')
await maestro.getByRole('button', { name: /Crear borrador/i }).click()
await maestro.waitForURL('**/maestro/cursos/**', { timeout: 10000 })
await maestro.waitForTimeout(1000)
ok('tras crear, abre el editor', maestro.url().includes('/maestro/cursos/'))
ok('el curso está en estado Borrador', await maestro.getByText('Borrador').first().isVisible())

console.log('\n── HU-4.3: añade módulo y lección ──')
await maestro.locator('input[placeholder="Título del módulo"]').fill('Módulo 1')
await maestro.getByRole('button', { name: 'Añadir' }).click()
await maestro.waitForTimeout(900)
await maestro.getByRole('button', { name: /Añadir lección/i }).click()
await maestro.waitForTimeout(300)
await maestro.locator('input[placeholder="Título de la lección"]').fill('Lección 1')
await maestro.locator('textarea[placeholder="Contenido (texto de la lección)"]').fill('El contenido.')
await maestro.getByRole('button', { name: 'Guardar' }).click()
await maestro.waitForTimeout(1000)
ok('la lección aparece en el módulo', await maestro.getByText('Lección 1').first().isVisible())

console.log('\n── HU-5.1: envía a revisión ──')
await maestro.getByRole('button', { name: /Enviar a revisión/i }).click()
await maestro.waitForTimeout(1200)
ok('el curso pasa a Enviado', await maestro.getByText(/Esperando la revisión/i).isVisible())

console.log('\n── HU-5.2: el admin revisa y aprueba ──')
const admin = await ventana()
await login(admin, 'admin@elcaminoangosto.test')
await admin.goto(`${BASE}/admin/revisiones`, { waitUntil: 'networkidle' }); await admin.waitForTimeout(1200)
const fila = admin.locator('article', { hasText: titulo })
ok('el curso aparece en la cola de revisión', await fila.count() > 0)
await fila.getByRole('button', { name: /Tomar para revisar/i }).click()
await admin.waitForTimeout(1000)
await fila.getByRole('button', { name: /^Aprobar$/i }).click()
await admin.waitForTimeout(1200)
ok('tras aprobar, el curso sale de la cola', (await admin.locator('article', { hasText: titulo }).count()) === 0)

console.log('\n── HU-5.3: el maestro publica ──')
await maestro.reload({ waitUntil: 'networkidle' }); await maestro.waitForTimeout(1200)
ok('el maestro ve el curso Aprobado', await maestro.getByText('Aprobado').first().isVisible())
await maestro.getByRole('button', { name: /^Publicar$/i }).click()
await maestro.waitForTimeout(1200)
ok('el curso queda Publicado', await maestro.getByText(/Publicado y visible/i).isVisible())

console.log('\n── hito S2: el estudiante YA lo ve en el catálogo ──')
const estudiante = await ventana()
await login(estudiante, 'ester@elcaminoangosto.test')
await estudiante.goto(`${BASE}/discipulado`, { waitUntil: 'networkidle' }); await estudiante.waitForTimeout(1400)
ok('el curso publicado aparece en el catálogo del estudiante', await estudiante.getByText(titulo).first().isVisible())

console.log('\n── Consola ──')
ok('sin errores de JavaScript', errores.length === 0, errores.slice(0, 2).join(' | '))

await browser.close()
console.log(`\n${fallos.length === 0 ? '════ HITO S2 VERIFICADO EN NAVEGADOR ════' : `════ ${fallos.length} FALLARON: ${fallos.join(', ')} ════`}`)
process.exit(fallos.length === 0 ? 0 : 1)
