import { useState } from 'react'
import {
  Boton,
  Chip,
  Field,
  Input,
  Modal,
  ModalConfirmacion,
  Select,
  SelectorDeColor,
  Textarea,
} from '@elcamino/ui'
import { CampoDeImagen } from '../../../components/campo-de-imagen'
import { subirMedioReanudable } from '../../../lib/media-upload'
import { ApiError } from '../../../lib/api-client'
import {
  useMusicaAdmin,
  useCrearAlbum,
  useEliminarAlbum,
  useCrearCancion,
  usePublicarCancion,
  useEliminarCancion,
  useEditarAlbum,
  type AlbumAdmin,
  type CancionAdmin,
  type TipoDeFondo,
  type TonoAlabanza,
} from './contenido-api'

const TONOS: TonoAlabanza[] = ['vino', 'marfil', 'azul']

/** Aspecto del `<input type="file">`, que no tiene componente propio. */
const CLASE_ARCHIVO =
  'font-mono text-body-s text-texto-tenue file:mr-aire-s file:rounded file:border ' +
  'file:border-linea file:bg-superficie-2 file:px-aire-s file:py-1 file:font-mono ' +
  'file:text-eyebrow file:uppercase file:tracking-label file:text-contenido hover:file:border-vino'

/** mm:ss a partir de segundos. */
function duracion(segundos: number | null): string {
  if (!segundos) return '—'
  const m = Math.floor(segundos / 60)
  const s = String(segundos % 60).padStart(2, '0')
  return `${m}:${s}`
}

/**
 * Alabanza en el módulo Contenido (HU-9.2): álbumes y canciones. Una canción
 * nace sin publicar; el admin la revisa y la publica cuando quiere.
 */
