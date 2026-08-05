import { useState } from 'react'
import { Boton, Chip, Field, Input, Modal, ModalConfirmacion, Textarea } from '@elcamino/ui'
import { subirMedioReanudable, esperarProcesado } from '../../../lib/media-upload'
import { ApiError } from '../../../lib/api-client'
import {
  useEditarLectura,
  useEliminarLectura,
  useLecturasAdmin,
  usePublicarLectura,
  type FichaLectura,
} from './contenido-api'
import type { Lectura } from '../../lecturas/lecturas-api'
import { EditorLectura } from '../../../components/editor-lectura'
import { REDES } from '../../lecturas/redes-de-la-lectura'
import { FONDOS } from '../../lecturas/fondos-de-devocional'

const FORMATO_FECHA = new Intl.DateTimeFormat('es-PE', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

/**
 * Un devocional y un artículo de revista se publican con el mismo formulario:
 * portada, título, cuerpo y firma. Lo que cambia es dónde se leen y si admiten
 * conversación, y eso ya lo decide el tipo, no quien escribe.
 */
export function LecturasPanel({ tipo }: { tipo: 'DEVOCIONAL' | 'ARTICULO' }) {
  const esRevista = tipo === 'ARTICULO'
  const { data, isPending } = useLecturasAdmin(tipo)
  const editar = useEditarLectura()
  const eliminar = useEliminarLectura()
  const [escribiendo, setEscribiendo] = useState(false)
  const [aEliminar, setAEliminar] = useState<Lectura | null>(null)

  const lista = data ?? []
  const visibles = lista.filter((l) => !l.oculto).length
  const nombre = esRevista ? 'artículo' : 'devocional'

  return (
    <div className="flex flex-col gap-aire-m">
      <div className="flex flex-wrap items-center justify-between gap-aire-s">
        <p className="m-0 font-ui text-body-s text-texto-tenue">
          {isPending
            ? 'Cargando…'
            : `${lista.length} ${nombre}(s) · ${visibles} visible(s) para quien lee.`}
        </p>
        <Boton variante="tarjeta" onClick={() => setEscribiendo(true)}>
          Escribir {nombre}
        </Boton>
      </div>

      {!isPending && lista.length === 0 && (
        <p className="m-0 font-ui text-body-s text-texto-tenue">
          Todavía no hay nada publicado aquí.
        </p>
      )}

      {lista.length > 0 && (
        <ul className="m-0 grid list-none grid-cols-1 gap-aire-m p-0 sm:grid-cols-2 md:grid-cols-3">
          {lista.map((lectura) => (
            <li key={lectura.id}>
              <LecturaEnLista
                lectura={lectura}
                ocupado={editar.isPending || eliminar.isPending}
                onAlternar={() => editar.mutate({ id: lectura.id, oculto: !lectura.oculto })}
                onEliminar={() => setAEliminar(lectura)}
              />
            </li>
          ))}
        </ul>
      )}

      {(editar.isError || eliminar.isError) && (
        <p role="alert" className="m-0 font-ui text-body-s text-peligro">
          {mensajeDeError(editar.error ?? eliminar.error)}
        </p>
      )}

      <ModalEscribirLectura
        tipo={tipo}
        abierto={escribiendo}
        onCerrar={() => setEscribiendo(false)}
      />

      <ModalConfirmacion
        abierto={aEliminar !== null}
        titulo={`Eliminar el ${nombre}`}
        descripcion={
          esRevista
            ? 'Se borra el artículo y, con él, todo lo que la gente comentó debajo. No se puede deshacer; si solo quieres que deje de verse, ocúltalo.'
            : 'Se borra el devocional. No se puede deshacer; si solo quieres que deje de verse, ocúltalo.'
        }
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

function LecturaEnLista({
  lectura,
  ocupado,
  onAlternar,
  onEliminar,
}: {
  lectura: Lectura
  ocupado: boolean
  onAlternar: () => void
  onEliminar: () => void
}) {
  return (
    <article className="flex h-full flex-col gap-aire-s bg-superficie-1 p-aire-m shadow-[0_0.9rem_2.2rem_-0.5rem_rgba(20,17,15,0.22)]">
      <div className="relative aspect-[3/2] w-full overflow-hidden bg-superficie-2">
        {lectura.portadaUrl ? (
          <img src={lectura.portadaUrl} alt="" className="size-full object-cover" loading="lazy" />
        ) : (
          <span className="grid size-full place-items-center font-mono text-eyebrow uppercase tracking-label text-texto-debil">
            Sin portada
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-aire-xs">
        <Chip tamano="mini" tono={lectura.oculto ? 'acento' : 'neutro'}>
          {lectura.oculto ? 'Oculto' : 'Publicado'}
        </Chip>
        <Chip tamano="mini">{lectura.minutos} min</Chip>
        {lectura.seccion && <Chip tamano="mini">{lectura.seccion}</Chip>}
      </div>

      <p className="m-0 line-clamp-2 font-ui text-body-s text-contenido">{lectura.titulo}</p>
      <p className="m-0 font-mono text-eyebrow text-texto-tenue">
        {lectura.autor}
        {lectura.publishedAt && ` · ${FORMATO_FECHA.format(new Date(lectura.publishedAt))}`}
      </p>

      <div className="mt-auto flex flex-wrap gap-aire-xs pt-aire-xs">
        <Boton variante="pastilla" disabled={ocupado} onClick={onAlternar}>
          {lectura.oculto ? 'Publicar' : 'Ocultar'}
        </Boton>
        <Boton variante="pastilla" disabled={ocupado} onClick={onEliminar}>
          Eliminar
        </Boton>
      </div>
    </article>
  )
}

/** Aspecto del `<input type="file">`, que no tiene componente propio. */
const CLASE_ARCHIVO =
  'font-mono text-body-s text-texto-tenue file:mr-aire-s file:rounded file:border ' +
  'file:border-linea file:bg-superficie-2 file:px-aire-s file:py-1 file:font-mono ' +
  'file:text-eyebrow file:uppercase file:tracking-label file:text-contenido hover:file:border-acento'

const FICHA_VACIA = {
  titulo: '',
  entradilla: '',
  cuerpo: '',
  autor: '',
  seccion: '',
  referencia: '',
}

function ModalEscribirLectura({
  tipo,
  abierto,
  onCerrar,
}: {
  tipo: 'DEVOCIONAL' | 'ARTICULO'
  abierto: boolean
  onCerrar: () => void
}) {
  const esRevista = tipo === 'ARTICULO'
  const publicar = usePublicarLectura(tipo)
  const [ficha, setFicha] = useState(FICHA_VACIA)
  const [portada, setPortada] = useState<File | null>(null)
  // Qué redes acompañan a esta lectura y a dónde llevan. Se eligen una a una:
  // ninguna es obligatoria y el orden es el que decida quien publica.
  const [redes, setRedes] = useState<{ clave: string; url: string }[]>([])
  // Solo para el devocional: el recorte que va a su derecha y el telón detrás.
  const [ilustracion, setIlustracion] = useState<File | null>(null)
  const [fondo, setFondo] = useState<string>('')
  const [fase, setFase] = useState<'elegir' | 'subiendo' | 'procesando' | 'publicando'>('elegir')
  const [pct, setPct] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const ocupado = fase !== 'elegir'

  const campo = (clave: keyof typeof FICHA_VACIA) => ({
    value: ficha[clave],
    disabled: ocupado,
    onChange: (e: { target: { value: string } }) =>
      setFicha((f) => ({ ...f, [clave]: e.target.value })),
  })

  const limpiar = () => {
    setFicha(FICHA_VACIA)
    setPortada(null)
    setRedes([])
    setIlustracion(null)
    setFondo('')
    setError(null)
    setPct(0)
  }

  const cerrar = () => {
    if (ocupado) return
    limpiar()
    onCerrar()
  }

  const oNulo = (valor: string) => valor.trim() || null

  const enviar = async () => {
    setError(null)
    try {
      // La portada es opcional: un texto sin imagen se publica igual, con la
      // tarjeta en gris. Lo que no se admite es un texto vacío.
      let portadaAssetId: string | null = null
      if (portada) {
        setFase('subiendo')
        portadaAssetId = await subirMedioReanudable(portada, 'IMAGE', 'feed-media', setPct)
        setFase('procesando')
        const estado = await esperarProcesado(portadaAssetId)
        if (estado.status === 'FAILED') throw new Error('No se pudo procesar la portada')
      }

      // La ilustración va por el mismo camino que la portada. Es opcional: sin
      // ella el devocional se lee igual, solo que a una columna.
      let ilustracionAssetId: string | null = null
      if (ilustracion) {
        setFase('subiendo')
        ilustracionAssetId = await subirMedioReanudable(ilustracion, 'IMAGE', 'feed-media', setPct)
        setFase('procesando')
        const estado = await esperarProcesado(ilustracionAssetId)
        if (estado.status === 'FAILED') throw new Error('No se pudo procesar la ilustración')
      }

      setFase('publicando')
      const cuerpo: FichaLectura = {
        titulo: ficha.titulo.trim(),
        entradilla: oNulo(ficha.entradilla),
        cuerpo: ficha.cuerpo,
        autor: ficha.autor.trim(),
        seccion: esRevista ? oNulo(ficha.seccion) : null,
        referencia: oNulo(ficha.referencia),
        redes: Object.fromEntries(
          redes.filter((r) => r.url.trim()).map((r) => [r.clave, r.url.trim()]),
        ),
        portadaAssetId,
        ilustracionAssetId,
        fondo: fondo || null,
      }
      await publicar.mutateAsync(cuerpo)
      setFase('elegir')
      limpiar()
      onCerrar()
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : 'Error inesperado')
      setFase('elegir')
    }
  }

  const completo =
    ficha.titulo.trim().length >= 3 &&
    ficha.autor.trim().length >= 2 &&
    // El editor deja marcas aunque el documento esté vacío; lo que cuenta es
    // que quede algo legible después de quitarlas.
    ficha.cuerpo.replace(/[#>\-*_`\s]/g, '').length > 0

  return (
    <Modal
      abierto={abierto}
      onCerrar={cerrar}
      titulo={esRevista ? 'Escribir un artículo' : 'Escribir un devocional'}
      descripcion={
        esRevista
          ? 'Un tema hondo, con conversación debajo. Se publica al guardar.'
          : 'Una lectura breve con su portada. Se publica al guardar.'
      }
      className="max-w-4xl"
    >
      <div className="grid gap-aire-s sm:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <div className="flex flex-col gap-aire-s">
          <Field label="Portada (opcional)" htmlFor="lectura-portada" hint="La imagen de la tarjeta.">
            <input
              id="lectura-portada"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={ocupado}
              onChange={(e) => {
                setPortada(e.target.files?.[0] ?? null)
                setError(null)
              }}
              className={CLASE_ARCHIVO}
            />
          </Field>

          {portada && (
            <p className="m-0 font-mono text-body-s text-contenido">
              {portada.name} · {(portada.size / (1024 * 1024)).toFixed(1)} MB
            </p>
          )}

          <Field label="Título" htmlFor="lectura-titulo" hint="Lo que se lee en la portada.">
            <Input
              id="lectura-titulo"
              maxLength={160}
              placeholder="Lo que el dinero no alcanza"
              {...campo('titulo')}
            />
          </Field>

          <Field label="Autor" htmlFor="lectura-autor" hint="Quién lo firma.">
            <Input id="lectura-autor" maxLength={120} placeholder="Rafael Román" {...campo('autor')} />
          </Field>

          {esRevista && (
            <Field label="Sección (opcional)" htmlFor="lectura-seccion" hint="Testimonio, Familia…">
              <Input id="lectura-seccion" maxLength={80} placeholder="Testimonio" {...campo('seccion')} />
            </Field>
          )}

          <Field label="Referencia (opcional)" htmlFor="lectura-referencia" hint="Cita bíblica.">
            <Input
              id="lectura-referencia"
              maxLength={120}
              placeholder="1 Timoteo 6:7"
              {...campo('referencia')}
            />
          </Field>

          {!esRevista && (
            <>
              <Field
                label="Ilustración (opcional)"
                htmlFor="lectura-ilustracion"
                hint="Recorte sin fondo (PNG). Va al lado del texto."
              >
                <input
                  id="lectura-ilustracion"
                  type="file"
                  accept="image/png,image/webp"
                  disabled={ocupado}
                  onChange={(e) => setIlustracion(e.target.files?.[0] ?? null)}
                  className={CLASE_ARCHIVO}
                />
              </Field>

              <Field label="Fondo" htmlFor="lectura-fondo" hint="El telón que va detrás.">
                <select
                  id="lectura-fondo"
                  value={fondo}
                  disabled={ocupado}
                  onChange={(e) => setFondo(e.target.value)}
                  className="w-full rounded border border-linea bg-superficie-2 px-aire-s py-2 font-mono text-body-s text-contenido"
                >
                  <option value="">Sin fondo</option>
                  {FONDOS.map((f) => (
                    <option key={f.clave} value={f.clave}>
                      {f.nombre}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          )}

          <RedesDeLaLectura redes={redes} onCambiar={setRedes} deshabilitado={ocupado} />
        </div>

        <div className="flex flex-col gap-aire-s">
          <Field
            label="Entradilla (opcional)"
            htmlFor="lectura-entradilla"
            hint="La frase que invita a entrar."
          >
            <Textarea
              id="lectura-entradilla"
              maxLength={400}
              rows={3}
              placeholder="Una consejería que terminó enseñándome a mí."
              {...campo('entradilla')}
            />
          </Field>

          {/* El artículo se escribe donde se va a leer: subtítulos que lo
              parten en secciones, imágenes dentro de cada una y más al final.
              Lo que se ve aquí es lo que sale publicado. */}
          <Field label="Texto" htmlFor="lectura-cuerpo" hint="Con subtítulos, imágenes y citas.">
            <EditorLectura
              value={ficha.cuerpo}
              onChange={(markdown) => setFicha((f) => ({ ...f, cuerpo: markdown }))}
            />
          </Field>
        </div>
      </div>

      <div className="mt-aire-s flex flex-col gap-aire-s">
        {fase === 'subiendo' && (
          <p className="m-0 font-mono text-body-s text-texto-tenue">Subiendo la portada… {pct}%</p>
        )}
        {fase === 'procesando' && (
          <p className="m-0 font-mono text-body-s text-texto-tenue">Procesando la portada…</p>
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
            disabled={ocupado || !completo}
          >
            {ocupado ? 'Guardando…' : 'Publicar'}
          </Boton>
        </div>
      </div>
    </Modal>
  )
}

/**
 * Las redes que acompañan a la lectura.
 *
 * No hay una casilla fija por red: se añaden las que hagan falta y solo esas
 * salen publicadas. Un artículo firmado por alguien de fuera lleva las suyas,
 * y uno de la casa puede llevar solo una.
 */
function RedesDeLaLectura({
  redes,
  onCambiar,
  deshabilitado,
}: {
  redes: { clave: string; url: string }[]
  onCambiar: (redes: { clave: string; url: string }[]) => void
  deshabilitado: boolean
}) {
  const disponibles = REDES.filter((red) => !redes.some((r) => r.clave === red.clave))

  const nombreDe = (clave: string) => REDES.find((r) => r.clave === clave)?.nombre ?? clave

  return (
    <fieldset className="m-0 flex flex-col gap-aire-xs border-0 p-0">
      <legend className="mb-aire-xs p-0 font-mono text-eyebrow uppercase tracking-label text-texto-tenue">
        Redes (opcional)
      </legend>

      {redes.map((red, i) => (
        <div key={red.clave} className="flex items-center gap-aire-xs">
          <span className="w-[5.5rem] shrink-0 font-mono text-body-s text-contenido">
            {nombreDe(red.clave)}
          </span>
          <Input
            aria-label={`Dirección de ${nombreDe(red.clave)}`}
            value={red.url}
            disabled={deshabilitado}
            placeholder="https://…"
            onChange={(e) =>
              onCambiar(redes.map((r, j) => (i === j ? { ...r, url: e.target.value } : r)))
            }
          />
          <Boton
            variante="pastilla"
            tamano="compacto"
            disabled={deshabilitado}
            onClick={() => onCambiar(redes.filter((_, j) => j !== i))}
          >
            Quitar
          </Boton>
        </div>
      ))}

      {disponibles.length > 0 && (
        <select
          aria-label="Añadir una red"
          value=""
          disabled={deshabilitado}
          onChange={(e) => {
            if (e.target.value) onCambiar([...redes, { clave: e.target.value, url: '' }])
          }}
          className="w-full rounded border border-linea bg-superficie-2 px-aire-s py-2 font-mono text-body-s text-contenido"
        >
          <option value="">Añadir una red…</option>
          {disponibles.map((red) => (
            <option key={red.clave} value={red.clave}>
              {red.nombre}
            </option>
          ))}
        </select>
      )}

      <p className="m-0 font-mono text-eyebrow text-texto-tenue">
        Solo se muestran las que añadas aquí, con su dirección completa.
      </p>
    </fieldset>
  )
}

/** Mensaje legible de un fallo del API. */
function mensajeDeError(error: unknown): string {
  return error instanceof ApiError ? error.message : 'No se pudo aplicar el cambio.'
}
