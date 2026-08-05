import { useEffect, useState } from 'react'
import { Boton, Chip, Field, Input, Modal, ModalConfirmacion, Textarea } from '@elcamino/ui'
import { subirMedioReanudable } from '../../../lib/media-upload'
import { ApiError } from '../../../lib/api-client'
import {
  useEditarOracion,
  useEliminarOracion,
  useOracionesAdmin,
  usePublicarOracion,
} from './contenido-api'
import type { OracionGuiada } from '../../lecturas/lecturas-api'
import { parsearSrt } from '../../music/song-subtitles'

/**
 * Oraciones guiadas en el módulo Contenido.
 *
 * Una oración es una voz y su letra. El audio es obligatorio: sin él no hay
 * nada que seguir y la pantalla se queda en un texto gris que nunca se
 * enciende.
 */
export function OracionesPanel() {
  const { data, isPending } = useOracionesAdmin()
  const editar = useEditarOracion()
  const eliminar = useEliminarOracion()
  const [escribiendo, setEscribiendo] = useState(false)
  const [aCorregir, setACorregir] = useState<OracionGuiada | null>(null)
  const [aEliminar, setAEliminar] = useState<OracionGuiada | null>(null)

  const lista = data ?? []
  const visibles = lista.filter((o) => !o.oculto).length

  return (
    <div className="flex flex-col gap-aire-m">
      <div className="flex flex-wrap items-center justify-between gap-aire-s">
        <p className="m-0 font-ui text-body-s text-texto-tenue">
          {isPending ? 'Cargando…' : `${lista.length} oración(es) · ${visibles} visible(s).`}
        </p>
        <Boton variante="tarjeta" onClick={() => setEscribiendo(true)}>
          Subir oración
        </Boton>
      </div>

      {!isPending && lista.length === 0 && (
        <p className="m-0 font-ui text-body-s text-texto-tenue">
          Todavía no hay oraciones guiadas.
        </p>
      )}

      {lista.length > 0 && (
        <ul className="m-0 grid list-none grid-cols-1 gap-aire-m p-0 sm:grid-cols-2">
          {lista.map((oracion) => (
            <li key={oracion.id}>
              <article className="flex h-full flex-col gap-aire-s bg-superficie-1 p-aire-m shadow-[0_0.9rem_2.2rem_-0.5rem_rgba(20,17,15,0.22)]">
                <div className="flex flex-wrap items-center gap-aire-xs">
                  <Chip tamano="mini" tono={oracion.oculto ? 'acento' : 'neutro'}>
                    {oracion.oculto ? 'Oculta' : 'Publicada'}
                  </Chip>
                  {oracion.tema && <Chip tamano="mini">{oracion.tema}</Chip>}
                  <Chip tamano="mini">{oracion.lineas.length} líneas</Chip>
                  {/* Sin marcas el texto se reparte por longitud: sale bien,
                      pero conviene saber cuál está ajustada a la voz. */}
                  <Chip tamano="mini">{oracion.marcas ? 'Marcada' : 'Reparto automático'}</Chip>
                </div>

                <p className="m-0 font-ui text-body-s text-contenido">{oracion.titulo}</p>
                <audio controls src={oracion.audioUrl} className="w-full" preload="none" />

                <div className="mt-auto flex flex-wrap gap-aire-xs pt-aire-xs">
                  <Boton
                    variante="pastilla"
                    disabled={editar.isPending || eliminar.isPending}
                    onClick={() => setACorregir(oracion)}
                  >
                    Editar
                  </Boton>
                  <Boton
                    variante="pastilla"
                    disabled={editar.isPending || eliminar.isPending}
                    onClick={() => editar.mutate({ id: oracion.id, oculto: !oracion.oculto })}
                  >
                    {oracion.oculto ? 'Publicar' : 'Ocultar'}
                  </Boton>
                  <Boton
                    variante="pastilla"
                    disabled={editar.isPending || eliminar.isPending}
                    onClick={() => setAEliminar(oracion)}
                  >
                    Eliminar
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

      <ModalSubirOracion
        abierto={escribiendo || aCorregir !== null}
        oracion={aCorregir}
        onCerrar={() => {
          setEscribiendo(false)
          setACorregir(null)
        }}
      />

      <ModalConfirmacion
        abierto={aEliminar !== null}
        titulo="Eliminar la oración"
        descripcion="Se borra la oración y su audio. No se puede deshacer; si solo quieres que deje de verse, ocúltala."
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

const CLASE_ARCHIVO =
  'font-mono text-body-s text-texto-tenue file:mr-aire-s file:rounded file:border ' +
  'file:border-linea file:bg-superficie-2 file:px-aire-s file:py-1 file:font-mono ' +
  'file:text-eyebrow file:uppercase file:tracking-label file:text-contenido hover:file:border-acento'

/**
 * Lee las marcas de tiempo escritas a mano.
 *
 * Acepta un segundo por línea (`12.4`) o `m:ss`, que es como se leen en un
 * reproductor. Devuelve `null` si el campo está vacío: entonces la pantalla
 * reparte por longitud, que para una locución pausada cae bastante cerca.
 */
function leerMarcas(crudo: string): number[] | null {
  const piezas = crudo
    .split(/[\s,]+/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (piezas.length === 0) return null
  return piezas.map((pieza) => {
    if (!pieza.includes(':')) return Number(pieza)
    const [min, seg] = pieza.split(':')
    return Number(min) * 60 + Number(seg)
  })
}

/**
 * El mismo formulario sube y corrige.
 *
 * Al corregir, la voz ya subida se conserva si no se elige otro archivo: pedir
 * el audio de nuevo solo para arreglar una errata en la letra habría hecho que
 * nadie arreglara ninguna errata.
 */
function ModalSubirOracion({
  abierto,
  oracion,
  onCerrar,
}: {
  abierto: boolean
  /** La oración que se corrige. Nula: se está subiendo una nueva. */
  oracion: OracionGuiada | null
  onCerrar: () => void
}) {
  const esCorreccion = oracion !== null
  const publicar = usePublicarOracion()
  const editar = useEditarOracion()
  const [titulo, setTitulo] = useState('')
  const [tema, setTema] = useState('')
  const [texto, setTexto] = useState('')
  const [marcasCrudas, setMarcasCrudas] = useState('')
  const [audio, setAudio] = useState<File | null>(null)
  // La estampa del carrusel y lo que se ve detrás mientras se reza.
  const [imagen, setImagen] = useState<File | null>(null)
  const [fondo, setFondo] = useState<File | null>(null)
  const [avisoSrt, setAvisoSrt] = useState<string | null>(null)
  const [fase, setFase] = useState<'elegir' | 'subiendo' | 'publicando'>('elegir')
  const [pct, setPct] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const ocupado = fase !== 'elegir'

  useEffect(() => {
    if (!abierto || !oracion) return
    setTitulo(oracion.titulo)
    setTema(oracion.tema ?? '')
    setTexto(oracion.lineas.join('\n'))
    setMarcasCrudas(oracion.marcas ? oracion.marcas.join('\n') : '')
  }, [abierto, oracion])

  const lineas = texto
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const marcas = leerMarcas(marcasCrudas)
  // Una lista a medias desincroniza el texto, así que se avisa antes de enviar.
  const marcasDesparejas = marcas !== null && marcas.length !== lineas.length

  /**
   * Vuelca un `.srt` en la letra y las marcas.
   *
   * Cada bloque del archivo es una línea de la oración y su inicio es su marca,
   * así que el reparto por longitud deja de hacer falta: la letra va donde va
   * la voz. Se vuelca en los campos en vez de guardarse a ciegas, para poder
   * repasarlo antes de publicar.
   */
  const volcarSrt = async (archivo: File | null) => {
    if (!archivo) return
    setError(null)
    try {
      const cues = parsearSrt(await archivo.text())
      if (cues.length === 0) {
        setAvisoSrt(null)
        setError('Ese archivo no trae subtítulos que se puedan leer.')
        return
      }
      // Un bloque puede traer varias líneas; se juntan en una, que es como se
      // dice de corrido y como se va a iluminar.
      setTexto(cues.map((cue) => cue.texto.replace(/\n+/g, ' ')).join('\n'))
      setMarcasCrudas(cues.map((cue) => cue.inicio.toFixed(2)).join('\n'))
      setAvisoSrt(`${cues.length} línea(s) tomadas del archivo, con sus tiempos.`)
    } catch {
      setError('No se pudo leer el archivo.')
    }
  }

  const limpiar = () => {
    setTitulo('')
    setTema('')
    setTexto('')
    setMarcasCrudas('')
    setAudio(null)
    setImagen(null)
    setFondo(null)
    setAvisoSrt(null)
    setError(null)
    setPct(0)
  }

  const cerrar = () => {
    if (ocupado) return
    limpiar()
    onCerrar()
  }

  const enviar = async () => {
    // Una oración nueva no existe sin su voz; una que se corrige ya la tiene.
    if (!audio && !esCorreccion) return
    setError(null)
    try {
      let audioAssetId: string | undefined
      if (audio) {
        setFase('subiendo')
        // El audio no se transcodifica: se sube y ya se puede oír.
        audioAssetId = await subirMedioReanudable(audio, 'AUDIO', 'feed-media', setPct, {
          procesar: false,
        })
      }

      // Al corregir, lo que no se toca no se manda: `null` habría borrado la
      // estampa de una oración solo por no elegir otra.
      let imagenAssetId: string | null | undefined = esCorreccion ? undefined : null
      if (imagen) {
        setFase('subiendo')
        imagenAssetId = await subirMedioReanudable(imagen, 'IMAGE', 'feed-media', setPct)
      }

      let fondoAssetId: string | null | undefined = esCorreccion ? undefined : null
      if (fondo) {
        setFase('subiendo')
        const esVideo = fondo.type.startsWith('video/')
        fondoAssetId = await subirMedioReanudable(
          fondo,
          esVideo ? 'VIDEO' : 'IMAGE',
          'feed-media',
          setPct,
        )
      }

      setFase('publicando')
      const cuerpo = {
        titulo: titulo.trim(),
        tema: tema.trim() || null,
        lineas,
        marcas,
        imagenAssetId,
        fondoAssetId,
      }
      if (esCorreccion) {
        await editar.mutateAsync({
          id: oracion.id,
          ...cuerpo,
          ...(audioAssetId ? { audioAssetId } : {}),
        })
      } else {
        await publicar.mutateAsync({
          ...cuerpo,
          audioAssetId: audioAssetId!,
          imagenAssetId: imagenAssetId ?? null,
          fondoAssetId: fondoAssetId ?? null,
        })
      }
      setFase('elegir')
      limpiar()
      onCerrar()
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : 'Error inesperado')
      setFase('elegir')
    }
  }

  const completo =
    titulo.trim().length >= 3 && lineas.length > 0 && (audio !== null || esCorreccion)

  return (
    <Modal
      abierto={abierto}
      onCerrar={cerrar}
      titulo={esCorreccion ? 'Editar la oración' : 'Subir una oración guiada'}
      descripcion={
        esCorreccion
          ? 'La voz se conserva si no eliges otro archivo.'
          : 'La voz y su letra. El texto se ilumina línea a línea mientras se escucha.'
      }
      className="max-w-4xl"
    >
      <div className="grid gap-aire-s sm:grid-cols-2">
        <div className="flex flex-col gap-aire-s">
          <Field
            label="Voz"
            htmlFor="oracion-audio"
            hint={esCorreccion ? 'Elige otro solo si quieres cambiarla.' : 'El audio que guía la oración.'}
          >
            <input
              id="oracion-audio"
              type="file"
              accept="audio/mpeg,audio/mp4,audio/ogg,audio/wav"
              disabled={ocupado}
              onChange={(e) => {
                setAudio(e.target.files?.[0] ?? null)
                setError(null)
              }}
              className={CLASE_ARCHIVO}
            />
          </Field>

          {audio && (
            <p className="m-0 font-mono text-body-s text-contenido">
              {audio.name} · {(audio.size / (1024 * 1024)).toFixed(1)} MB
            </p>
          )}

          <Field label="Título" htmlFor="oracion-titulo" hint="Cuándo se reza esto.">
            <Input
              id="oracion-titulo"
              maxLength={160}
              placeholder="Antes de dormir"
              value={titulo}
              disabled={ocupado}
              onChange={(e) => setTitulo(e.target.value)}
            />
          </Field>

          <Field label="Tema (opcional)" htmlFor="oracion-tema" hint="Descanso, Miedo, Gratitud…">
            <Input
              id="oracion-tema"
              maxLength={80}
              placeholder="Descanso"
              value={tema}
              disabled={ocupado}
              onChange={(e) => setTema(e.target.value)}
            />
          </Field>

          {/* El `.srt` es la vía corta: trae la letra y sus tiempos ya medidos,
              que es justo lo que cuesta acertar a mano. */}
          <Field
            label="Subtítulos .srt (opcional)"
            htmlFor="oracion-srt"
            hint="Rellena la letra y las marcas de tiempo de una vez."
          >
            <input
              id="oracion-srt"
              type="file"
              accept=".srt,text/plain"
              disabled={ocupado}
              onChange={(e) => void volcarSrt(e.target.files?.[0] ?? null)}
              className={CLASE_ARCHIVO}
            />
          </Field>

          {avisoSrt && (
            <p className="m-0 font-mono text-body-s text-acento" role="status">
              {avisoSrt}
            </p>
          )}

          <Field
            label="Estampa (opcional)"
            htmlFor="oracion-imagen"
            hint={
              esCorreccion
                ? 'Elige otra solo si quieres cambiarla.'
                : 'Recorte sin fondo (PNG). Es lo que se ve en el carrusel.'
            }
          >
            <input
              id="oracion-imagen"
              type="file"
              accept="image/png,image/webp"
              disabled={ocupado}
              onChange={(e) => setImagen(e.target.files?.[0] ?? null)}
              className={CLASE_ARCHIVO}
            />
          </Field>

          <Field
            label="Fondo al rezar (opcional)"
            htmlFor="oracion-fondo"
            hint={
              esCorreccion
                ? 'Elige otro solo si quieres cambiarlo.'
                : 'Video o imagen a pantalla completa, detrás de la letra.'
            }
          >
            <input
              id="oracion-fondo"
              type="file"
              accept="video/mp4,video/quicktime,image/jpeg,image/png,image/webp"
              disabled={ocupado}
              onChange={(e) => setFondo(e.target.files?.[0] ?? null)}
              className={CLASE_ARCHIVO}
            />
          </Field>

          <Field
            label="Marcas de tiempo (opcional)"
            htmlFor="oracion-marcas"
            hint="Una por línea, en segundos o m:ss. Sin esto, se reparten solas."
          >
            <Textarea
              id="oracion-marcas"
              rows={4}
              placeholder={'0\n6.5\n0:12\n0:19'}
              value={marcasCrudas}
              disabled={ocupado}
              onChange={(e) => setMarcasCrudas(e.target.value)}
            />
          </Field>
        </div>

        <div className="flex flex-col gap-aire-s">
          <Field
            label="Letra"
            htmlFor="oracion-texto"
            hint="Una línea por cada frase que se ilumina."
          >
            <Textarea
              id="oracion-texto"
              maxLength={8000}
              rows={16}
              placeholder={'Señor, llegué al final de este día.\nNo todo salió como esperaba.'}
              value={texto}
              disabled={ocupado}
              onChange={(e) => setTexto(e.target.value)}
            />
          </Field>

          <p className="m-0 font-mono text-eyebrow uppercase tracking-label text-texto-tenue">
            {lineas.length} línea(s)
            {marcas && ` · ${marcas.length} marca(s)`}
          </p>
        </div>
      </div>

      <div className="mt-aire-s flex flex-col gap-aire-s">
        {marcasDesparejas && (
          <p role="alert" className="m-0 font-ui text-body-s text-peligro">
            Hay {marcas?.length} marca(s) para {lineas.length} línea(s). Tiene que haber una por
            línea, o ninguna.
          </p>
        )}
        {fase === 'subiendo' && (
          <p className="m-0 font-mono text-body-s text-texto-tenue">Subiendo la voz… {pct}%</p>
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
            onClick={() => void enviar()}
            disabled={ocupado || !completo || marcasDesparejas}
          >
            {ocupado ? 'Guardando…' : esCorreccion ? 'Guardar' : 'Publicar'}
          </Boton>
        </div>
      </div>
    </Modal>
  )
}

function mensajeDeError(error: unknown): string {
  return error instanceof ApiError ? error.message : 'No se pudo aplicar el cambio.'
}