export function CancionesPanel() {
  const { data, isPending } = useMusicaAdmin()
  const publicar = usePublicarCancion()
  const eliminarCancion = useEliminarCancion()
  const eliminarAlbum = useEliminarAlbum()
  const [creandoAlbum, setCreandoAlbum] = useState(false)
  // Sobre qué álbum se está actuando: subir una canción o editar sus datos.
  const [albumParaSubir, setAlbumParaSubir] = useState<AlbumAdmin | null>(null)
  const [albumParaEditar, setAlbumParaEditar] = useState<AlbumAdmin | null>(null)
  const [albumParaListar, setAlbumParaListar] = useState<AlbumAdmin | null>(null)
  const [aEliminar, setAEliminar] = useState<CancionAdmin | null>(null)
  const [albumAEliminar, setAlbumAEliminar] = useState<AlbumAdmin | null>(null)

  const albumes = data?.albumes ?? []
  const canciones = data?.canciones ?? []
  const publicadas = canciones.filter((c) => c.isPublished).length
  const error = publicar.error ?? eliminarCancion.error ?? eliminarAlbum.error

  return (
    <div className="flex flex-col gap-aire-m">
      <div className="flex flex-wrap items-center justify-between gap-aire-s">
        <p className="m-0 font-ui text-body-s text-texto-tenue">
          {isPending
            ? 'Cargando…'
            : `${albumes.length} álbum(es) · ${canciones.length} canción(es) · ${publicadas} en Alabanza.`}
        </p>
        <Boton variante="tarjeta" onClick={() => setCreandoAlbum(true)}>
          Crear álbum
        </Boton>
      </div>

      {!isPending && albumes.length === 0 && (
        <p className="m-0 font-ui text-body-s text-texto-tenue">
          Todavía no hay álbumes. Crea el primero: una canción se publica dentro de un álbum, que
          es de donde toma su portada.
        </p>
      )}

      {albumes.map((album) => (
        <AlbumConCanciones
          key={album.albumId}
          album={album}
          canciones={canciones.filter((c) => c.albumId === album.albumId)}
          ocupado={publicar.isPending || eliminarCancion.isPending}
          onEliminarAlbum={() => setAlbumAEliminar(album)}
          onEditar={() => setAlbumParaEditar(album)}
          onVerCanciones={() => setAlbumParaListar(album)}
        />
      ))}

      {/* Canciones sin álbum: no salen en Alabanza, que se organiza por álbum. */}
      {canciones.some((c) => !c.albumId) && (
        <section className="flex flex-col gap-aire-s bg-superficie-1 p-aire-m shadow-[0_0.9rem_2.2rem_-0.5rem_rgba(20,17,15,0.22)]">
          <h3 className="m-0 font-mono text-h-s font-normal text-contenido">Sin álbum</h3>
          <p className="m-0 font-ui text-body-s text-texto-tenue">
            Estas canciones no aparecen en Alabanza: la pantalla se organiza por álbumes.
          </p>
          <ul className="m-0 flex list-none flex-col gap-aire-xs p-0">
            {canciones
              .filter((c) => !c.albumId)
              .map((c) => (
                <FilaDeCancion
                  key={c.id}
                  cancion={c}
                  ocupado={publicar.isPending || eliminarCancion.isPending}
                  onPublicar={(isPublished) => publicar.mutate({ id: c.id, isPublished })}
                  onEliminar={() => setAEliminar(c)}
                />
              ))}
          </ul>
        </section>
      )}

      {error && (
        <p role="alert" className="m-0 font-ui text-body-s text-vino">
          {error instanceof ApiError ? error.message : 'No se pudo aplicar el cambio.'}
        </p>
      )}

      <ModalAlbum abierto={creandoAlbum} onCerrar={() => setCreandoAlbum(false)} />

      <ModalEditarAlbum album={albumParaEditar} onCerrar={() => setAlbumParaEditar(null)} />

      <ModalCanciones
        album={albumParaListar}
        canciones={canciones.filter((c) => c.albumId === albumParaListar?.albumId)}
        ocupado={publicar.isPending || eliminarCancion.isPending}
        onCerrar={() => setAlbumParaListar(null)}
        onPublicar={(id, isPublished) => publicar.mutate({ id, isPublished })}
        onEliminarCancion={(cancion) => {
          setAlbumParaListar(null)
          setAEliminar(cancion)
        }}
        onSubirCancion={() => {
          setAlbumParaListar(null)
          setAlbumParaSubir(albumParaListar)
        }}
      />

      <ModalCancion
        album={albumParaSubir}
        pistasUsadas={canciones
          .filter((c) => c.albumId === albumParaSubir?.albumId)
          .map((c) => c.trackNumber)
          .filter((n): n is number => n !== null)}
        onCerrar={() => setAlbumParaSubir(null)}
      />

      <ModalConfirmacion
        abierto={aEliminar !== null}
        titulo="Eliminar la canción"
        descripcion={`Se borra «${aEliminar?.title ?? ''}» y su archivo de audio. No se puede deshacer.`}
        textoConfirmar="Eliminar"
        ocupado={eliminarCancion.isPending}
        onConfirmar={() => {
          if (aEliminar) eliminarCancion.mutate(aEliminar.id)
          setAEliminar(null)
        }}
        onCancelar={() => setAEliminar(null)}
      />

      <ModalConfirmacion
        abierto={albumAEliminar !== null}
        titulo="Eliminar el álbum"
        descripcion={`Se borra «${albumAEliminar?.titulo ?? ''}». Solo puede eliminarse si ya no tiene canciones.`}
        textoConfirmar="Eliminar"
        ocupado={eliminarAlbum.isPending}
        onConfirmar={() => {
          if (albumAEliminar) eliminarAlbum.mutate(albumAEliminar.albumId)
          setAlbumAEliminar(null)
        }}
        onCancelar={() => setAlbumAEliminar(null)}
      />
    </div>
  )
}

