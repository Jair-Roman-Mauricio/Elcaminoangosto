/**
 * Telones para la página de un devocional.
 *
 * Son dibujos, no fotos: una foto de fondo compite con la ilustración que va
 * al lado y con el texto que hay que leer. Los cuatro usan el oro de la marca
 * sobre el negro y se quedan por debajo del contenido, insinuados.
 *
 * Se guardan por su clave, así que se pueden retocar sin tocar lo publicado.
 * Si se añade uno nuevo, hay que añadirlo también a la lista permitida de la
 * migración `20260805000500` y al esquema del controlador.
 */
export type ClaveDeFondo = 'brasas' | 'vitral' | 'ondas' | 'polvo'

export const FONDOS: { clave: ClaveDeFondo; nombre: string }[] = [
  { clave: 'brasas', nombre: 'Brasas' },
  { clave: 'vitral', nombre: 'Vitral' },
  { clave: 'ondas', nombre: 'Ondas' },
  { clave: 'polvo', nombre: 'Polvo de oro' },
]

export function FondoDeDevocional({ clave }: { clave: ClaveDeFondo }) {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
      preserveAspectRatio="xMidYMid slice"
      viewBox="0 0 1200 800"
    >
      {clave === 'brasas' && <Brasas />}
      {clave === 'vitral' && <Vitral />}
      {clave === 'ondas' && <Ondas />}
      {clave === 'polvo' && <Polvo />}
    </svg>
  )
}

/** Un rescoldo que se apaga hacia los bordes: calor sin encender la página. */
function Brasas() {
  return (
    <>
      <defs>
        <radialGradient id="fondo-brasas" cx="78%" cy="28%" r="72%">
          <stop offset="0%" stopColor="var(--oro)" stopOpacity="0.28" />
          <stop offset="45%" stopColor="var(--oro-hondo)" stopOpacity="0.14" />
          <stop offset="100%" stopColor="var(--negro)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1200" height="800" fill="url(#fondo-brasas)" />
      <circle cx="905" cy="215" r="250" fill="var(--oro-hondo)" opacity="0.1" />
      <circle cx="1050" cy="520" r="150" fill="var(--oro)" opacity="0.06" />
      <circle cx="720" cy="640" r="200" fill="var(--oro-hondo)" opacity="0.07" />
    </>
  )
}

/** Rayos rectos, como la luz que entra por una vidriera alta. */
function Vitral() {
  return (
    <>
      <defs>
        <linearGradient id="fondo-vitral" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="var(--oro-claro)" stopOpacity="0.2" />
          <stop offset="100%" stopColor="var(--oro-hondo)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g fill="url(#fondo-vitral)">
        <polygon points="620,-40 760,-40 470,840 300,840" />
        <polygon points="820,-40 900,-40 660,840 555,840" />
        <polygon points="960,-40 1090,-40 890,840 730,840" />
      </g>
      <rect width="1200" height="800" fill="var(--negro)" opacity="0.12" />
    </>
  )
}

/** Curvas largas: el camino visto desde arriba, sin dibujarlo del todo. */
function Ondas() {
  return (
    <>
      <g fill="none" stroke="var(--oro)" strokeOpacity="0.16" strokeWidth="1.5">
        <path d="M-50 640 C 260 520, 420 700, 700 540 S 1080 300, 1260 360" />
        <path d="M-50 700 C 280 580, 460 760, 740 600 S 1100 360, 1260 420" />
        <path d="M-50 560 C 240 460, 380 640, 660 480 S 1060 240, 1260 300" />
      </g>
      <g fill="none" stroke="var(--oro-claro)" strokeOpacity="0.1" strokeWidth="1">
        <path d="M-50 480 C 220 400, 340 580, 620 420 S 1040 180, 1260 240" />
        <path d="M-50 760 C 300 660, 500 820, 780 660 S 1120 420, 1260 480" />
      </g>
    </>
  )
}

/** Partículas suspendidas, como polvo en un haz de luz. */
function Polvo() {
  // Sembradas con una progresión fija: siempre el mismo dibujo, sin azar que
  // cambie de una carga a otra.
  const motas = Array.from({ length: 90 }, (_, i) => ({
    x: (i * 137.5) % 1200,
    y: (i * 241.7) % 800,
    r: 1 + ((i * 7) % 5) * 0.5,
    o: 0.05 + ((i * 3) % 7) * 0.025,
  }))

  return (
    <>
      <defs>
        <radialGradient id="fondo-polvo" cx="70%" cy="20%" r="80%">
          <stop offset="0%" stopColor="var(--oro-hondo)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--negro)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1200" height="800" fill="url(#fondo-polvo)" />
      {motas.map((mota, i) => (
        <circle
          key={i}
          cx={mota.x}
          cy={mota.y}
          r={mota.r}
          fill="var(--oro-claro)"
          opacity={mota.o}
        />
      ))}
    </>
  )
}
