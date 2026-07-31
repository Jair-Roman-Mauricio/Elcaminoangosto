import type { Lesson } from './api'

/**
 * Icono de una lección según su tipo (compartido por la vista del alumno y el
 * canvas del maestro). Video = pantalla con play; Evaluación = portapapeles con
 * check; Lectura = documento. El color es heredable vía `className` para que se
 * vea también sobre fondos de acento (fila activa en vino).
 */
export function IconoLeccion({
  tipo,
  className = 'size-5 shrink-0 text-vino',
}: {
  tipo: Lesson['type']
  className?: string
}) {
  if (tipo === 'VIDEO') {
    return (
      <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none">
        <rect x="3.5" y="5" width="17" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
        <path d="m10 9 4.5 2.5L10 14V9Z" fill="currentColor" />
        <path d="M8 21h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    )
  }

  if (tipo === 'IMAGE') {
    return (
      <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none">
        <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="8.5" cy="9.5" r="1.5" fill="currentColor" />
        <path d="m4 17 4.5-4.5L12 16l3.5-3.5L20 17" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  if (tipo === 'EXAM') {
    return (
      <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none">
        <path d="M7 3.5h10v17H7v-17Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="m9.5 9 1.5 1.5L14.5 7M9.5 15h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none">
      <path d="M6 3.5h8l4 4V20.5H6V3.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M14 3.5v4h4M9 12h6M9 15.5h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}
