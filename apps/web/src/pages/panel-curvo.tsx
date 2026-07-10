/**
 * Panel oscuro con borde en S, dibujado por código.
 *
 * Sustituye a la banda que venía quemada en la obra original. Al ser un `path`
 * normalizado (viewBox 100×100 + `preserveAspectRatio="none"`), se estira a
 * cualquier tamaño sin recortar ni deformar la imagen de fondo, y el ancho de
 * la banda deja de depender del recorte del `<img>`.
 */

/**
 * Curva medida sobre la obra original, píxel a píxel: sube de `x=0.47` en la
 * cabecera hasta un vértice en `x=0.72` (a un 63% de la altura) y vuelve a
 * `0.64` en el pie.
 *
 * La amplitud se reduce al 70% de la original: con la curva íntegra, la banda
 * más estrecha dejaba menos de 400px al formulario en una pantalla de 1440.
 * Así el vértice llega al 32.9% del ancho del panel y quedan ~540px.
 */
const BORDE =
  'M 0.0 0.0 Q 0.74 4.1 1.52 6.1 Q 2.31 8.1 3.32 10.15 Q 4.33 12.2 5.71 14.25 ' +
  'Q 7.09 16.3 8.61 18.35 Q 10.13 20.4 11.88 22.4 Q 13.62 24.4 15.41 26.45 ' +
  'Q 17.2 28.5 18.86 30.55 Q 20.52 32.6 22.27 34.65 Q 24.01 36.7 25.34 38.7 ' +
  'Q 26.68 40.7 27.82 42.75 Q 28.97 44.8 29.94 46.85 Q 30.91 48.9 31.46 50.9 ' +
  'Q 32.01 52.9 32.38 54.95 Q 32.74 57.0 32.84 59.05 Q 32.93 61.1 32.93 63.15 ' +
  'Q 32.93 65.2 32.7 67.2 Q 32.48 69.2 32.1 71.25 Q 31.73 73.3 31.23 75.35 ' +
  'Q 30.73 77.4 29.99 79.45 Q 29.25 81.5 28.47 83.5 Q 27.69 85.5 26.77 87.55 ' +
  'Q 25.86 89.6 24.75 91.65 Q 23.64 93.7 22.63 95.7 Q 21.62 97.7 21.04 98.85 ' +
  'L 20.46 100.0'

/** El relleno cierra el `path` contra el borde derecho. */
const RELLENO = `${BORDE} L 100 100 L 100 0 Z`

/**
 * Negro azulado de la obra. No es un token del sistema (DESIGN.md prohíbe un
 * tercer acento): existe solo aquí, para que el panel continúe la atmósfera
 * fría de la fotografía en vez de cortar contra el `--negro` puro.
 */
export const FONDO_PANEL = '#0d1117'

export function PanelCurvo({ className = '' }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={className}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      focusable="false"
    >
      <path d={RELLENO} fill={FONDO_PANEL} />
      {/* Filete tenue sobre la curva, como en la obra original. */}
      <path
        d={BORDE}
        fill="none"
        stroke="rgba(247, 246, 242, 0.22)"
        // Con `preserveAspectRatio="none"` el trazo se deformaría al estirarse.
        // `non-scaling-stroke` lo fija en píxeles reales: 1px a cualquier tamaño.
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
