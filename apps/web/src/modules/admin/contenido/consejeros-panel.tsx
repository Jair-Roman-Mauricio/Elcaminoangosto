import { useEffect, useState } from 'react'
import { Boton, Chip, Field, Input, Modal, ModalConfirmacion, Textarea } from '@elcamino/ui'
import { subirMedioReanudable, esperarProcesado } from '../../../lib/media-upload'
import { ApiError } from '../../../lib/api-client'
import {
  useConsejeros,
  useEditarConsejero,
  useEliminarConsejero,
  usePublicarConsejero,
  type Consejero,
} from '../../consejeria/consejeria-api'
import { CANALES } from '../../consejeria/canales'

/**
 * Consejería en el módulo Contenido.
 *
 * Es la única lista de la plataforma donde un dato mal escrito tiene coste
 * real: un número con una cifra de menos deja a alguien llamando a nadie. Por
 * eso los contactos se añaden uno a uno y se ven tal como quedarán.
 */
export function ConsejerosPanel() {
  const { data, isPending } = useConsejeros()
  const editar = useEditarConsejero()
  const eliminar = useEliminarConsejero()
  const [escribiendo, setEscribiendo] = useState(false)
  const [aCorregir, setACorregir] = useState<Consejero | null>(null)
  const [aEliminar, setAEliminar] = useState<Consejero | null>(null)

  const lista = data ?? []
  const urgencias = lista.filter((c) => c.atiendeUrgencias && !c.oculto).length

  return (
    <div className="flex flex-col gap-aire-m">
      <div className="flex flex-wrap items-center justify-between gap-aire-s">
        <p className="m-0 font-ui text-body-s text-texto-tenue">
          {isPending
            ? 'Cargando…'
            : `${lista.length} consejero(s) · ${urgencias} atiende(n) urgencias.`}
        </p>
        <Boton variante="tarjeta" onClick={() => setEscribiendo(true)}>
          Añadir consejero
        </Boton>
      </div>

      {!isPending && lista.length === 0 && (
        <p className="m-0 font-ui text-body-s text-texto-tenue">
          Todavía no hay consejeros. La sección aparecerá vacía para quien la abra.
        </p>
      )}

      {lista.length > 0 && (
        <ul className="m-0 grid list-none grid-cols-1 gap-aire-m p-0 sm:grid-cols-2 md:grid-cols-3">
          {lista.map((consejero) => (
            <li key={consejero.id}>
              <article className="flex h-full flex-col gap-aire-s bg-superficie-1 p-aire-m shadow-[0_0.9rem_2.2rem_-0.5rem_rgba(20,17,15,0.22)]">
                <div className="flex flex-wrap items-center gap-aire-xs">
                  <Chip tamano="mini" tono={consejero.oculto ? 'acento' : 'neutro'}>
                    {consejero.oculto ? 'Oculto' : 'Visible'}
                  </Chip>
                  {consejero.atiendeUrgencias && (
                    <Chip tamano="mini" tono="acento">
                      Urgencias
                    </Chip>
                  )}
                  <Chip tamano="mini">
                    {Object.keys(consejero.contactos).length} contacto(s)
                  </Chip>
                </div>

                <p className="m-0 font-ui text-body-s text-contenido">{consejero.nombre}</p>
                {consejero.rol && (
                  <p className="m-0 font-mono text-eyebrow uppercase tracking-label text-texto-tenue">
                    {consejero.rol}
                  </p>
                )}

                <div className="mt-auto flex flex-wrap gap-aire-xs pt-aire-xs">
                  <Boton
                    variante="pastilla"
                    disabled={editar.isPending || eliminar.isPending}
                    onClick={() => setACorregir(consejero)}
                  >
                    Editar
                  </Boton>
                  <Boton
                    variante="pastilla"
                    disabled={editar.isPending || eliminar.isPending}
                    onClick={() => editar.mutate({ id: consejero.id, oculto: !consejero.oculto })}
                  >
                    {consejero.oculto ? 'Mostrar' : 'Ocultar'}
                  </Boton>
                  <Boton
                    variante="pastilla"
                    disabled={editar.isPending || eliminar.isPending}
                    onClick={() => setAEliminar(consejero)}
                  >
                    Quitar
                  </Boton>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}

      {(editar.isError || eliminar.isError) && (
        <p role="alert" className="m-0 font-ui text-body-s text-peligro">
          {mensajeDeError(editar.error ?? eliminar.error)}
        </p>
      )}

      <ModalConsejero
        abierto={escribiendo || aCorregir !== null}
        consejero={aCorregir}
        onCerrar={() => {
          setEscribiendo(false)
          setACorregir(null)
        }}
      />

      <ModalConfirmacion
        abierto={aEliminar !== null}
        titulo="Quitar al consejero"
        descripcion="Deja de aparecer en Consejería. No se puede deshacer; si solo quieres que no se vea por ahora, ocúltalo."
        textoConfirmar="Quitar"
        ocupado={eliminar.isPending}
        onConfirmar={() => {
          if (aEliminar) eliminar.mutate(aEliminar.id)
          setAEliminar(null)
        }}
        onCancelar={() => setAEliminar(null)}
      />
    </div>
  )
}

const CLASE_ARCHIVO =
  'font-mono text-body-s text-texto-tenue file:mr-aire-s file:rounded file:border ' +
  'file:border-linea file:bg-superficie-2 file:px-aire-s file:py-1 file:font-mono ' +
  'file:text-eyebrow file:uppercase file:tracking-label file:text-contenido hover:file:border-acento'

const FICHA_VACIA = { nombre: '', rol: '', presentacion: '', orden: '0' }

/** El mismo formulario añade y corrige. */
function ModalConsejero({
  abierto,
  consejero,
  onCerrar,
}: {
  abierto: boolean
  /** El consejero que se corrige. Nulo: se está añadiendo uno nuevo. */
  consejero: Consejero | null
  onCerrar: () => void
}) {
  const esCorreccion = consejero !== null
  const publicar = usePublicarConsejero()
  const editar = useEditarConsejero()
  const [ficha, setFicha] = useState(FICHA_VACIA)
  const [contactos, setContactos] = useState<{ clave: string; dato: string }[]>([])
  const [urgencias, setUrgencias] = useState(false)
  const [foto, setFoto] = useState<File | null>(null)
  const [fase, setFase] = useState<'elegir' | 'subiendo' | 'procesando' | 'guardando'>('elegir')
  const [pct, setPct] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const ocupado = fase !== 'elegir'

  useEffect(() => {
    if (!abierto || !consejero) return
    setFicha({
      nombre: consejero.nombre,
      rol: consejero.rol ?? '',
      presentacion: consejero.presentacion ?? '',
      orden: String(consejero.orden),
    })
    setContactos(Object.entries(consejero.contactos).map(([clave, dato]) => ({ clave, dato })))
    setUrgencias(consejero.atiendeUrgencias)
  }, [abierto, consejero])

  const campo = (clave: keyof typeof FICHA_VACIA) => ({
    value: ficha[clave],
    disabled: ocupado,
    onChange: (e: { target: { value: string } }) =>
      setFicha((f) => ({ ...f, [clave]: e.target.value })),
  })

  const limpiar = () => {
    setFicha(FICHA_VACIA)
    setContactos([])
    setUrgencias(false)
    setFoto(null)
    setError(null)
    setPct(0)
  }

  const cerrar = () => {
    if (ocupado) return
    limpiar()
    onCerrar()
  }

  const oNulo = (valor: string) => valor.trim() || null

  const guardar = async () => {
    setError(null)
    try {
      // Al corregir, lo que no se toca no se manda: `null` habría borrado la
      // foto de un consejero solo por no elegir otra.
      let fotoAssetId: string | null | undefined = esCorreccion ? undefined : null
      if (foto) {
        setFase('subiendo')
        fotoAssetId = await subirMedioReanudable(foto, 'IMAGE', 'feed-media', setPct)
        setFase('procesando')
        const estado = await esperarProcesado(fotoAssetId)
        if (estado.status === 'FAILED') throw new Error('No se pudo procesar la foto')
      }

      setFase('guardando')
      const cuerpo = {
        nombre: ficha.nombre.trim(),
        rol: oNulo(ficha.rol),
        presentacion: oNulo(ficha.presentacion),
        contactos: Object.fromEntries(
          contactos.filter((c) => c.dato.trim()).map((c) => [c.clave, c.dato.trim()]),
        ),
        atiendeUrgencias: urgencias,
        orden: Number(ficha.orden) || 0,
      }

      if (esCorreccion) {
        await editar.mutateAsync({ id: consejero.id, ...cuerpo, fotoAssetId })
      } else {
        await publicar.mutateAsync({ ...cuerpo, fotoAssetId: fotoAssetId ?? null })
      }
      setFase('elegir')
      limpiar()
      onCerrar()
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : 'Error inesperado')
      setFase('elegir')
    }
  }

  const disponibles = CANALES.filter((c) => !contactos.some((x) => x.clave === c.clave))
  const nombreDe = (clave: string) => CANALES.find((c) => c.clave === clave)?.nombre ?? clave
  const completo = ficha.nombre.trim().length >= 2

  return (
    <Modal
      abierto={abierto}
      onCerrar={cerrar}
      titulo={esCorreccion ? 'Editar al consejero' : 'Añadir un consejero'}
      descripcion="Quien llegue a esta lista puede estar en su peor día: comprueba que cada número y cada correo estén bien escritos."
      className="max-w-3xl"
    >
      <div className="grid gap-aire-s sm:grid-cols-2">
        <div className="flex flex-col gap-aire-s">
          <Field label="Nombre" htmlFor="consejero-nombre" hint="Como quiere que le llamen.">
            <Input id="consejero-nombre" maxLength={120} placeholder="Rafael Román" {...campo('nombre')} />
          </Field>

          <Field label="Rol (opcional)" htmlFor="consejero-rol" hint="Pastor, consejera familiar…">
            <Input id="consejero-rol" maxLength={120} placeholder="Pastor y consejero" {...campo('rol')} />
          </Field>

          <Field
            label="Foto (opcional)"
            htmlFor="consejero-foto"
            hint={esCorreccion ? 'Elige otra solo si quieres cambiarla.' : 'Una cara ayuda a escribir.'}
          >
            <input
              id="consejero-foto"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={ocupado}
              onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
              className={CLASE_ARCHIVO}
            />
          </Field>

          <Field label="Orden" htmlFor="consejero-orden" hint="Menor primero, dentro de su grupo.">
            <Input id="consejero-orden" type="number" min={0} max={999} {...campo('orden')} />
          </Field>

          <label className="flex items-start gap-aire-xs font-ui text-body-s text-contenido">
            <input
              type="checkbox"
              checked={urgencias}
              disabled={ocupado}
              onChange={(e) => setUrgencias(e.target.checked)}
              className="mt-1 size-4 accent-[var(--oro)]"
            />
            <span>
              Atiende urgencias
              <span className="block font-mono text-eyebrow text-texto-tenue">
                Aparece primero, con su contacto destacado. Márcalo solo si de verdad puede
                responder pronto.
              </span>
            </span>
          </label>
        </div>

        <div className="flex flex-col gap-aire-s">
          <Field
            label="Presentación (opcional)"
            htmlFor="consejero-presentacion"
            hint="Dos líneas: quién es y en qué puede ayudar."
          >
            <Textarea
              id="consejero-presentacion"
              maxLength={400}
              rows={4}
              placeholder="Veinte años acompañando a familias. Si estás en tu peor día, escríbeme."
              {...campo('presentacion')}
            />
          </Field>

          <fieldset className="m-0 flex flex-col gap-aire-xs border-0 p-0">
            <legend className="mb-aire-xs p-0 font-mono text-eyebrow uppercase tracking-label text-texto-tenue">
              Contactos
            </legend>

            {contactos.map((contacto, i) => (
              <div key={contacto.clave} className="flex items-center gap-aire-xs">
                <span className="w-[5.5rem] shrink-0 font-mono text-body-s text-contenido">
                  {nombreDe(contacto.clave)}
                </span>
                <Input
                  aria-label={`Dato de ${nombreDe(contacto.clave)}`}
                  value={contacto.dato}
                  disabled={ocupado}
                  placeholder={
                    contacto.clave === 'correo'
                      ? 'nombre@correo.com'
                      : contacto.clave === 'telefono' || contacto.clave === 'whatsapp'
                        ? '+51 999 111 222'
                        : 'https://…'
                  }
                  onChange={(e) =>
                    setContactos(contactos.map((c, j) => (i === j ? { ...c, dato: e.target.value } : c)))
                  }
                />
                <Boton
                  variante="pastilla"
                  tamano="compacto"
                  disabled={ocupado}
                  onClick={() => setContactos(contactos.filter((_, j) => j !== i))}
                >
                  Quitar
                </Boton>
              </div>
            ))}

            {disponibles.length > 0 && (
              <select
                aria-label="Añadir un contacto"
                value=""
                disabled={ocupado}
                onChange={(e) => {
                  if (e.target.value) setContactos([...contactos, { clave: e.target.value, dato: '' }])
                }}
                className="w-full rounded border border-linea bg-superficie-2 px-aire-s py-2 font-mono text-body-s text-contenido"
              >
                <option value="">Añadir un contacto…</option>
                {disponibles.map((canal) => (
                  <option key={canal.clave} value={canal.clave}>
                    {canal.nombre}
                  </option>
                ))}
              </select>
            )}

            <p className="m-0 font-mono text-eyebrow text-texto-tenue">
              Solo salen los que añadas aquí. Un botón que no lleva a nadie es peor que no tenerlo.
            </p>
          </fieldset>
        </div>
      </div>

      <div className="mt-aire-s flex flex-col gap-aire-s">
        {fase === 'subiendo' && (
          <p className="m-0 font-mono text-body-s text-texto-tenue">Subiendo la foto… {pct}%</p>
        )}
        {fase === 'procesando' && (
          <p className="m-0 font-mono text-body-s text-texto-tenue">Procesando la foto…</p>
        )}
        {fase === 'guardando' && (
          <p className="m-0 font-mono text-body-s text-texto-tenue">Guardando…</p>
        )}
        {error && (
          <p role="alert" className="m-0 font-ui text-body-s text-peligro">
            {error}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-aire-xs">
          <Boton variante="contorno" tamano="compacto" onClick={cerrar} disabled={ocupado}>
            Cancelar
          </Boton>
          <Boton
            variante="formulario"
            tamano="compacto"
            onClick={() => void guardar()}
            disabled={ocupado || !completo}
          >
            {ocupado ? 'Guardando…' : esCorreccion ? 'Guardar' : 'Añadir'}
          </Boton>
        </div>
      </div>
    </Modal>
  )
}

function mensajeDeError(error: unknown): string {
  return error instanceof ApiError ? error.message : 'No se pudo aplicar el cambio.'
}
