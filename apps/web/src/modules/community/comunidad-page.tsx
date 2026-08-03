import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Boton, Eyebrow, Field, Input, Modal, Textarea } from '@elcamino/ui'
import { usePerfil } from '../../auth/session'
import { useRegistrarVisita } from '../../lib/analitica'
import {
  useAbrirHilo,
  useHilo,
  useHilos,
  useOcultarHilo,
  useOcultarRespuesta,
  useResponder,
  type HiloResumen,
} from './comunidad-api'

const fechaCorta = new Intl.DateTimeFormat('es-PE', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

const cuando = (iso: string) => fechaCorta.format(new Date(iso))

/**
 * Comunidad: hilos abiertos donde cualquiera pregunta o aporta.
 *
 * Nadie tiene cuenta, así que nadie tiene nombre. Dentro de un hilo cada quien
 * recibe un alias —«Caminante 2»— que solo vale ahí: es lo justo para seguir
 * una conversación de ida y vuelta sin convertir el anonimato en un seudónimo
 * que se pueda perseguir de un hilo a otro.
 */
export function ComunidadPage() {
  useRegistrarVisita('comunidad')
  const [busqueda, setBusqueda] = useState('')
  const [abriendo, setAbriendo] = useState(false)
  const { data: hilos, isPending, isError } = useHilos(busqueda)

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-aire-m">
      <header className="flex flex-col gap-aire-s">
        <Eyebrow>Comunidad</Eyebrow>
        <h1 className="m-0 font-ui text-h-l font-medium tracking-titulo text-contenido">
          Preguntas y aportes
        </h1>
        <p className="m-0 max-w-prose font-ui text-body text-texto-tenue">
          Escribe sin registrarte. Nadie verá tu nombre: dentro de cada hilo llevarás un alias
          para que se pueda seguir la conversación.
        </p>

        <div className="flex flex-wrap items-center gap-aire-s">
          <label className="relative block min-w-0 flex-1">
            <span className="sr-only">Buscar en la comunidad</span>
            <svg
              className="pointer-events-none absolute left-aire-s top-1/2 size-5 -translate-y-1/2 text-texto-tenue"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
              placeholder="Buscar un tema"
              autoComplete="off"
              className="h-14 w-full rounded-full border border-linea-fuerte bg-superficie-1 pl-12 pr-aire-s font-ui text-body text-contenido shadow-[inset_0_0_0_1px_var(--linea)] outline-none transition-[border-color,box-shadow] placeholder:text-texto-tenue focus:border-vino focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--vino)_12%,transparent)]"
            />
          </label>
          {/* Es la acción principal de la pantalla: se le da el mismo peso
              visual que al buscador, no el de un botón secundario. */}
          <Boton
            variante="primary"
            onClick={() => setAbriendo(true)}
            className="h-14 px-aire-m"
          >
            Escribir
          </Boton>
        </div>
      </header>

      {isError && (
        <p className="m-0 font-ui text-body text-vino">No se pudo cargar la comunidad.</p>
      )}
      {isPending && !isError && (
        <p className="m-0 font-ui text-body text-texto-tenue">Cargando hilos…</p>
      )}
      {!isPending && !isError && hilos?.length === 0 && (
        <p className="m-0 font-ui text-body text-texto-tenue">
          {busqueda.trim()
            ? 'Ningún hilo coincide con esa búsqueda.'
            : 'Todavía no hay hilos. Abre el primero.'}
        </p>
      )}

      <ul className="m-0 flex list-none flex-col gap-aire-xs p-0">
        {hilos?.map((hilo) => <FilaDeHilo key={hilo.id} hilo={hilo} />)}
      </ul>

      <DialogoDeHiloNuevo abierto={abriendo} onCerrar={() => setAbriendo(false)} />
    </section>
  )
}

function FilaDeHilo({ hilo }: { hilo: HiloResumen }) {
  return (
    <li>
      <Link
        to={`/comunidad/${hilo.id}`}
        className="flex flex-col gap-aire-xs border border-linea bg-superficie-1 px-aire-s py-aire-s no-underline transition-colors duration-fade ease-camino hover:border-vino"
      >
        <h2 className="m-0 font-ui text-h-s font-medium tracking-titulo text-contenido">
          {hilo.titulo}
        </h2>
        <p className="m-0 font-mono text-eyebrow uppercase tracking-label text-texto-debil">
          {hilo.respuestas === 0
            ? 'Sin respuestas'
            : `${hilo.respuestas} ${hilo.respuestas === 1 ? 'respuesta' : 'respuestas'}`}
          {' · '}
          {cuando(hilo.ultimaActividad)}
        </p>
      </Link>
    </li>
  )
}

function DialogoDeHiloNuevo({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const [titulo, setTitulo] = useState('')
  const [cuerpo, setCuerpo] = useState('')
  const abrir = useAbrirHilo()

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault()
    await abrir.mutateAsync({ titulo, cuerpo })
    setTitulo('')
    setCuerpo('')
    onCerrar()
  }

  return (
    <Modal abierto={abierto} titulo="Abrir un hilo" onCerrar={onCerrar}>
      <form onSubmit={(e) => void enviar(e)} className="flex flex-col gap-aire-s">
        <Field label="Tema" htmlFor="hilo-titulo" hint="Entre 5 y 140 caracteres.">
          <Input
            id="hilo-titulo"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="¿Sobre qué quieres preguntar o aportar?"
            maxLength={140}
          />
        </Field>
        <Field label="Mensaje" htmlFor="hilo-cuerpo">
          <Textarea
            id="hilo-cuerpo"
            rows={6}
            value={cuerpo}
            onChange={(e) => setCuerpo(e.target.value)}
            placeholder="Cuéntalo con calma."
            maxLength={5000}
          />
        </Field>

        {abrir.isError && (
          <p role="alert" className="m-0 font-ui text-body-s text-vino">
            No se pudo publicar. Revisa el texto e inténtalo de nuevo.
          </p>
        )}

        <p className="m-0 font-ui text-body-s text-texto-debil">
          Se publicará de forma anónima y quedará a la vista de cualquiera.
        </p>

        <div className="flex flex-wrap gap-aire-xs">
          <Boton
            variante="primary"
            tamano="compacto"
            type="submit"
            disabled={abrir.isPending || titulo.trim().length < 5 || cuerpo.trim().length < 10}
          >
            {abrir.isPending ? 'Publicando…' : 'Publicar'}
          </Boton>
          <Boton variante="contorno" tamano="compacto" type="button" onClick={onCerrar}>
            Cancelar
          </Boton>
        </div>
      </form>
    </Modal>
  )
}

