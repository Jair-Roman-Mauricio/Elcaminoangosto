import { useState } from 'react'
import { Boton, Field, Input, Modal } from '@elcamino/ui'
import { useFavoriteSongsStore } from '../../stores/favorite-songs.store'

/**
 * El código que respalda los favoritos.
 *
 * Se enseña UNA vez, justo al crear el primer álbum, porque después ya no se
 * puede recuperar: del código solo se guarda su huella. La advertencia es
 * deliberadamente seca —«no hay forma de recuperarlo»— para que nadie cierre
 * el aviso pensando que le llegará por correo.
 */
export function AvisoDeCodigoNuevo() {
  const { codigoReciente, olvidarCodigoReciente } = useFavoriteSongsStore()
  const [copiado, setCopiado] = useState(false)

  if (!codigoReciente) return null

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(codigoReciente)
      setCopiado(true)
    } catch {
      // Sin permiso de portapapeles queda el código a la vista para copiarlo.
    }
  }

  return (
    <Modal abierto titulo="Guarda este código" onCerrar={olvidarCodigoReciente}>
      <div className="flex flex-col gap-aire-s">
        <p className="m-0 font-ui text-body text-contenido">
          Con él recuperas tus canciones guardadas y tus álbumes en cualquier otro
          dispositivo o navegador.
        </p>

        <p
          className="m-0 select-all border border-linea bg-superficie-2 px-aire-s py-aire-xs text-center font-mono text-h-m tracking-[0.2em] text-contenido"
          aria-label={`Tu código es ${codigoReciente.split('').join(' ')}`}
        >
          {codigoReciente}
        </p>

        <p className="m-0 font-ui text-body-s text-vino">
          Apúntalo ahora: no se guarda en ninguna parte y no hay forma de recuperarlo.
          Si lo pierdes, pierdes la colección.
        </p>

        <div className="flex flex-wrap gap-aire-xs">
          <Boton variante="primary" tamano="compacto" onClick={() => void copiar()}>
            {copiado ? 'Copiado' : 'Copiar código'}
          </Boton>
          <Boton variante="contorno" tamano="compacto" onClick={olvidarCodigoReciente}>
            Ya lo guardé
          </Boton>
        </div>
      </div>
    </Modal>
  )
}

/** Campo para traer una colección guardada en otro dispositivo. */
export function RestaurarConCodigo() {
  const { codigo, restaurarConCodigo } = useFavoriteSongsStore()
  const [valor, setValor] = useState('')
  const [estado, setEstado] = useState<'quieto' | 'buscando' | 'falla'>('quieto')

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault()
    setEstado('buscando')
    setEstado((await restaurarConCodigo(valor)) ? 'quieto' : 'falla')
    setValor('')
  }

  return (
    <form onSubmit={(e) => void enviar(e)} className="flex flex-col gap-aire-xs">
      <Field
        label="Recuperar con un código"
        htmlFor="codigo-coleccion"
        hint={
          codigo
            ? 'Sustituirá lo guardado en este navegador por la colección de ese código.'
            : 'Pega aquí el código que te dimos al crear tu primer álbum.'
        }
        error={estado === 'falla' ? 'No hay ninguna colección con ese código.' : undefined}
      >
        <Input
          id="codigo-coleccion"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="XXXXX-XXXXX"
          autoComplete="off"
          spellCheck={false}
          className="font-mono uppercase tracking-[0.14em]"
        />
      </Field>
      <Boton
        variante="contorno"
        tamano="compacto"
        type="submit"
        disabled={estado === 'buscando' || valor.trim().length < 6}
        className="self-start"
      >
        {estado === 'buscando' ? 'Buscando…' : 'Recuperar'}
      </Boton>
    </form>
  )
}
