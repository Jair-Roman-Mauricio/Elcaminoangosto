import { Chip, type ChipTamano, type ChipTono } from '@elcamino/ui'
import type { ModerationStatus } from './authoring-api'

/**
 * Marcas de moderación de contenido publicado (HU-7.2). Un solo lugar decide
 * cómo se llama y cómo se pinta cada estado: la cola del admin, su detalle y el
 * catálogo del maestro leen lo mismo.
 *
 * Ninguna va rellena: el relleno de vino es de los botones. Lo retirado se
 * distingue con un punto delante, no con más peso de color.
 */
const ESTADOS: Record<
  ModerationStatus,
  { texto: string; tono: ChipTono; titulo: string; punto?: boolean }
> = {
  APPROVED: {
    texto: 'Publicado',
    tono: 'acento',
    titulo: 'Verificado por el administrador: visible para los estudiantes',
  },
  PENDING: {
    texto: 'Pendiente',
    tono: 'acento',
    titulo: 'Esperando la verificación del administrador: los estudiantes no lo ven',
  },
  BLOCKED: {
    texto: 'Bloqueado',
    tono: 'acento',
    titulo: 'Retirado por el administrador: hay que corregirlo',
    punto: true,
  },
}

/** Punto de acento: marca lo retirado sin rellenar la píldora. */
function Punto() {
  return <span aria-hidden="true" className="size-[0.35rem] shrink-0 rounded-full bg-vino" />
}

export function MarcaModeracion({
  estado,
  tamano = 'normal',
  className,
}: {
  estado: ModerationStatus
  /** `mini` cuando acompaña a una fila de contenido, junto a sus acciones. */
  tamano?: ChipTamano
  className?: string
}) {
  const { texto, tono, titulo, punto } = ESTADOS[estado]
  return (
    <Chip tono={tono} tamano={tamano} title={titulo} className={className}>
      {punto && <Punto />}
      {texto}
    </Chip>
  )
}

/** El curso completo está bloqueado: ningún estudiante puede acceder. */
export function MarcaCursoBloqueado({ className }: { className?: string }) {
  return (
    <Chip
      tono="acento"
      title="Bloqueado por moderación: inaccesible para los estudiantes"
      className={className}
    >
      <Punto />
      Curso bloqueado
    </Chip>
  )
}

/** Recuento de contenidos en un estado dado («3 pendientes»). */
export function MarcaRecuento({
  estado,
  cantidad,
  className,
}: {
  estado: Extract<ModerationStatus, 'PENDING' | 'BLOCKED'>
  cantidad: number
  className?: string
}) {
  if (cantidad === 0) return null
  const nombre = estado === 'PENDING' ? 'pendiente' : 'bloqueado'
  return (
    <Chip tono="neutro" className={className}>
      {cantidad} {cantidad === 1 ? nombre : `${nombre}s`}
    </Chip>
  )
}