/** Un hilo con sus respuestas. */
export function HiloPage() {
  const { id = '' } = useParams()
  const { data: hilo, isPending, isError } = useHilo(id)
  const { data: perfil } = usePerfil()
  const esAdmin = perfil?.role === 'ADMIN'
  const [respuesta, setRespuesta] = useState('')
  const responder = useResponder(id)
  const ocultarHilo = useOcultarHilo()
  const ocultarRespuesta = useOcultarRespuesta(id)

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault()
    await responder.mutateAsync(respuesta)
    setRespuesta('')
  }

  if (isError) {
    return (
      <section className="mx-auto w-full max-w-3xl">
        <p className="m-0 font-ui text-body text-vino">Ese hilo no existe o fue retirado.</p>
        <Link to="/comunidad" className="font-mono text-eyebrow uppercase tracking-label text-vino">
          ← Volver a la comunidad
        </Link>
      </section>
    )
  }
  if (isPending || !hilo) {
    return <p className="font-ui text-body text-texto-tenue">Cargando el hilo…</p>
  }

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-aire-m">
      {/* La pregunta que abre el hilo se distingue del resto por todo a la vez:
          fondo propio, filete de vino, título grande y una etiqueta que la
          nombra. Con un solo recurso —solo el borde, solo el tamaño— seguía
          leyéndose como una respuesta más. */}
      <article className="flex flex-col gap-aire-s border border-linea border-l-4 border-l-vino bg-superficie-2 px-aire-m py-aire-m">
        <p className="m-0 font-mono text-eyebrow uppercase tracking-label text-vino">
          Pregunta del hilo
        </p>
        <h1 className="m-0 font-ui text-h-l font-medium tracking-titulo text-contenido">
          {hilo.titulo}
        </h1>
        <p className="m-0 whitespace-pre-wrap font-ui text-body-l leading-relaxed text-contenido">
          {hilo.cuerpo}
        </p>
        <p className="m-0 font-mono text-eyebrow uppercase tracking-label text-texto-debil">
          {hilo.autor} · {cuando(hilo.createdAt)}
          {hilo.oculto && ' · Oculto'}
        </p>
        {esAdmin && (
          <div className="flex gap-aire-xs">
            <Boton
              variante="contorno"
              tamano="compacto"
              onClick={() => ocultarHilo.mutate({ id: hilo.id, oculto: !hilo.oculto })}
            >
              {hilo.oculto ? 'Mostrar hilo' : 'Ocultar hilo'}
            </Boton>
          </div>
        )}
      </article>

      <h2 className="m-0 font-mono text-eyebrow uppercase tracking-label text-texto-tenue">
        {hilo.respuestas.length === 0
          ? 'Todavía sin respuestas'
          : `${hilo.respuestas.length} ${hilo.respuestas.length === 1 ? 'respuesta' : 'respuestas'}`}
      </h2>

      <ul className="m-0 flex list-none flex-col gap-aire-s p-0">
        {hilo.respuestas.map((r) => (
          <li
            key={r.id}
            className="flex flex-col gap-aire-xs border-l-2 border-linea pl-aire-s"
          >
            <p className="m-0 font-mono text-eyebrow uppercase tracking-label text-texto-debil">
              {r.autor} · {cuando(r.createdAt)}
              {r.oculto && ' · Oculta'}
            </p>
            <p className="m-0 whitespace-pre-wrap font-ui text-body leading-relaxed text-contenido">
              {r.cuerpo}
            </p>
            {esAdmin && (
              <Boton
                variante="sutil"
                tamano="compacto"
                className="self-start"
                onClick={() => ocultarRespuesta.mutate({ id: r.id, oculto: !r.oculto })}
              >
                {r.oculto ? 'Mostrar' : 'Ocultar'}
              </Boton>
            )}
          </li>
        ))}
      </ul>

      <form onSubmit={(e) => void enviar(e)} className="flex flex-col gap-aire-xs">
        <Field label="Responder" htmlFor="respuesta">
          <Textarea
            id="respuesta"
            rows={4}
            value={respuesta}
            onChange={(e) => setRespuesta(e.target.value)}
            placeholder="Escribe tu respuesta"
            maxLength={5000}
          />
        </Field>
        {responder.isError && (
          <p role="alert" className="m-0 font-ui text-body-s text-vino">
            No se pudo enviar. Inténtalo de nuevo en un momento.
          </p>
        )}
        <Boton
          variante="primary"
          type="submit"
          disabled={responder.isPending || respuesta.trim().length < 2}
          className="self-start"
        >
          {responder.isPending ? 'Enviando…' : 'Responder'}
        </Boton>
      </form>

      <Link
        to="/comunidad"
        className="font-mono text-eyebrow uppercase tracking-label text-texto-tenue no-underline hover:text-vino"
      >
        ← Volver a la comunidad
      </Link>
    </section>
  )
}
