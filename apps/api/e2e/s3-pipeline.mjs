// Pipeline S3 real: subir video → transcodificar (ffmpeg en el worker) → publicar → ver en el feed.
import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'

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

// 1) Generar un clip de prueba con ffmpeg (2s, vertical, con audio).
const clip = '/tmp/tarjeta-test.mp4'
if (!existsSync(clip)) {
  execFileSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'testsrc=size=720x1280:rate=24:duration=2',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', clip], { stdio: 'ignore' })
}
console.log('  clip de prueba:', (readFileSync(clip).length / 1024).toFixed(0), 'KB')

const maestro = await login('maestro@elcaminoangosto.test')
const estudiante = await login('esteban@elcaminoangosto.test')

console.log('\n── HU-8.1: reservar la subida ──')
let r = await j(await api(maestro, '/media/uploads', { method: 'POST', body: JSON.stringify({ kind: 'VIDEO', bucket: 'feed-media' }) }))
ok('crear subida → 201', r.status === 201, `status=${r.status}`)
const { assetId, bucket, path } = r.body
ok('la ruta incluye la carpeta del usuario', path.startsWith('22222222-2222-4222-8222-000000000002/'), path)

console.log('\n── subir el archivo (aquí, directo con la service key; el navegador usará TUS) ──')
const SRK = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const up = await fetch(`${SB}/storage/v1/object/${bucket}/${path}`, {
  method: 'POST', headers: { Authorization: `Bearer ${SRK}`, apikey: SRK, 'Content-Type': 'video/mp4' },
  body: readFileSync(clip),
})
ok('el original queda en Storage', up.ok, `status=${up.status}`)

console.log('\n── HU-8.2: encolar y transcodificar (worker + ffmpeg) ──')
r = await j(await api(maestro, `/media/uploads/${assetId}/process`, { method: 'POST' }))
ok('encolar → 201', r.status === 201, `status=${r.status}`)

// Esperar a que el worker marque READY (con timeout).
let estado = 'UPLOADED'
for (let i = 0; i < 40; i++) {
  await new Promise((s) => setTimeout(s, 1500))
  r = await j(await api(maestro, `/media/${assetId}/status`))
  estado = r.body?.status
  if (estado === 'READY' || estado === 'FAILED') break
}
ok('el worker transcodifica y marca READY', estado === 'READY', `estado=${estado}`)
ok('generó un póster', Boolean(r.body?.posterPath), r.body?.posterPath ?? 'sin póster')

console.log('\n── HU-3.3: publicar la tarjeta ──')
r = await j(await api(maestro, '/feed', { method: 'POST', body: JSON.stringify({ mediaAssetId: assetId, caption: 'Contad el costo — Lucas 14:28' }) }))
ok('publicar tarjeta → 201', r.status === 201, `status=${r.status}`)

console.log('\n── un ESTUDIANTE no puede publicar ──')
r = await j(await api(estudiante, '/feed', { method: 'POST', body: JSON.stringify({ mediaAssetId: assetId, caption: 'x' }) }))
ok('estudiante publica → 403', r.status === 403, `status=${r.status}`)

console.log('\n── HU-3.1: el feed vertical muestra la tarjeta con URL firmada ──')
r = await j(await api(estudiante, '/feed'))
const tarjeta = r.body?.find((c) => c.caption?.includes('Contad el costo'))
ok('la tarjeta aparece en el feed', Boolean(tarjeta))
ok('trae una URL firmada del video', /token=/.test(tarjeta?.mediaUrl ?? ''), (tarjeta?.mediaUrl ?? '').slice(0, 60))
ok('trae una URL firmada del póster', /token=/.test(tarjeta?.posterUrl ?? ''))

console.log('\n── la URL firmada reproduce, con faststart y Range (arranque <2s) ──')
if (tarjeta?.mediaUrl) {
  const head = await fetch(tarjeta.mediaUrl, { headers: { Range: 'bytes=0-1023' } })
  ok('el video se sirve con Range (206)', head.status === 206, `status=${head.status}`)
  ok('es un MP4', (head.headers.get('content-type') || '').includes('mp4'), head.headers.get('content-type'))
  // Comprobar faststart: el átomo moov debe estar cerca del principio.
  const buf = Buffer.from(await (await fetch(tarjeta.mediaUrl)).arrayBuffer())
  const moov = buf.indexOf(Buffer.from('moov'))
  const mdat = buf.indexOf(Buffer.from('mdat'))
  ok('faststart: moov antes que mdat', moov > 0 && moov < mdat, `moov@${moov} mdat@${mdat}`)
}

console.log(`\n${fallos.length === 0 ? '════ PIPELINE S3 VERIFICADO ════' : `════ ${fallos.length} FALLARON: ${fallos.join(', ')} ════`}`)
process.exit(fallos.length === 0 ? 0 : 1)
