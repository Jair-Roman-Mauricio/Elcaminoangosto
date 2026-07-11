// Hito S2 contra el API real: maestro crea → envía → admin aprueba → estudiante lo ve; auditado.
const API = 'http://localhost:3000/api'
const SB = 'http://127.0.0.1:54321'
const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const fallos = []
const ok = (t, c, x = '') => { console.log(`  ${c ? 'PASA ' : 'FALLA'} │ ${t}${x ? ` — ${x}` : ''}`); if (!c) fallos.push(t) }

async function login(email) {
  const r = await fetch(`${SB}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'camino123' }),
  })
  return (await r.json()).access_token
}
const api = (tok, path, opts = {}) =>
  fetch(`${API}${path}`, { ...opts, headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json', ...opts.headers } })
const j = async (r) => ({ status: r.status, body: await r.json().catch(() => null) })

const maestro = await login('maestro@elcaminoangosto.test')
const admin = await login('admin@elcaminoangosto.test')
const ester = await login('ester@elcaminoangosto.test')      // nivel 2
const esteban = await login('esteban@elcaminoangosto.test')  // nivel 1

console.log('\n── HU-4.3: el maestro crea un borrador ──')
let r = await j(await api(maestro, '/discipleship/courses', { method: 'POST', body: JSON.stringify({ title: 'El costo del discipulado', description: 'Qué significa seguir a Cristo.', isFree: true, plannedModules: 1 }) }))
ok('crear borrador → 201', r.status === 201, `status=${r.status}`)
ok('nace en DRAFT', r.body?.status === 'DRAFT', r.body?.status)
const cursoId = r.body.id
const slug = r.body.slug
ok('genera un slug legible', slug === 'el-costo-del-discipulado', slug)

console.log('\n── HU-4.3: añade módulo y lección ──')
r = await j(await api(maestro, `/discipleship/courses/${cursoId}/modules`, { method: 'POST', body: JSON.stringify({ title: 'Módulo 1' }) }))
ok('añade módulo → 201', r.status === 201)
const moduleId = r.body.moduleId
r = await j(await api(maestro, `/discipleship/courses/${cursoId}/modules/${moduleId}/lessons`, { method: 'POST', body: JSON.stringify({ title: 'Contad el costo', type: 'TEXT', content: 'Lucas 14:28.' }) }))
ok('añade lección de texto → 201', r.status === 201)

console.log('\n── HU-5.1: el maestro envía a revisión ──')
r = await j(await api(maestro, `/discipleship/courses/${cursoId}/submit`, { method: 'POST' }))
ok('DRAFT → SUBMITTED', r.body?.status === 'SUBMITTED', r.body?.status)

// El estudiante todavía NO lo ve (no está publicado).
r = await j(await api(esteban, '/discipleship/catalog'))
ok('el curso enviado no aparece en el catálogo del estudiante', !r.body.some((c) => c.slug === slug))

console.log('\n── HU-5.1: el admin fue notificado ──')
r = await j(await api(admin, '/notifications'))
ok('el admin tiene una notificación COURSE_SUBMITTED', r.body.some((n) => n.type === 'COURSE_SUBMITTED' && n.payload.courseId === cursoId))

console.log('\n── el maestro NO puede autopublicar (regla inviolable) ──')
r = await j(await api(maestro, `/discipleship/courses/${cursoId}/publish`, { method: 'POST' }))
ok('publicar un SUBMITTED → 400 (transición inválida)', r.status === 400, `status=${r.status}`)

console.log('\n── HU-5.2: el admin revisa y aprueba ──')
r = await j(await api(admin, '/discipleship/review-queue'))
ok('el curso está en la cola de revisión', r.body.some((c) => c.id === cursoId))
r = await j(await api(admin, `/discipleship/courses/${cursoId}/take-review`, { method: 'POST' }))
ok('SUBMITTED → UNDER_REVIEW', r.body?.status === 'UNDER_REVIEW', r.body?.status)
r = await j(await api(admin, `/discipleship/courses/${cursoId}/approve`, { method: 'POST', body: JSON.stringify({ notes: 'Sólido y fiel.' }) }))
ok('UNDER_REVIEW → APPROVED', r.body?.status === 'APPROVED', r.body?.status)

console.log('\n── auditoría en course_reviews ──')
r = await j(await api(admin, `/discipleship/courses/${cursoId}/reviews`))
ok('la decisión quedó auditada', r.body.length === 1 && r.body[0].decision === 'APPROVED', JSON.stringify(r.body?.[0]?.decision))

console.log('\n── el maestro fue notificado de la decisión ──')
r = await j(await api(maestro, '/notifications'))
ok('el maestro tiene COURSE_REVIEWED (APPROVED)', r.body.some((n) => n.type === 'COURSE_REVIEWED' && n.payload.decision === 'APPROVED'))

console.log('\n── HU-5.3: publicación ──')
r = await j(await api(admin, `/discipleship/courses/${cursoId}/publish`, { method: 'POST' }))
ok('APPROVED → PUBLISHED', r.body?.status === 'PUBLISHED', r.body?.status)

console.log('\n── el estudiante YA lo ve publicado (hito S2) ──')
r = await j(await api(ester, '/discipleship/catalog'))
const enCatalogo = r.body.find((c) => c.slug === slug)
ok('el curso aparece publicado en el catálogo del estudiante', Boolean(enCatalogo))
ok('y está desbloqueado (curso abierto)', enCatalogo?.unlocked === true)

console.log('\n── HU-4.4: vista de estudiante del maestro (funciona en cualquier estado) ──')
r = await j(await api(maestro, `/discipleship/courses/${cursoId}/student-view`))
ok('el maestro previsualiza su curso', r.status === 200 && r.body.modules.length === 1, `status=${r.status}`)
r = await j(await api(ester, `/discipleship/courses/${cursoId}/student-view`))
ok('un estudiante NO puede previsualizar cursos ajenos → 403', r.status === 403, `status=${r.status}`)

console.log('\n── flujo de rechazo ──')
// Nuevo borrador para probar el rechazo
r = await j(await api(maestro, '/discipleship/courses', { method: 'POST', body: JSON.stringify({ title: 'Borrador flojo', isFree: true }) }))
const c2 = r.body.id
const mod2 = (await j(await api(maestro, `/discipleship/courses/${c2}/modules`, { method: 'POST', body: JSON.stringify({ title: 'M' }) }))).body.moduleId
await api(maestro, `/discipleship/courses/${c2}/modules/${mod2}/lessons`, { method: 'POST', body: JSON.stringify({ title: 'L', type: 'TEXT', content: 'x' }) })
await api(maestro, `/discipleship/courses/${c2}/submit`, { method: 'POST' })
await api(admin, `/discipleship/courses/${c2}/take-review`, { method: 'POST' })
r = await j(await api(admin, `/discipleship/courses/${c2}/reject`, { method: 'POST', body: JSON.stringify({ notes: 'Necesita más profundidad bíblica.' }) }))
ok('UNDER_REVIEW → REJECTED con notas', r.body?.status === 'REJECTED', r.body?.status)
r = await j(await api(admin, `/discipleship/courses/${c2}/reject`, { method: 'POST', body: JSON.stringify({ notes: '' }) }))
ok('rechazar sin notas → 400', r.status === 400)
r = await j(await api(maestro, `/discipleship/courses/${c2}/back-to-draft`, { method: 'POST' }))
ok('el maestro devuelve a borrador: REJECTED → DRAFT', r.body?.status === 'DRAFT', r.body?.status)

console.log(`\n${fallos.length === 0 ? '════ HITO S2 VERIFICADO ════' : `════ ${fallos.length} FALLARON: ${fallos.join(', ')} ════`}`)
process.exit(fallos.length === 0 ? 0 : 1)
