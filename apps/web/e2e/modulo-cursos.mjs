import { chromium } from 'playwright'
const BASE = 'http://localhost:4173'
const fallos = []
const ok = (t, c, x = '') => { console.log(`  ${c ? 'PASA ' : 'FALLA'} │ ${t}${x ? ` — ${x}` : ''}`); if (!c) fallos.push(t) }
const b = await chromium.launch()
const errores = []

async function login(p, email, pass = 'camino123') {
  await p.goto(`${BASE}/entrar`, { waitUntil: 'networkidle' })
  await p.evaluate(() => localStorage.clear())
  await p.goto(`${BASE}/entrar`, { waitUntil: 'networkidle' })
  await p.fill('#email', email); await p.fill('#password', pass)
  await p.click('button[type="submit"]'); await p.waitForTimeout(1600)
}

const emailProfe = `profe-${Date.now()}@elcaminoangosto.org`

console.log('\n── El ADMIN crea una cuenta de profesor ──')
const admin = await b.newPage({ viewport: { width: 1280, height: 900 } })
admin.on('pageerror', (e) => errores.push('admin: ' + e))
await login(admin, 'admin@elcaminoangosto.test')
ok('el admin ve el Panel (dashboard)', await admin.getByRole('heading', { name: 'Panel' }).isVisible())
ok('el dashboard muestra métricas', await admin.getByText('Usuarios', { exact: false }).first().isVisible())

await admin.goto(`${BASE}/admin/usuarios`, { waitUntil: 'networkidle' }); await admin.waitForTimeout(800)
await admin.getByRole('button', { name: 'Crear cuenta' }).click(); await admin.waitForTimeout(400)
await admin.fill('#nc-nombre', 'Profe E2E')
await admin.fill('#nc-correo', emailProfe)
await admin.fill('#nc-pass', 'profe12345')
await admin.selectOption('#nc-rol', 'MAESTRO')
await admin.getByRole('button', { name: /^Crear cuenta$/ }).last().click()
await admin.waitForTimeout(1800)
ok('la cuenta de profesor aparece en la lista', await admin.getByText('Profe E2E').first().isVisible())

console.log('\n── El ADMIN usa «Ver como profesor» ──')
await admin.getByRole('button', { name: 'Profesor' }).click()
await admin.waitForTimeout(1200)
ok('navega a Mis cursos', admin.url().includes('/maestro/cursos'))
ok('aparece el banner «Viendo como profesor»', await admin.getByText(/Viendo como profesor/i).isVisible())
await admin.getByRole('button', { name: /Volver a admin/i }).click(); await admin.waitForTimeout(800)
ok('vuelve al panel de admin', admin.url().includes('/admin'))

console.log('\n── El PROFESOR inicia sesión y ve interfaz de alumno + Mis cursos ──')
const profe = await b.newPage({ viewport: { width: 1280, height: 900 } })
profe.on('pageerror', (e) => errores.push('profe: ' + e))
await login(profe, emailProfe, 'profe12345')
ok('el profesor entra (catálogo)', profe.url().includes('/discipulado') || profe.url().includes('/tarjetas'))
await profe.goto(`${BASE}/discipulado`, { waitUntil: 'networkidle' }); await profe.waitForTimeout(1000)
// nav de profesor: Discipulado (como alumno) + Mis cursos
ok('la nav tiene Discipulado (como alumno)', await profe.getByRole('link', { name: 'Discipulado' }).isVisible())
ok('la nav tiene «Mis cursos» (crear cursos)', await profe.getByRole('link', { name: 'Mis cursos' }).isVisible())
ok('ve el catálogo de cursos como un alumno', await profe.getByRole('heading', { name: /Catálogo/i }).isVisible())

console.log('\n── El PROFESOR crea un borrador de curso ──')
await profe.getByRole('link', { name: 'Mis cursos' }).click(); await profe.waitForTimeout(1000)
await profe.getByRole('button', { name: 'Nuevo curso' }).click(); await profe.waitForTimeout(400)
const titulo = `Curso del profe ${Date.now()}`
await profe.locator('#nuevo-titulo').fill(titulo)
await profe.locator('#nuevo-desc').fill('Un borrador creado por el profesor recién dado de alta.')
await profe.getByRole('button', { name: /Crear borrador/i }).click()
await profe.waitForURL('**/maestro/cursos/**', { timeout: 10000 }); await profe.waitForTimeout(1000)
ok('el borrador se crea y abre el editor', profe.url().includes('/maestro/cursos/'))
ok('el curso está en Borrador', await profe.getByText('Borrador').first().isVisible())

console.log('\n── Consola ──')
ok('sin errores de JavaScript', errores.length === 0, errores.slice(0, 2).join(' | '))

await b.close()
console.log(`\n${fallos.length === 0 ? '════ MÓDULO DE CURSOS VERIFICADO ════' : `════ ${fallos.length} FALLARON: ${fallos.join(', ')} ════`}`)
process.exit(fallos.length === 0 ? 0 : 1)
