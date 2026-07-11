import type { CourseStatus } from '@elcamino/shared-types'

const ETIQUETAS: Record<CourseStatus, { texto: string; clase: string }> = {
  DRAFT: { texto: 'Borrador', clase: 'text-texto-tenue border-linea' },
  SUBMITTED: { texto: 'Enviado', clase: 'text-aviso border-aviso/40' },
  UNDER_REVIEW: { texto: 'En revisión', clase: 'text-marino border-marino/50' },
  APPROVED: { texto: 'Aprobado', clase: 'text-exito border-exito/40' },
  PUBLISHED: { texto: 'Publicado', clase: 'text-exito border-exito/60' },
  REJECTED: { texto: 'Rechazado', clase: 'text-vino border-vino/50' },
  ARCHIVED: { texto: 'Archivado', clase: 'text-texto-debil border-linea' },
}

export function EstadoBadge({ status }: { status: CourseStatus }) {
  const { texto, clase } = ETIQUETAS[status]
  return (
    <span
      className={`inline-block rounded border px-aire-xs py-1 font-mono text-eyebrow uppercase tracking-label ${clase}`}
    >
      {texto}
    </span>
  )
}
