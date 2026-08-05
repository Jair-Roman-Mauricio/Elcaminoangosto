/**
 * Telones para la página de un devocional.
 *
 * Son dibujos, no fotos: una foto de fondo compite con la ilustración que va al
 * lado y con el texto que hay que leer. Formas grandes y planas, del tamaño del
 * bloque entero, en los oros de la marca sobre el negro — lo bastante presentes
 * para que la página tenga color y lo bastante planas para que el titular siga
 * mandando.
 *
 * Se guardan por su clave, así que se pueden retocar sin tocar lo publicado. Si
 * se añade uno nuevo, hay que añadirlo también a la lista permitida de la
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
      viewBox="0 0 1200 700"
    >
      {/* El campo base: el negro de la marca, no el fondo del tema, para que la
          banda se lea como una pieza y no como un trozo de página. */}
      <rect width="1200" height="700" fill="var(--negro)" />
      {clave === 'brasas' && <Brasas />}
      {clave === 'vitral' && <Vitral />}
      {clave === 'ondas' && <Ondas />}
      {clave === 'polvo' && <Polvo />}
    </svg>
  )
}

/** Manchas grandes de brasa, como carbón encendido visto de cerca. */
function Brasas() {
  return (
    <>
      <defs>
        <radialGradient id="fondo-brasas" cx="72%" cy="35%" r="78%">
          <stop offset="0%" stopColor="#5a3f0c" />
          <stop offset="55%" stopColor="#2a1e08" />
          <stop offset="100%" stopColor="var(--negro)" />
        </radialGradient>
      </defs>
      <rect width="1200" height="700" fill="url(#fondo-brasas)" />
      <g fill="var(--oro-hondo)" opacity="0.34">
        <ellipse cx="245" cy="120" rx="230" ry="185" />
        <ellipse cx="880" cy="600" rx="300" ry="210" />
        <circle cx="1090" cy="180" r="150" />
      </g>
      <g fill="var(--oro)" opacity="0.16">
        <ellipse cx="600" cy="360" rx="210" ry="290" />
        <circle cx="330" cy="560" r="120" />
      </g>
    </>
  )
}

/** Cuñas de luz alta, como la que entra por una vidriera. */
function Vitral() {
  return (
    <>
      <defs>
        <linearGradient id="fondo-vitral" x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0%" stopColor="#4a350a" />
          <stop offset="100%" stopColor="var(--negro)" />
        </linearGradient>
      </defs>
      <rect width="1200" height="700" fill="url(#fondo-vitral)" />
      <g fill="var(--oro-hondo)" opacity="0.4">
        <polygon points="480,-40 700,-40 400,740 210,740" />
        <polygon points="880,-40 1000,-40 720,740 585,740" />
      </g>
      <g fill="var(--oro-claro)" opacity="0.1">
        <polygon points="760,-40 830,-40 590,740 500,740" />
        <polygon points="1080,-40 1240,-40 1010,740 830,740" />
      </g>
    </>
  )
}

/** Curvas anchas: el camino visto desde arriba, sin dibujarlo del todo. */
function Ondas() {
  return (
    <>
      <defs>
        <linearGradient id="fondo-ondas" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--negro)" />
          <stop offset="100%" stopColor="#3b2a08" />
        </linearGradient>
      </defs>
      <rect width="1200" height="700" fill="url(#fondo-ondas)" />
      <g fill="var(--oro-hondo)" opacity="0.32">
        <path d="M-60 520 C 240 380, 470 600, 760 420 S 1120 160, 1280 220 L1280 760 L-60 760 Z" />
      </g>
      <g fill="var(--oro)" opacity="0.12">
        <path d="M-60 640 C 280 520, 520 720, 820 540 S 1140 320, 1280 380 L1280 760 L-60 760 Z" />
      </g>
      <g fill="none" stroke="var(--oro-claro)" strokeOpacity="0.22" strokeWidth="2">
        <path d="M-60 400 C 260 280, 430 480, 700 320 S 1080 90, 1280 150" />
        <path d="M-60 300 C 220 200, 360 400, 640 240 S 1040 20, 1280 80" />
      </g>
    </>
  )
}

/** Un haz de luz con polvo suspendido dentro. */
function Polvo() {
  // Sembradas con una progresión fija: siempre el mismo dibujo, sin azar que
  // cambie de una carga a otra.
  const motas = Array.from({ length: 120 }, (_, i) => ({
    x: (i * 137.5) % 1200,
    y: (i * 241.7) % 700,
    r: 1 + ((i * 7) % 5) * 0.7,
    o: 0.08 + ((i * 3) % 7) * 0.045,
  }))

  return (
    <>
      <defs>
        <radialGradient id="fondo-polvo" cx="68%" cy="25%" r="85%">
          <stop offset="0%" stopColor="#4d3708" />
          <stop offset="60%" stopColor="#241a06" />
          <stop offset="100%" stopColor="var(--negro)" />
        </radialGradient>
      </defs>
      <rect width="1200" height="700" fill="url(#fondo-polvo)" />
      <g fill="var(--oro-hondo)" opacity="0.28">
        <polygon points="700,-40 980,-40 620,740 330,740" />
      </g>
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
