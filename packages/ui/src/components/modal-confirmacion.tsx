import { Boton } from './boton'
import { Modal } from './modal'

export interface ModalConfirmacionProps {
  abierto: boolean
  titulo: string
  /** Qué va a pasar exactamente y a qué afecta. Sin rodeos. */
  descripcion: string
  /** Verbo de la acción, en la etiqueta del botón: «Bloquear», «Aprobar». */
  textoConfirmar: string
  textoCancelar?: string
  /** `true` mientras la acción está en vuelo: bloquea el doble envío. */
  ocupado?: boolean
  onConfirmar: () => void
  onCancelar: () => void
}

/**
 * Confirmación de una acción con consecuencias visibles para otros (publicar,
 * retirar, bloquear). Se apoya en `Modal`, así que hereda el foco atrapado, el
 * cierre con Escape y el clic fuera.
 *
 * Cancelar es la acción con el foco al abrir —`Modal` enfoca el primer control
 * del contenido—, para que un Enter accidental no confirme nada.
 */
export function ModalConfirmacion({
  abierto,
  titulo,
  descripcion,
  textoConfirmar,
  textoCancelar = 'Cancelar',
  ocupado = false,
  onConfirmar,
  onCancelar,
}: ModalConfirmacionProps) {
  return (
    <Modal
      abierto={abierto}
      onCerrar={onCancelar}
      titulo={titulo}
      descripcion={descripcion}
      className="max-w-lg"
    >
      {/* Escala compacta: dentro de un diálogo estrecho, la de formulario pesa
          más que el propio texto de la confirmación. */}
      <div className="flex flex-wrap justify-end gap-aire-xs">
        <Boton variante="contorno" tamano="compacto" onClick={onCancelar} disabled={ocupado}>
          {textoCancelar}
        </Boton>
        <Boton variante="formulario" tamano="compacto" onClick={onConfirmar} disabled={ocupado}>
          {ocupado ? 'Aplicando…' : textoConfirmar}
        </Boton>
      </div>
    </Modal>
  )
}
