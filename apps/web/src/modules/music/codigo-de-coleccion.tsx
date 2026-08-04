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

        <p className="m-0 font-ui text-body-s text-acento">
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

/**
 * Botón + diálogo para traer una colección guardada en otro dispositivo.
 *
 * Va en diálogo y no suelto bajo los álbumes porque es una acción de rescate,
 * poco frecuente: en línea competía con lo que la persona viene a hacer, que
 * es escuchar lo que ya tiene guardado.
 */
export function RestaurarConCodigo() {
  const { codigo, restaurarConCodigo } = useFavoriteSongsStore()
  const [abierto, setAbierto] = useState(false)
  const [valor, setValor] = useState('')
  const [estado, setEstado] = useState<'quieto' | 'buscando' | 'falla'>('quieto')

  const cerrar = () => {
    setAbierto(false)
    setValor('')
    setEstado('quieto')
  }

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault()
    setEstado('buscando')
    if (await restaurarConCodigo(valor)) cerrar()
    else setEstado('falla')
  }

  return (
    <>
      <Boton variante="contorno" tamano="compacto" onClick={() => setAbierto(true)}>
        Recuperar álbumes de favoritos
      </Boton>

      <Modal abierto={abierto} titulo="Recuperar álbumes de favoritos" onCerrar={cerrar}>
        <form onSubmit={(e) => void enviar(e)} className="flex flex-col gap-aire-s">
          <Field
            label="Código"
            htmlFor="codigo-coleccion"
            hint={
              codigo
                ? 'Sustituirá lo guardado en este navegador por la colección de ese código.'
                : 'Es el código que te dimos al crear tu primer álbum.'
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
              autoFocus
              className="font-mono uppercase tracking-[0.14em]"
            />
          </Field>

          <div className="flex flex-wrap gap-aire-xs">
            <Boton
              variante="primary"
              tamano="compacto"
              type="submit"
              disabled={estado === 'buscando' || valor.trim().length < 6}
            >
              {estado === 'buscando' ? 'Buscando…' : 'Recuperar'}
            </Boton>
            <Boton variante="contorno" tamano="compacto" type="button" onClick={cerrar}>
              Cancelar
            </Boton>
          </div>
        </form>
      </Modal>
    </>
  )
}
