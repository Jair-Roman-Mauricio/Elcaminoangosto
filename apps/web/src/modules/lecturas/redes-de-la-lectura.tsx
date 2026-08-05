import type { ReactNode } from 'react'

/**
 * El dibujo de cada red. Las direcciones no viven aquí: las pone quien publica,
 * lectura por lectura, eligiendo cuáles aparecen. Un texto firmado por alguien
 * de fuera lleva las suyas y no las de la casa.
 */
export const REDES: { clave: string; nombre: string; icono: ReactNode }[] = [
  {
    clave: 'youtube',
    nombre: 'YouTube',
    icono: (
      <path d="M23 12s0-3.2-.4-4.7a3 3 0 0 0-2.1-2.1C18.9 4.7 12 4.7 12 4.7s-6.9 0-8.5.5A3 3 0 0 0 1.4 7.3C1 8.8 1 12 1 12s0 3.2.4 4.7a3 3 0 0 0 2.1 2.1c1.6.5 8.5.5 8.5.5s6.9 0 8.5-.5a3 3 0 0 0 2.1-2.1C23 15.2 23 12 23 12ZM9.8 15.3V8.7l5.7 3.3-5.7 3.3Z" />
    ),
  },
  {
    clave: 'facebook',
    nombre: 'Facebook',
    icono: (
      <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.5 2.9h-2.3v7A10 10 0 0 0 22 12Z" />
    ),
  },
  {
    clave: 'instagram',
    nombre: 'Instagram',
    icono: (
      <path d="M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2Zm0 1.8c-3.1 0-3.5 0-4.7.1-1.1.1-1.7.2-2.1.4-.5.2-.9.4-1.3.8-.4.4-.6.8-.8 1.3-.2.4-.3 1-.4 2.1C2.7 9.9 2.7 10.2 2.7 12s0 2.1.1 3.3c.1 1.1.2 1.7.4 2.1.2.5.4.9.8 1.3.4.4.8.6 1.3.8.4.2 1 .3 2.1.4 1.2.1 1.6.1 4.7.1s3.5 0 4.7-.1c1.1-.1 1.7-.2 2.1-.4.5-.2.9-.4 1.3-.8.4-.4.6-.8.8-1.3.2-.4.3-1 .4-2.1.1-1.2.1-1.5.1-3.3s0-2.1-.1-3.3c-.1-1.1-.2-1.7-.4-2.1a3.4 3.4 0 0 0-.8-1.3 3.4 3.4 0 0 0-1.3-.8c-.4-.2-1-.3-2.1-.4-1.2-.1-1.6-.1-4.7-.1Zm0 3.1a4.9 4.9 0 1 1 0 9.8 4.9 4.9 0 0 1 0-9.8Zm0 8a3.1 3.1 0 1 0 0-6.2 3.1 3.1 0 0 0 0 6.2Zm6.3-8.2a1.15 1.15 0 1 1-2.3 0 1.15 1.15 0 0 1 2.3 0Z" />
    ),
  },
  {
    clave: 'tiktok',
    nombre: 'TikTok',
    icono: (
      <path d="M16.6 5.8a5 5 0 0 1-3-4.3h-3.3v13.4a2.9 2.9 0 1 1-2.1-2.8V8.7A6.2 6.2 0 1 0 13.6 15V8.9a8.2 8.2 0 0 0 4.8 1.5V7.1a4.9 4.9 0 0 1-1.8-1.3Z" />
    ),
  },
]

/**
 * Las redes que acompañan a una lectura.
 *
 * En columna cuelgan del margen de un artículo de revista; en fila acompañan al
 * texto de un devocional, que no tiene margen libre donde ponerlas.
 */
export function RedesDeLaLectura({
  redes,
  orientacion = 'columna',
}: {
  redes: Record<string, string>
  orientacion?: 'columna' | 'fila'
}) {
  // Solo las que esta lectura trae: un icono que no lleva a ninguna parte es
  // peor que no tener el icono.
  const activas = REDES.filter((red) => redes[red.clave])
  if (activas.length === 0) return null

  const enColumna = orientacion === 'columna'

  return (
    <div
      className={
        enColumna
          ? // Solo cuando de verdad cabe fuera de la columna de lectura: por
            // debajo de 1200 el margen izquierdo lo ocupa el menú.
            'absolute -left-[6rem] top-[0.2rem] hidden flex-col gap-[2px] [@media(min-width:1200px)]:flex'
          : 'mt-aire-xs flex flex-row gap-[2px]'
      }
    >
      {activas.map((red) => (
        <a
          key={red.clave}
          href={redes[red.clave]}
          target="_blank"
          rel="noreferrer"
          title={red.nombre}
          className="grid size-11 place-items-center border border-linea text-hueso no-underline transition-colors duration-fade ease-camino hover:border-acento hover:text-acento"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
            {red.icono}
          </svg>
          <span className="sr-only">{red.nombre}</span>
        </a>
      ))}
    </div>
  )
}
