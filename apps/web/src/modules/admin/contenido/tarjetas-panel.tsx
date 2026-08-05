import { useRef, useState } from 'react'
import { Boton, Chip, Field, Input, Modal, ModalConfirmacion, Textarea } from '@elcamino/ui'
import { subirMedioReanudable, esperarProcesado } from '../../../lib/media-upload'
import { ApiError } from '../../../lib/api-client'
import {
  useTarjetasAdmin,
  useCambiarEstadoTarjeta,
  useEliminarTarjeta,
  usePublicarTarjetaAdmin,
  type TarjetaAdmin,
} from './contenido-api'

const FORMATO_FECHA = new Intl.DateTimeFormat('es-PE', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

/**
 * Tarjetas de Fe en el módulo Contenido: el admin ve todas (publicadas,
 * ocultas y las que aún se están procesando), retira las que no deban verse y
 * sube nuevas.
 */
export function TarjetasPanel() {
  const { data: tarjetas, isPending } = useTarjetasAdmin()
  const cambiarEstado = useCambiarEstadoTarjeta()
  const eliminar = useEliminarTarjeta()
  const [subiendo, setSubiendo] = useState(false)
  const [aEliminar, setAEliminar] = useState<TarjetaAdmin | null>(null)

  const lista = tarjetas ?? []
  const publicadas = lista.filter((t) => t.status === 'PUBLISHED').length

  return (
    <div className="flex flex-col gap-aire-m">
      <div className="flex flex-wrap items-center justify-between gap-aire-s">
        <p className="m-0 font-ui text-body-s text-texto-tenue">
          {isPending
            ? 'Cargando…'
            : `${lista.length} tarjeta(s) · ${publicadas} visible(s) en el feed.`}
        </p>
        <Boton variante="tarjeta" onClick={() => setSubiendo(true)}>
          Subir tarjeta
        </Boton>
      </div>

      {!isPending && lista.length === 0 && (
        <p className="m-0 font-ui text-body-s text-texto-tenue">
          Todavía no hay tarjetas. Sube la primera con «Subir tarjeta».
        </p>
      )}

      {lista.length > 0 && (
        <ul className="m-0 grid list-none grid-cols-1 gap-aire-m p-0 sm:grid-cols-2 md:grid-cols-3">
          {lista.map((t) => (
            <li key={t.id}>
              <TarjetaEnLista
                tarjeta={t}
                ocupado={cambiarEstado.isPending || eliminar.isPending}
                onCambiarEstado={(status) => cambiarEstado.mutate({ id: t.id, status })}
                onEliminar={() => setAEliminar(t)}
              />
            </li>
          ))}
        </ul>
      )}

      {(cambiarEstado.isError || eliminar.isError) && (
        <p role="alert" className="m-0 font-ui text-body-s text-peligro">
          {mensajeDeError(cambiarEstado.error ?? eliminar.error)}
        </p>
      )}

      <ModalSubirTarjeta abierto={subiendo} onCerrar={() => setSubiendo(false)} />

      <ModalConfirmacion
        abierto={aEliminar !== null}
        titulo="Eliminar la tarjeta"
        descripcion="Se borra la tarjeta y su archivo de video o imagen. No se puede deshacer; si solo quieres que deje de verse,úsala como oculta."
        textoConfirmar="Eliminar"
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

function TarjetaEnLista({
  tarjeta,
  ocupado,
  onCambiarEstado,
  onEliminar,
}: {
  tarjeta: TarjetaAdmin
  ocupado: boolean
  onCambiarEstado: (status: 'PUBLISHED' | 'HIDDEN') => void
  onEliminar: () => void
}) {
  const publicada = tarjeta.status === 'PUBLISHED'
  const lista = tarjeta.mediaStatus === 'READY'

  return (
    <article className="flex h-full flex-col gap-aire-s bg-superficie-1 p-aire-m shadow-[0_0.9rem_2.2rem_-0.5rem_rgba(20,17,15,0.22)]">
      <div className="relative aspect-[9/16] w-full overflow-hidden bg-superficie-2">
        {tarjeta.posterUrl ? (
          <img
            src={tarjeta.posterUrl}
            alt=""
            className="size-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="grid size-full place-items-center font-mono text-eyebrow uppercase tracking-label text-texto-debil">
            {lista ? 'Sin vista previa' : 'Procesando'}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-aire-xs">
        <Chip tamano="mini" tono={publicada ? 'neutro' : 'acento'}>
          {publicada ? 'Publicada' : 'Oculta'}
        </Chip>
        <Chip tamano="mini">{tarjeta.type === 'VIDEO' ? 'Video' : 'Imagen'}</Chip>
        {/* Una tarjeta publicada no aparece en el feed hasta que su medio esté
            listo: sin esto, el admin no entiende por qué no la ve. */}
        {!lista && (
          <Chip tamano="mini" tono="acento">
            Medio {tarjeta.mediaStatus.toLowerCase()}
          </Chip>
        )}
      </div>

      <p className="m-0 line-clamp-2 font-ui text-body-s text-contenido">
        {tarjeta.title || tarjeta.manifesto || tarjeta.caption || (
          <span className="text-texto-tenue">Sin ficha</span>
        )}
      </p>
      <p className="m-0 font-mono text-eyebrow text-texto-tenue">
        {tarjeta.authorName} · {FORMATO_FECHA.format(new Date(tarjeta.createdAt))}
      </p>

      <div className="mt-auto flex flex-wrap gap-aire-xs pt-aire-xs">
        <Boton
          variante="pastilla"
          disabled={ocupado}
          onClick={() => onCambiarEstado(publicada ? 'HIDDEN' : 'PUBLISHED')}
        >
          {publicada ? 'Ocultar' : 'Publicar'}
        </Boton>
        <Boton variante="pastilla" disabled={ocupado} onClick={onEliminar}>
          Eliminar
        </Boton>
      </div>
    </article>
  )
}

type Fase = 'elegir' | 'subiendo' | 'procesando' | 'publicando'

/** Aspecto del `<input type="file">`, que no tiene componente propio. */
const CLASE_ARCHIVO =
  'font-mono text-body-s text-texto-tenue file:mr-aire-s file:rounded file:border ' +
  'file:border-linea file:bg-superficie-2 file:px-aire-s file:py-1 file:font-mono ' +
  'file:text-eyebrow file:uppercase file:tracking-label file:text-contenido hover:file:border-acento'

/** Campos de texto de la ficha. Vacío = no se envía (queda nulo). */
const FICHA_VACIA = {
  title: '',
  manifesto: '',
  story: '',
  origin: '',
  reference: '',
  caption: '',
}

/**
 * Subida de una tarjeta desde el módulo Contenido: el medio, la ficha que se
 * lee en el lienzo y, opcionalmente, el relato hablado. Reutiliza el mismo
 * camino que el maestro: TUS reanudable → espera del procesado → publicación.
 */
function ModalSubirTarjeta({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const publicar = usePublicarTarjetaAdmin()
  const inputRef = useRef<HTMLInputElement>(null)
  const [fase, setFase] = useState<Fase>('elegir')
  const [pct, setPct] = useState(0)
  const [ficha, setFicha] = useState(FICHA_VACIA)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [audio, setAudio] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)

  const ocupado = fase !== 'elegir'
  const campo = (clave: keyof typeof FICHA_VACIA) => ({
    value: ficha[clave],
    disabled: ocupado,
    onChange: (e: { target: { value: string } }) =>
      setFicha((f) => ({ ...f, [clave]: e.target.value })),
  })

  const limpiar = () => {
    setArchivo(null)
    setAudio(null)
    setFicha(FICHA_VACIA)
    setError(null)
    setPct(0)
  }

  const cerrar = () => {
    if (ocupado) return
    limpiar()
    onCerrar()
  }

  /** Texto sin espacios, o `null` si el campo quedó vacío. */
  const oNulo = (valor: string) => valor.trim() || null

  const subir = async () => {
    if (!archivo) return
    setError(null)
    try {
      const kind = archivo.type.startsWith('image/') ? 'IMAGE' : 'VIDEO'
      setFase('subiendo')
      const assetId = await subirMedioReanudable(archivo, kind, 'feed-media', setPct)

      // El relato hablado va al mismo bucket; el audio no se transcodifica.
      let audioAssetId: string | null = null
      if (audio) {
        audioAssetId = await subirMedioReanudable(audio, 'AUDIO', 'feed-media', setPct, {
          procesar: false,
        })
      }

      setFase('procesando')
      const estado = await esperarProcesado(assetId)
      if (estado.status === 'FAILED') throw new Error('No se pudo procesar el archivo')

      setFase('publicando')
      await publicar.mutateAsync({
        mediaAssetId: assetId,
        caption: oNulo(ficha.caption),
        title: oNulo(ficha.title),
        manifesto: oNulo(ficha.manifesto),
        story: oNulo(ficha.story),
        origin: oNulo(ficha.origin),
        reference: oNulo(ficha.reference),
        audioAssetId,
      })
      setFase('elegir')
      limpiar()
      onCerrar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado')
      setFase('elegir')
    }
  }

  return (
    <Modal
      abierto={abierto}
      onCerrar={cerrar}
      titulo="Subir una tarjeta"
      descripcion="Un video vertical corto o una imagen. Se publica al terminar de procesarse."
      className="max-w-4xl"
    >
      {/* Dos columnas: a la izquierda los archivos y los datos cortos; a la
          derecha los textos largos. En una sola columna el diálogo se volvía
          una tira altísima. */}
      <div className="grid gap-aire-s sm:grid-cols-2">
        <div className="flex flex-col gap-aire-s">
          <Field
            label="Archivo"
            htmlFor="tarjeta-archivo"
            hint="Video vertical corto o imagen."
          >
            <input
              id="tarjeta-archivo"
              ref={inputRef}
              type="file"
              accept="video/mp4,video/quicktime,image/jpeg,image/png"
              disabled={ocupado}
              onChange={(e) => {
                setArchivo(e.target.files?.[0] ?? null)
                setError(null)
              }}
              className={CLASE_ARCHIVO}
            />
          </Field>

          {archivo && (
            <p className="m-0 font-mono text-body-s text-contenido">
              {archivo.name} · {(archivo.size / (1024 * 1024)).toFixed(1)} MB
            </p>
          )}

          <Field label="Título" htmlFor="tarjeta-titulo" hint="Encabeza el lienzo.">
            <Input
              id="tarjeta-titulo"
              maxLength={120}
              placeholder="La puerta angosta"
              {...campo('title')}
            />
          </Field>

          <Field label="Origen" htmlFor="tarjeta-origen" hint="De dónde viene la pieza.">
            <Input
              id="tarjeta-origen"
              maxLength={120}
              placeholder="Umbral del recorrido"
              {...campo('origin')}
            />
          </Field>

          <Field label="Referencia" htmlFor="tarjeta-referencia" hint="Cita bíblica, si la tiene.">
            <Input
              id="tarjeta-referencia"
              maxLength={120}
              placeholder="Mateo 7:13–14"
              {...campo('reference')}
            />
          </Field>

          <Field
            label="Relato hablado (opcional)"
            htmlFor="tarjeta-audio"
            hint="Audio para escuchar en el lienzo."
          >
            <input
              id="tarjeta-audio"
              type="file"
              accept="audio/mpeg,audio/mp4,audio/ogg,audio/wav"
              disabled={ocupado}
              onChange={(e) => setAudio(e.target.files?.[0] ?? null)}
              className={CLASE_ARCHIVO}
            />
          </Field>
        </div>

        <div className="flex flex-col gap-aire-s">
          <Field
            label="Manifiesto"
            htmlFor="tarjeta-manifiesto"
            hint="La frase destacada, en grande, junto a la imagen."
          >
            <Textarea
              id="tarjeta-manifiesto"
              maxLength={280}
              rows={3}
              placeholder="Toda puerta recuerda que la fe también es una decisión."
              {...campo('manifesto')}
            />
          </Field>

          <Field
            label="Relato"
            htmlFor="tarjeta-relato"
            hint="Separa los párrafos con una línea en blanco."
          >
            <Textarea
              id="tarjeta-relato"
              maxLength={4000}
              rows={9}
              placeholder={'Primer párrafo…\n\nSegundo párrafo…'}
              {...campo('story')}
            />
          </Field>

          <Field label="Texto breve (opcional)" htmlFor="contenido-caption" hint="Para listados.">
            <Textarea
              id="contenido-caption"
              maxLength={500}
              rows={2}
              placeholder="Un versículo, una idea breve…"
              {...campo('caption')}
            />
          </Field>
        </div>
      </div>

      <div className="mt-aire-s flex flex-col gap-aire-s">
        {fase === 'subiendo' && (
          <p className="m-0 font-mono text-body-s text-texto-tenue">Subiendo… {pct}%</p>
        )}
        {fase === 'procesando' && (
          <p className="m-0 font-mono text-body-s text-texto-tenue">
            Procesando el archivo. Puede tardar un poco.
          </p>
        )}
        {fase === 'publicando' && (
          <p className="m-0 font-mono text-body-s text-texto-tenue">Publicando…</p>
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
            onClick={() => void subir()}
            disabled={ocupado || !archivo}
          >
            {ocupado ? 'Subiendo…' : 'Subir y publicar'}
          </Boton>
        </div>
      </div>
    </Modal>
  )
}

/** Mensaje legible de un fallo del API. */
function mensajeDeError(error: unknown): string {
  return error instanceof ApiError ? error.message : 'No se pudo aplicar el cambio.'
}
