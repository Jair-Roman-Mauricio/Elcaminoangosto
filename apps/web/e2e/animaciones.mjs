import { chromium } from 'playwright'
const b = await chromium.launch()
const fallos=[]; const ok=(t,c,x='')=>{console.log(`  ${c?'PASA ':'FALLA'} │ ${t}${x?` — ${x}`:''}`);if(!c)fallos.push(t)}

// 1) landing → login: el login monta con opacity animándose desde 0
const p = await b.newPage({ viewport:{width:1280,height:900} })
await p.goto('http://localhost:4173/entrar',{waitUntil:'domcontentloaded'})
// Captura muy pronto: la columna del form debe estar a opacidad < 1 (entrando)
await p.waitForTimeout(120)
// El wrapper animado por Framer lleva `opacity` en su `style` inline.
const opWrapper = () => p.evaluate(() => {
  const el = [...document.querySelectorAll('div[style*="opacity"]')].find(d => d.querySelector('#email'))
  return el ? parseFloat(el.style.opacity || '1') : 1
})
const opTemprano = await opWrapper()
await p.waitForTimeout(700)
const opTarde = await opWrapper()
ok('landing→login: el formulario entra animando la opacidad', opTemprano < 0.98 && opTarde > 0.98, `${opTemprano.toFixed(2)}→${opTarde.toFixed(2)}`)

// 2) registro↔login: alternar cambia el heading y expande/colapsa el campo Nombre
await p.goto('http://localhost:4173/entrar',{waitUntil:'networkidle'})
await p.waitForTimeout(700)
ok('inicia sin el campo Nombre (login)', (await p.locator('#displayName').count()) === 0)
await p.getByRole('button',{name:/Regístrate ahora/i}).click()
await p.waitForTimeout(600)
ok('tras alternar aparece el campo Nombre (registro)', await p.locator('#displayName').isVisible())
ok('el encabezado cambia a "Comienza tu camino"', await p.getByText('Comienza tu camino').isVisible())
await p.getByRole('button',{name:/Iniciar sesión/i}).click()
await p.waitForTimeout(600)
ok('vuelve a login: el campo Nombre se retira', (await p.locator('#displayName').count()) === 0)

// 3) reduced-motion: no debe romper nada
const p2 = await b.newPage({ viewport:{width:1280,height:900}, reducedMotion:'reduce' })
await p2.goto('http://localhost:4173/entrar',{waitUntil:'networkidle'})
await p2.waitForTimeout(500)
ok('con reduced-motion el formulario es visible', await p2.locator('#email').isVisible())

await b.close()
console.log(`\n${fallos.length===0?'════ ANIMACIONES OK ════':`════ ${fallos.length} FALLARON ════`}`)
process.exit(fallos.length===0?0:1)