function AlbumConCanciones({
  album,
  canciones,
  ocupado,
  onEliminarAlbum,
  onEditar,
  onVerCanciones,
}: {
  album: AlbumAdmin
  canciones: CancionAdmin[]
  ocupado: boolean
  onEliminarAlbum: () => void
  onEditar: () => void
  onVerCanciones: () => void
}) {
  return (
    <section className="flex flex-col gap-aire-s bg-superficie-1 p-aire-m shadow-[0_0.9rem_2.2rem_-0.5rem_rgba(20,17,15,0.22)]">
      <div className="flex flex-wrap items-start justify-between gap-aire-s">
        <div className="flex items-center gap-aire-s">
          {album.coverUrl ? (
            <img
              src={album.coverUrl}
              alt=""
              className="size-16 shrink-0 object-cover"
              loading="lazy"
            />
          ) : (
            <span
              aria-hidden="true"
              className="size-16 shrink-0 rounded-full"
              style={{ background: album.discColor }}
            />
          )}
          <div className="flex flex-col gap-aire-xs">
            <div className="flex flex-wrap items-center gap-aire-xs">
              {album.numero && <Chip tamano="mini">{album.numero}</Chip>}
              <Chip tamano="mini">{album.tono}</Chip>
            </div>
            <h3 className="m-0 font-mono text-h-s font-normal text-contenido">{album.titulo}</h3>
            {album.descripcion && (
              <p className="m-0 font-ui text-body-s text-texto-tenue">{album.descripcion}</p>
            )}
          </div>
        </div>
        {/* Las acciones del álbum, siempre las tres y en el mismo orden: lo
            que se hace a menudo arriba, lo irreversible al final. */}
        <div className="flex shrink-0 flex-col items-stretch gap-aire-xs">
          <Boton variante="tarjeta" tamano="compacto" onClick={onVerCanciones} disabled={ocupado}>
            Canciones ({canciones.length})
          </Boton>
          <Boton variante="contorno" tamano="compacto" onClick={onEditar} disabled={ocupado}>
            Editar
          </Boton>
          <Boton variante="pastilla" onClick={onEliminarAlbum} disabled={ocupado}>
            Eliminar álbum
          </Boton>
        </div>
      </div>

    </section>
  )
}

function FilaDeCancion({
  cancion,
  ocupado,
  onPublicar,
  onEliminar,
}: {
  cancion: CancionAdmin
  ocupado: boolean
  onPublicar: (isPublished: boolean) => void
  onEliminar: () => void
}) {
  return (
    <li className="flex flex-wrap items-center gap-aire-s border-l-2 border-linea py-aire-xs pl-aire-s">
      <span className="font-mono text-eyebrow text-texto-tenue">
        {cancion.trackNumber ? String(cancion.trackNumber).padStart(2, '0') : '—'}
      </span>
      <span className="min-w-0 flex-1 truncate font-mono text-body-s text-contenido">
        {cancion.title}
        {cancion.subtitle && <span className="text-texto-tenue"> · {cancion.subtitle}</span>}
      </span>
      <span className="shrink-0 font-mono text-eyebrow text-texto-tenue">
        {cancion.artistName} · {duracion(cancion.durationSeconds)}
      </span>
      <Chip tamano="mini" tono={cancion.isPublished ? 'neutro' : 'acento'}>
        {cancion.isPublished ? 'En Alabanza' : 'Sin publicar'}
      </Chip>
      <Boton variante="pastilla" disabled={ocupado} onClick={() => onPublicar(!cancion.isPublished)}>
        {cancion.isPublished ? 'Retirar' : 'Publicar'}
      </Boton>
      <Boton variante="pastilla" disabled={ocupado} onClick={onEliminar}>
        Eliminar
      </Boton>
    </li>
  )
}

const ALBUM_VACIO = {
  title: '',
  artistName: '',
  number: '',
  description: '',
  coverImageUrl: '',
  tone: 'vino' as TonoAlabanza,
  discColor: '',
}

