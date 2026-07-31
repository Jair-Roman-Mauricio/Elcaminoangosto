/**
 * Componentes de gráfica compartidos por los dashboards (maestro y admin).
 * Todo es SVG en línea con los tokens del sistema (tema-aware). Sin librerías.
 */

export interface Serie {
  label: string
  valor: number
  rank?: number
  color?: string
}

export function recorta(txt: string, n = 9): string {
  return txt.length > n ? `${txt.slice(0, n - 1)}…` : txt
}

/**
 * Barras verticales de magnitud con eje Y y cuadrícula. Una sola tinta (el
 * acento): la identidad la dan las etiquetas y la posición, no el color (guía
 * dataviz). Extremo superior redondeado; valor directo sobre cada barra.
 */
export function BarrasV({ datos, unidad }: { datos: Serie[]; unidad: string }) {
  const W = 340
  const H = 190
  const padL = 26
  const padR = 8
  const padT = 14
  const padB = 34
  const maxV = Math.max(1, ...datos.map((d) => d.valor))
  const top = maxV <= 4 ? maxV : Math.ceil(maxV / 4) * 4
  const step = top <= 4 ? 1 : top / 4
  const ticks: number[] = []
  for (let t = 0; t <= top; t += step) ticks.push(t)

  const plotW = W - padL - padR
  const plotH = H - padT - padB
  const baseline = padT + plotH
  const band = plotW / datos.length
  const barW = Math.min(46, band * 0.5)
  const xBar = (i: number) => padL + band * i + (band - barW) / 2
  const yVal = (v: number) => padT + plotH * (1 - v / top)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Barras: ${unidad}`}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} y1={yVal(t)} x2={W - padR} y2={yVal(t)} stroke="var(--linea)" strokeWidth="1" />
          <text x={padL - 5} y={yVal(t) + 3} textAnchor="end" fontSize="8" fill="var(--texto-debil)" fontFamily="var(--mono)">
            {t}
          </text>
        </g>
      ))}
      {datos.map((d, i) => (
        <g key={d.label}>
          <title>{`${d.label}: ${d.valor} ${unidad}(s)`}</title>
          <rect
            x={xBar(i)}
            y={yVal(d.valor)}
            width={barW}
            height={Math.max(0, baseline - yVal(d.valor))}
            rx="4"
            fill="var(--vino)"
          />
          <text x={xBar(i) + barW / 2} y={yVal(d.valor) - 4} textAnchor="middle" fontSize="9" fill="var(--contenido)" fontFamily="var(--mono)">
            {d.valor}
          </text>
          <text x={xBar(i) + barW / 2} y={baseline + 13} textAnchor="middle" fontSize="8" fill="var(--texto-tenue)" fontFamily="var(--mono)">
            {recorta(d.label)}
          </text>
        </g>
      ))}
    </svg>
  )
}

/**
 * Dona de composición. Colores categóricos validados (Okabe-Ito, CVD-safe) con
 * leyenda + porcentaje directo, para que la identidad no dependa solo del color.
 * Plana a propósito: el 3D distorsiona las proporciones.
 */
export function Dona({ datos, unidad }: { datos: Serie[]; unidad: string }) {
  const total = datos.reduce((s, d) => s + d.valor, 0)
  const cx = 60
  const cy = 60
  const r = 46
  const C = 2 * Math.PI * r
  const gap = datos.length > 1 ? 2 : 0
  let acumulado = 0

  return (
    <div className="flex flex-wrap items-center gap-aire-m">
      <svg viewBox="0 0 120 120" width="128" height="128" role="img" aria-label={`Composición de ${unidad}`} className="shrink-0">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--linea)" strokeWidth="15" />
        {total > 0 &&
          datos.map((d) => {
            const len = (d.valor / total) * C
            const dash = Math.max(0, len - gap)
            const seg = (
              <circle
                key={d.label}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={d.color ?? 'var(--vino)'}
                strokeWidth="15"
                strokeDasharray={`${dash} ${C - dash}`}
                strokeDashoffset={-acumulado}
                transform={`rotate(-90 ${cx} ${cy})`}
              >
                <title>{`${d.label}: ${d.valor} (${Math.round((d.valor / total) * 100)}%)`}</title>
              </circle>
            )
            acumulado += len
            return seg
          })}
        <text x={cx} y={cy} textAnchor="middle" fontSize="22" fill="var(--contenido)" fontFamily="var(--mono)">
          {total}
        </text>
        <text x={cx} y={cy + 13} textAnchor="middle" fontSize="7" fill="var(--texto-tenue)" fontFamily="var(--mono)" letterSpacing="0.1em">
          {unidad.toUpperCase()}
        </text>
      </svg>
      <ul className="m-0 flex min-w-0 flex-1 list-none flex-col gap-aire-xs p-0">
        {datos.map((d) => (
          <li key={d.label} className="flex items-center gap-aire-xs font-mono text-body-s">
            <span
              className="size-[0.65rem] shrink-0 rounded-[2px]"
              style={{ background: d.color ?? 'var(--vino)' }}
              aria-hidden="true"
            />
            <span className="text-contenido">{d.label}</span>
            <span className="ml-auto tabular-nums text-texto-tenue">
              {d.valor} · {total > 0 ? Math.round((d.valor / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
