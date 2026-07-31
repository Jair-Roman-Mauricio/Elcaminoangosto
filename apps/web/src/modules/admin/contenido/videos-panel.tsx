import { useState } from 'react'
import { Boton, Chip, Field, Input, Modal, ModalConfirmacion, Textarea } from '@elcamino/ui'
import { subirMedioReanudable, esperarProcesado } from '../../../lib/media-upload'
import { ApiError } from '../../../lib/api-client'
import {
  useVideosAdmin,
  usePublicarVideo,
  useCambiarEstadoVideo,
  useEliminarVideo,
  type VideoAdmin,
} from './contenido-api'

const FORMATO_FECHA = new Intl.DateTimeFormat('es-PE', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

/** Aspecto del `<input type="file">`, que no tiene componente propio. */
const CLASE_ARCHIVO =
  'font-mono text-body-s text-texto-tenue file:mr-aire-s file:rounded file:border ' +
  'file:border-linea file:bg-superficie-2 file:px-aire-s file:py-1 file:font-mono ' +
  'file:text-eyebrow file:uppercase file:tracking-label file:text-contenido hover:file:border-vino'

/**
 * Videos cristianos en el módulo Contenido (HU-9.3): el admin ve todos —
 * publicados, ocultos y los que aún se transcodifican—, los retira y sube
 * nuevos.
 */
export function VideosPanel() {
  const { data: videos, isPending } = useVideosAdmin()
  const cambiarEstado = useCambiarEstadoVideo()
  const eliminar = useEliminarVideo()
  const [subiendo, setSubiendo] = useState(false)
  const [aEliminar, setAEliminar] = useState<VideoAdmin | null>(null)

  const lista = videos ?? []
  const publicados = lista.filter((v) => v.status === 'PUBLISHED').length

  return (
    <div className="flex flex-col gap-aire-m">
      <div className="flex flex-wrap items-center justify-between gap-aire-s">
        <p className="m-0 font-ui text-body-s text-texto-tenue">
          {isPending
            ? 'Cargando…'
            : `${lista.length} video(s) · ${publicados} visible(s) en el catálogo.`}
        </p>
        <Boton variante="tarjeta" onClick={() => setSubiendo(true)}>
          Subir video
        </Boton>
      </div>

      {!isPending && lista.length === 0 && (
        <p className="m-0 font-ui text-body-s text-texto-tenue">
          Todavía no hay videos. Sube el primero con «Subir video».
        </p>
      )}

      {lista.length > 0 && (
        <ul className="m-0 grid list-none grid-cols-1 gap-aire-m p-0 sm:grid-cols-2 lg:grid-cols-3">
          {lista.map((v) => (
            <li key={v.id}>
              <VideoEnLista
                video={v}
                ocupado={cambiarEstado.isPending || eliminar.isPending}
                onCambiarEstado={(status) => cambiarEstado.mutate({ id: v.id, status })}
                onEliminar={() => setAEliminar(v)}
              />
            </li>
          ))}
        </ul>
      )}

      {(cambiarEstado.isError || eliminar.isError) && (
        <p role="alert" className="m-0 font-ui text-body-s text-vino">
          {mensajeDeError(cambiarEstado.error ?? eliminar.error)}
        </p>
      )}

      <ModalSubirVideo abierto={subiendo} onCerrar={() => setSubiendo(false)} />

      <ModalConfirmacion
        abierto={aEliminar !== null}
        titulo="Eliminar el video"
        descripcion="Se borra el video y su archivo. No se puede deshacer; si solo quieres que deje de verse, ocúltalo."
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

function VideoEnLista({
  video,
  ocupado,
  onCambiarEstado,
  onEliminar,
}: {
  video: VideoAdmin
  ocupado: boolean
  onCambiarEstado: (status: 'PUBLISHED' | 'HIDDEN') => void
  onEliminar: () => void
}) {
  const publicado = video.status === 'PUBLISHED'
  const listo = video.mediaStatus === 'READY'

  return (
    <article className="flex h-full flex-col gap-aire-s bg-superficie-1 p-aire-m shadow-[0_0.9rem_2.2rem_-0.5rem_rgba(20,17,15,0.22)]">
      <div className="relative aspect-video w-full overflow-hidden bg-superficie-2">
        {video.posterUrl ? (
          <img src={video.posterUrl} alt="" className="size-full object-cover" loading="lazy" />
        ) : (
          <span className="grid size-full place-items-center font-mono text-eyebrow uppercase tracking-label text-texto-debil">
            {listo ? 'Sin vista previa' : 'Procesando'}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-aire-xs">
        <Chip tamano="mini" tono={publicado ? 'neutro' : 'acento'}>
          {publicado ? 'Publicado' : 'Oculto'}
        </Chip>
        {/* Un video publicado no sale en el catálogo hasta que se transcodifica. */}
        {!listo && (
          <Chip tamano="mini" tono="acento">
            Medio {video.mediaStatus.toLowerCase()}
          </Chip>
        )}
        {video.series && <Chip tamano="mini">{video.series}</Chip>}
      </div>

      <h3 className="m-0 font-mono text-h-s font-normal text-contenido">{video.title}</h3>
      {video.description && (
        <p className="m-0 line-clamp-2 font-ui text-body-s text-texto-tenue">{video.description}</p>
      )}
      <p className="m-0 font-mono text-eyebrow text-texto-tenue">
        {video.reference ? `${video.reference} · ` : ''}
        {FORMATO_FECHA.format(new Date(video.createdAt))}
      </p>

      <div className="mt-auto flex flex-wrap gap-aire-xs pt-aire-xs">
        <Boton
          variante="pastilla"
          disabled={ocupado}
          onClick={() => onCambiarEstado(publicado ? 'HIDDEN' : 'PUBLISHED')}
        >
          {publicado ? 'Ocultar' : 'Publicar'}
        </Boton>
        <Boton variante="pastilla" disabled={ocupado} onClick={onEliminar}>
          Eliminar
        </Boton>
      </div>
    </article>
  )
}

type Fase = 'elegir' | 'subiendo' | 'procesando' | 'publicando'

const FICHA_VACIA = { title: '', series: '', description: '', reference: '' }

/**
 * Subida de un video: archivo + ficha. A diferencia de una imagen, el video sí
 * pasa por la cola de transcodificación (E8), así que puede tardar y necesita
 * el worker en marcha.
 */
function ModalSubirVideo({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const publicar = usePublicarVideo()
  const [fase, setFase] = useState<Fase>('elegir')
  const [pct, setPct] = useState(0)
  const [ficha, setFicha] = useState(FICHA_VACIA)
  const [archivo, setArchivo] = useState<File | null>(null)
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
    setFicha(FICHA_VACIA)
    setError(null)
    setPct(0)
  }

  const cerrar = () => {
    if (ocupado) return
    limpiar()
    onCerrar()
  }

  const oNulo = (valor: string) => valor.trim() || null

  const subir = async () => {
    if (!archivo || ficha.title.trim().length < 2) return
    setError(null)
    try {
      setFase('subiendo')
      const assetId = await subirMedioReanudable(archivo, 'VIDEO', 'feed-media', setPct)

      setFase('procesando')
      const estado = await esperarProcesado(assetId)
      if (estado.status === 'FAILED') throw new Error('No se pudo procesar el video')

      setFase('publicando')
      await publicar.mutateAsync({
        mediaAssetId: assetId,
        title: ficha.title.trim(),
        series: oNulo(ficha.series),
        description: oNulo(ficha.description),
        reference: oNulo(ficha.reference),
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
      titulo="Subir un video"
      descripcion="El archivo se transcodifica antes de aparecer en el catálogo."
      className="max-w-4xl"
    >
      <div className="grid gap-aire-s sm:grid-cols-2">
        <div className="flex flex-col gap-aire-s">
          <Field label="Archivo" htmlFor="video-archivo" hint="MP4 o MOV.">
            <input
              id="video-archivo"
              type="file"
              accept="video/mp4,video/quicktime"
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

          <Field label="Título" htmlFor="video-titulo" hint="Mínimo 2 caracteres.">
            <Input
              id="video-titulo"
              maxLength={120}
              placeholder="Bienaventurados"
              {...campo('title')}
            />
          </Field>

          <Field label="Serie" htmlFor="video-serie" hint="La colección a la que pertenece.">
            <Input
              id="video-serie"
              maxLength={120}
              placeholder="Palabras que permanecen"
              {...campo('series')}
            />
          </Field>

          <Field label="Referencia" htmlFor="video-referencia" hint="Cita bíblica, si la tiene.">
            <Input
              id="video-referencia"
              maxLength={120}
              placeholder="Mateo 5:3–12"
              {...campo('reference')}
            />
          </Field>
        </div>

        <div className="flex flex-col gap-aire-s">
          <Field
            label="Descripción"
            htmlFor="video-descripcion"
            hint="Lo que se lee junto al video."
          >
            <Textarea
              id="video-descripcion"
              maxLength={2000}
              rows={9}
              placeholder="Una pausa para volver al centro del mensaje y escuchar con calma."
              {...campo('description')}
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
            Transcodificando. Necesita el worker en marcha y puede tardar.
          </p>
        )}
        {fase === 'publicando' && (
          <p className="m-0 font-mono text-body-s text-texto-tenue">Publicando…</p>
        )}
        {error && (
          <p role="alert" className="m-0 font-ui text-body-s text-vino">
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
            disabled={ocupado || !archivo || ficha.title.trim().length < 2}
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