/** Alta de un álbum: la identidad visual de una colección en Alabanza. */
function ModalAlbum({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const crear = useCrearAlbum()
  const [datos, setDatos] = useState(ALBUM_VACIO)
  const ocupado = crear.isPending

  const campo = (clave: keyof typeof ALBUM_VACIO) => ({
    value: datos[clave],
    disabled: ocupado,
    onChange: (e: { target: { value: string } }) =>
      setDatos((d) => ({ ...d, [clave]: e.target.value })),
  })

  const cerrar = () => {
    if (ocupado) return
    setDatos(ALBUM_VACIO)
    crear.reset()
    onCerrar()
  }

  const oNulo = (valor: string) => valor.trim() || null

  const guardar = () => {
    crear.mutate(
      {
        title: datos.title.trim(),
        artistName: datos.artistName.trim(),
        number: oNulo(datos.number),
        description: oNulo(datos.description),
        coverImageUrl: oNulo(datos.coverImageUrl),
        tone: datos.tone,
        discColor: oNulo(datos.discColor),
      },
      { onSuccess: cerrar },
    )
  }

  const valido = datos.title.trim().length >= 2 && datos.artistName.trim().length > 0

  return (
    <Modal
      abierto={abierto}
      onCerrar={cerrar}
      titulo="Crear un álbum"
      descripcion="Una colección de Alabanza, con su portada y su identidad visual."
      className="max-w-3xl"
    >
      <div className="grid gap-aire-s sm:grid-cols-2">
        <div className="flex flex-col gap-aire-s">
          <Field label="Título" htmlFor="album-titulo">
            <Input id="album-titulo" maxLength={120} placeholder="Himnos de gracia" {...campo('title')} />
          </Field>
          <Field label="Artista" htmlFor="album-artista" hint="Se reutiliza si ya existe.">
            <Input id="album-artista" maxLength={120} placeholder="Opus33" {...campo('artistName')} />
          </Field>
          <Field label="Número" htmlFor="album-numero" hint="Número de catálogo: A01, A02…">
            <Input id="album-numero" maxLength={10} placeholder="A01" {...campo('number')} />
          </Field>
        </div>

        <div className="flex flex-col gap-aire-s">
          <Field label="Descripción" htmlFor="album-descripcion">
            <Textarea
              id="album-descripcion"
              maxLength={500}
              rows={3}
              placeholder="Cantos para volver al origen de la fe."
              {...campo('description')}
            />
          </Field>
          <Field label="Portada" hint="Se sube desde tu equipo.">
            <CampoDeImagen
              valor={datos.coverImageUrl || null}
              onCambiar={(url) => setDatos((d) => ({ ...d, coverImageUrl: url ?? '' }))}
              disabled={ocupado}
              textoElegir="Elegir portada"
            />
          </Field>
          <div className="grid gap-aire-s sm:grid-cols-2">
            <Field label="Tono" htmlFor="album-tono" hint="Identidad visual.">
              <Select id="album-tono" {...campo('tone')}>
                {TONOS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Color del disco" hint="El vinilo de la portada.">
              <SelectorDeColor
                etiqueta="Color del disco"
                valor={datos.discColor || null}
                onCambiar={(color) => setDatos((d) => ({ ...d, discColor: color }))}
                disabled={ocupado}
              />
            </Field>
          </div>
        </div>
      </div>

      <div className="mt-aire-s flex flex-col gap-aire-s">
        {crear.isError && (
          <p role="alert" className="m-0 font-ui text-body-s text-vino">
            {crear.error instanceof ApiError ? crear.error.message : 'No se pudo crear el álbum.'}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-aire-xs">
          <Boton variante="contorno" tamano="compacto" onClick={cerrar} disabled={ocupado}>
            Cancelar
          </Boton>
          <Boton
            variante="formulario"
            tamano="compacto"
            onClick={guardar}
            disabled={ocupado || !valido}
          >
            {ocupado ? 'Creando…' : 'Crear álbum'}
          </Boton>
        </div>
      </div>
    </Modal>
  )
}

/**
 * Listado de canciones de un álbum: publicar, retirar, quitar y subir una
 * nueva. La tarjeta del álbum se queda corta y el contenido se consulta aquí.
 */
function ModalCanciones({
  album,
  canciones,
  ocupado,
  onCerrar,
  onPublicar,
  onEliminarCancion,
  onSubirCancion,
}: {
  album: AlbumAdmin | null
  canciones: CancionAdmin[]
  ocupado: boolean
  onCerrar: () => void
  onPublicar: (id: string, isPublished: boolean) => void
  onEliminarCancion: (cancion: CancionAdmin) => void
  onSubirCancion: () => void
}) {
  return (
    <Modal
      abierto={album !== null}
      onCerrar={onCerrar}
      titulo={`Canciones de «${album?.titulo ?? ''}»`}
      descripcion="Solo las publicadas se ven en Alabanza."
      className="max-w-3xl"
    >
      <div className="flex flex-col gap-aire-s">
        {canciones.length === 0 ? (
          <p className="m-0 font-ui text-body-s text-texto-tenue">
            Este álbum aún no tiene canciones.
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-aire-xs p-0">
            {canciones.map((c) => (
              <FilaDeCancion
                key={c.id}
                cancion={c}
                ocupado={ocupado}
                onPublicar={(isPublished) => onPublicar(c.id, isPublished)}
                onEliminar={() => onEliminarCancion(c)}
              />
            ))}
          </ul>
        )}

        <div className="flex justify-end">
          <Boton variante="formulario" tamano="compacto" onClick={onSubirCancion} disabled={ocupado}>
            Subir canción
          </Boton>
        </div>
      </div>
    </Modal>
  )
}

/** Edición de un álbum: solo sus datos; las canciones tienen su propio diálogo. */
function ModalEditarAlbum({
  album,
  onCerrar,
}: {
  album: AlbumAdmin | null
  onCerrar: () => void
}) {
  const editar = useEditarAlbum()
  const [datos, setDatos] = useState<AlbumAdmin | null>(album)

  // Al abrir con otro álbum, el formulario arranca con sus datos.
  const albumId = album?.albumId ?? null
  const [albumCargado, setAlbumCargado] = useState<string | null>(albumId)
  if (albumId !== albumCargado) {
    setAlbumCargado(albumId)
    setDatos(album)
  }

  const ocupado = editar.isPending
  const campo = (clave: 'titulo' | 'numero' | 'descripcion') => ({
    value: datos?.[clave] ?? '',
    disabled: ocupado,
    onChange: (e: { target: { value: string } }) =>
      setDatos((d) => (d ? { ...d, [clave]: e.target.value } : d)),
  })

  const cerrar = () => {
    if (ocupado) return
    editar.reset()
    onCerrar()
  }

  const guardar = () => {
    if (!datos) return
    editar.mutate(
      {
        id: datos.albumId,
        title: datos.titulo.trim(),
        number: datos.numero.trim() || null,
        description: datos.descripcion.trim() || null,
        coverImageUrl: datos.coverUrl || null,
        tone: datos.tono,
        discColor: datos.discColor || null,
      },
      { onSuccess: cerrar },
    )
  }

  return (
    <Modal
      abierto={album !== null}
      onCerrar={cerrar}
      titulo="Editar el álbum"
      descripcion="Su portada, su identidad visual y sus textos."
      className="max-w-4xl"
    >
      <div className="grid gap-aire-s sm:grid-cols-2">
        <div className="flex flex-col gap-aire-s">
          <Field label="Título" htmlFor="editar-titulo">
            <Input id="editar-titulo" maxLength={120} {...campo('titulo')} />
          </Field>
          <Field label="Número" htmlFor="editar-numero" hint="Número de catálogo: A01, A02…">
            <Input id="editar-numero" maxLength={10} {...campo('numero')} />
          </Field>
          <Field label="Descripción" htmlFor="editar-descripcion">
            <Textarea id="editar-descripcion" maxLength={500} rows={3} {...campo('descripcion')} />
          </Field>
        </div>

        <div className="flex flex-col gap-aire-s">
          <Field label="Portada" hint="Se sube desde tu equipo.">
            <CampoDeImagen
              valor={datos?.coverUrl || null}
              onCambiar={(url) => setDatos((d) => (d ? { ...d, coverUrl: url ?? '' } : d))}
              disabled={ocupado}
              textoElegir="Elegir portada"
            />
          </Field>
          <div className="grid gap-aire-s sm:grid-cols-2">
            <Field label="Tono" htmlFor="editar-tono" hint="Identidad visual.">
              <Select
                id="editar-tono"
                value={datos?.tono ?? 'vino'}
                disabled={ocupado}
                onChange={(e) =>
                  setDatos((d) => (d ? { ...d, tono: e.target.value as TonoAlabanza } : d))
                }
              >
                {TONOS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Color del disco" hint="El vinilo de la portada.">
              <SelectorDeColor
                etiqueta="Color del disco"
                valor={datos?.discColor ?? null}
                onCambiar={(color) => setDatos((d) => (d ? { ...d, discColor: color } : d))}
                disabled={ocupado}
              />
            </Field>
          </div>
        </div>
      </div>

      <div className="mt-aire-s flex flex-col gap-aire-s">
        {editar.isError && (
          <p role="alert" className="m-0 font-ui text-body-s text-vino">
            {editar.error instanceof ApiError ? editar.error.message : 'No se pudo guardar.'}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-aire-xs">
          <Boton variante="contorno" tamano="compacto" onClick={cerrar} disabled={ocupado}>
            Cancelar
          </Boton>
          <Boton variante="formulario" tamano="compacto" onClick={guardar} disabled={ocupado}>
            {ocupado ? 'Guardando…' : 'Guardar cambios'}
          </Boton>
        </div>
      </div>
    </Modal>
  )
}

const CANCION_VACIA = {
  title: '',
  artistName: '',
  subtitle: '',
  trackNumber: '',
  tone: 'vino' as TonoAlabanza,
}

/** Cuántas pistas ofrece el selector por encima de las ya usadas. */
const PISTAS_DISPONIBLES = 30

/**
 * Subida de una canción a un álbum concreto. Todo lo que antes se pedía como
 * URL —el fondo y la letra— ahora se sube desde el equipo: el fondo de imagen
 * al bucket público, el de video por el pipeline de medios, y del `.srt` se
 * guarda su contenido, que el reproductor ya sabe interpretar.
 */
function ModalCancion({
  album,
  pistasUsadas,
  onCerrar,
}: {
  album: AlbumAdmin | null
  pistasUsadas: number[]
  onCerrar: () => void
}) {
  const crear = useCrearCancion()
  const [datos, setDatos] = useState(CANCION_VACIA)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [tipoDeFondo, setTipoDeFondo] = useState<TipoDeFondo>('imagen')
  const [fondoImagen, setFondoImagen] = useState<string | null>(null)
  const [fondoVideo, setFondoVideo] = useState<File | null>(null)
  const [srt, setSrt] = useState<{ nombre: string; contenido: string } | null>(null)
  const [pct, setPct] = useState(0)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ocupado = subiendo || crear.isPending
  const campo = (clave: keyof typeof CANCION_VACIA) => ({
    value: datos[clave],
    disabled: ocupado,
    onChange: (e: { target: { value: string } }) =>
      setDatos((d) => ({ ...d, [clave]: e.target.value })),
  })

  const limpiar = () => {
    setDatos(CANCION_VACIA)
    setArchivo(null)
    setTipoDeFondo('imagen')
    setFondoImagen(null)
    setFondoVideo(null)
    setSrt(null)
    setPct(0)
    setError(null)
  }

  const cerrar = () => {
    if (ocupado) return
    limpiar()
    onCerrar()
  }

  const oNulo = (valor: string) => valor.trim() || null

  const leerSrt = async (file: File | undefined) => {
    if (!file) return setSrt(null)
    setSrt({ nombre: file.name, contenido: await file.text() })
  }

  const subir = async () => {
    if (!archivo || !album) return
    setError(null)
    try {
      setSubiendo(true)
      const audioAssetId = await subirMedioReanudable(archivo, 'AUDIO', 'music', setPct)

      // El fondo en video es un medio privado más: pasa por el pipeline.
      let backgroundAssetId: string | null = null
      if (tipoDeFondo === 'video' && fondoVideo) {
        backgroundAssetId = await subirMedioReanudable(fondoVideo, 'VIDEO', 'music', setPct)
      }

      const trackNumber = Number(datos.trackNumber)
      await crear.mutateAsync({
        title: datos.title.trim(),
        artistName: datos.artistName.trim(),
        albumId: album.albumId,
        subtitle: oNulo(datos.subtitle),
        trackNumber: Number.isFinite(trackNumber) && trackNumber > 0 ? trackNumber : null,
        audioAssetId,
        durationSeconds: await leerDuracionAudio(archivo),
        tone: datos.tone,
        backgroundUrl: tipoDeFondo === 'imagen' ? fondoImagen : null,
        backgroundAssetId,
        backgroundType: fondoImagen || backgroundAssetId ? tipoDeFondo : null,
        subtitlesSrt: srt?.contenido ?? null,
      })
      setSubiendo(false)
      cerrar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado')
      setSubiendo(false)
    }
  }

  const valido = Boolean(archivo) && datos.title.trim().length >= 2 && datos.artistName.trim()

  return (
    <Modal
      abierto={album !== null}
      onCerrar={cerrar}
      titulo={`Subir una canción a «${album?.titulo ?? ''}»`}
      descripcion="Nace sin publicar: revísala y publícala cuando esté lista."
      className="max-w-4xl"
    >
      <div className="grid gap-aire-s sm:grid-cols-2">
        <div className="flex flex-col gap-aire-s">
          <Field label="Audio" htmlFor="cancion-audio" hint="MP3, OGG o WAV.">
            <input
              id="cancion-audio"
              type="file"
              accept="audio/mpeg,audio/ogg,audio/wav,audio/mp4"
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

          <Field label="Título" htmlFor="cancion-titulo">
            <Input
              id="cancion-titulo"
              maxLength={160}
              placeholder="Gracia que me encontró"
              {...campo('title')}
            />
          </Field>

          <Field label="Artista" htmlFor="cancion-artista" hint="Se reutiliza si ya existe.">
            <Input
              id="cancion-artista"
              maxLength={120}
              placeholder="Opus33"
              {...campo('artistName')}
            />
          </Field>

          <div className="grid gap-aire-s sm:grid-cols-2">
            <Field label="Pista" htmlFor="cancion-pista" hint="Posición en el álbum.">
              <Select id="cancion-pista" {...campo('trackNumber')}>
                <option value="">Sin número</option>
                {Array.from({ length: PISTAS_DISPONIBLES }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n} disabled={pistasUsadas.includes(n)}>
                    {String(n).padStart(2, '0')}
                    {pistasUsadas.includes(n) ? ' · ocupada' : ''}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tono" htmlFor="cancion-tono" hint="Identidad visual.">
              <Select id="cancion-tono" {...campo('tone')}>
                {TONOS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>

        <div className="flex flex-col gap-aire-s">
          <Field label="Subtítulo" htmlFor="cancion-subtitulo" hint="La línea bajo el título.">
            <Input
              id="cancion-subtitulo"
              maxLength={200}
              placeholder="Himnos para volver al centro"
              {...campo('subtitle')}
            />
          </Field>

          <Field label="Tipo de fondo" htmlFor="cancion-tipo-fondo" hint="Lo que se ve mientras suena.">
            <Select
              id="cancion-tipo-fondo"
              value={tipoDeFondo}
              disabled={ocupado}
              onChange={(e) => setTipoDeFondo(e.target.value as TipoDeFondo)}
            >
              <option value="imagen">Imagen</option>
              <option value="video">Video</option>
            </Select>
          </Field>

          {tipoDeFondo === 'imagen' ? (
            <Field label="Fondo" hint="Se sube desde tu equipo.">
              <CampoDeImagen
                valor={fondoImagen}
                onCambiar={setFondoImagen}
                disabled={ocupado}
                textoElegir="Elegir fondo"
                proporcion="aspect-video"
              />
            </Field>
          ) : (
            <Field label="Fondo en video" htmlFor="cancion-fondo-video" hint="MP4 o MOV; se transcodifica.">
              <input
                id="cancion-fondo-video"
                type="file"
                accept="video/mp4,video/quicktime"
                disabled={ocupado}
                onChange={(e) => setFondoVideo(e.target.files?.[0] ?? null)}
                className={CLASE_ARCHIVO}
              />
            </Field>
          )}

          <Field
            label="Letra (.srt)"
            htmlFor="cancion-srt"
            hint="Se muestra sincronizada durante la reproducción."
          >
            <input
              id="cancion-srt"
              type="file"
              accept=".srt,text/plain"
              disabled={ocupado}
              onChange={(e) => void leerSrt(e.target.files?.[0])}
              className={CLASE_ARCHIVO}
            />
          </Field>
          {srt && (
            <p className="m-0 font-mono text-body-s text-contenido">
              {srt.nombre} · {srt.contenido.split(/\n{2,}/).length} línea(s)
            </p>
          )}
        </div>
      </div>

      <div className="mt-aire-s flex flex-col gap-aire-s">
        {subiendo && <p className="m-0 font-mono text-body-s text-texto-tenue">Subiendo… {pct}%</p>}
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
            disabled={ocupado || !valido}
          >
            {ocupado ? 'Subiendo…' : 'Subir canción'}
          </Boton>
        </div>
      </div>
    </Modal>
  )
}

/** Duración real del audio, leída en el navegador antes de subirlo. */
function leerDuracionAudio(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const audio = document.createElement('audio')
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve(Number.isFinite(audio.duration) ? Math.round(audio.duration) : null)
    }
    audio.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    audio.src = url
  })
}
