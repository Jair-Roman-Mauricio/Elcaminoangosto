import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Boton, cn, Eyebrow, Field, Input, Modal, Textarea } from '@elcamino/ui'
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
  type Respuesta,
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
              className="h-14 w-full rounded-full border border-linea-fuerte bg-superficie-1 pl-12 pr-aire-s font-ui text-body text-contenido shadow-[inset_0_0_0_1px_var(--linea)] outline-none transition-[border-color,box-shadow] placeholder:text-texto-tenue focus:border-acento focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--oro)_12%,transparent)]"
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
        <p className="m-0 font-ui text-body text-acento">No se pudo cargar la comunidad.</p>
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
        className="flex flex-col gap-aire-xs border border-linea bg-superficie-1 px-aire-s py-aire-s no-underline transition-colors duration-fade ease-camino hover:border-acento"
      >
        <h2 className="m-0 font-ui text-h-s font-medium tracking-titulo text-contenido">
          {hilo.titulo}
        </h2>
        <p className="m-0 font-mono text-body-s uppercase tracking-label text-texto-tenue">
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
          <p role="alert" className="m-0 font-ui text-body-s text-peligro">
            No se pudo publicar. Revisa el texto e inténtalo de nuevo.
          </p>
        )}

        <p className="m-0 font-ui text-body text-texto-tenue">
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

interface RamaDeConversacion {
  respuesta: Respuesta
  contestaciones: RamaDeConversacion[]
}

/**
 * Hasta qué nivel se sigue desplazando la conversación hacia la derecha.
 *
 * La profundidad es libre, pero la sangría no puede serlo: en un móvil, a la
 * séptima contestación no queda ancho para una palabra. A partir de aquí se
 * sigue anidando —el «en respuesta a» dice de quién cuelga cada mensaje— pero
 * sin desplazar más. Es el mismo tope que usa Old Reddit.
 */
const TOPE_DE_SANGRIA = 6

/**
 * Arma el árbol de la conversación a partir de la lista plana del servidor.
 *
 * Una contestación cuyo padre no está en la lista —lo ocultó un admin— se
 * queda arriba en lugar de desaparecer: retirar un mensaje no debe llevarse
 * por delante lo que otros escribieron debajo.
 */
function armarConversacion(respuestas: Respuesta[]): RamaDeConversacion[] {
  const ramas = new Map<string, RamaDeConversacion>(
    respuestas.map((r) => [r.id, { respuesta: r, contestaciones: [] }]),
  )
  const raiz: RamaDeConversacion[] = []
  for (const r of respuestas) {
    const rama = ramas.get(r.id)!
    const padre = r.respuestaPadreId ? ramas.get(r.respuestaPadreId) : undefined
    if (padre) padre.contestaciones.push(rama)
    else raiz.push(rama)
  }
  return raiz
}

/**
 * Cuántos mensajes cuelgan de una respuesta, contando los de sus hijas.
 *
 * Se anuncia el total y no solo las contestaciones directas: quien lee decide
 * si abrir por lo que hay dentro, y «2 respuestas» para una rama de quince
 * engaña.
 */
function contarContestaciones(rama: RamaDeConversacion): number {
  return rama.contestaciones.reduce((total, hija) => total + 1 + contarContestaciones(hija), 0)
}

/**
 * Una respuesta: su firma, su texto y las acciones que admite.
 *
 * Sin recuadro ni fondo. Lo que ordena la conversación es la línea de hilo que
 * dibuja `RamaDeLaConversacion` a su izquierda; poner además superficie, borde
 * y una línea de «en respuesta a» encima cargaba cada mensaje con tres marcos
 * para decir lo mismo.
 */
function RespuestaDelHilo({
  respuesta,
  esAdmin,
  onOcultar,
  onResponder,
  contestando,
  esDelAutor = false,
  contestaciones = 0,
  desplegada = false,
  onDesplegar,
}: {
  respuesta: Respuesta
  esAdmin: boolean
  onOcultar: () => void
  onResponder?: () => void
  contestando?: boolean
  /** Si lo escribió quien abrió el hilo. */
  esDelAutor?: boolean
  /** Cuántos mensajes cuelgan de esta respuesta, a cualquier profundidad. */
  contestaciones?: number
  desplegada?: boolean
  onDesplegar?: () => void
}) {
  return (
    <article className="flex flex-col gap-aire-xs">
      <p className="m-0 flex flex-wrap items-center gap-x-aire-xs font-mono text-body-s uppercase tracking-label text-texto-tenue">
        <span className={esDelAutor ? 'text-contenido' : undefined}>{respuesta.autor}</span>
        {/* Insignia del autor del hilo: quien preguntó vuelve a hablar muchas
            veces y hay que poder seguirlo sin ir leyendo alias uno por uno. */}
        {esDelAutor && (
          <span className="border border-acento px-[0.4em] py-[0.15em] text-acento">Autor</span>
        )}
        <span aria-hidden>·</span>
        <span>{cuando(respuesta.createdAt)}</span>
        {respuesta.oculto && <span aria-hidden>·</span>}
        {respuesta.oculto && <span>Oculta</span>}
      </p>
      <p className="m-0 whitespace-pre-wrap font-ui text-body-l leading-relaxed text-contenido">
        {respuesta.cuerpo}
      </p>
      <div className="flex flex-wrap items-center gap-aire-s">
        {/* Plegar y desplegar la rama. El signo dice qué va a pasar y el
            número, cuánto hay dentro: sin la cuenta, abrir es a ciegas. */}
        {onDesplegar && contestaciones > 0 && (
          <button
            type="button"
            onClick={onDesplegar}
            aria-expanded={desplegada}
            className="inline-flex items-center gap-aire-xs border-0 bg-transparent p-0 font-mono text-body-s uppercase tracking-label text-acento transition-colors duration-fade ease-camino hover:text-contenido"
          >
            {/* El signo va dibujado, no escrito: como carácter heredaba el
                `tracking` de la fila —que mete aire DETRÁS de la letra— y se
                quedaba descentrado dentro del círculo. */}
            <span
              aria-hidden
              className="grid size-5 shrink-0 place-items-center rounded-full border border-acento"
            >
              <svg
                viewBox="0 0 10 10"
                className="size-[0.62rem]"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              >
                <path d="M1.4 5h7.2" />
                {!desplegada && <path d="M5 1.4v7.2" />}
              </svg>
            </span>
            {desplegada
              ? 'Ocultar respuestas'
              : `${contestaciones} ${contestaciones === 1 ? 'respuesta más' : 'respuestas más'}`}
          </button>
        )}
        {onResponder && !contestando && (
          <Boton variante="pastilla" tamano="compacto" className="text-body-s" onClick={onResponder}>
            Responder
          </Boton>
        )}
        {esAdmin && (
          <Boton variante="sutil" tamano="compacto" onClick={onOcultar}>
            {respuesta.oculto ? 'Mostrar' : 'Ocultar'}
          </Boton>
        )}
      </div>
    </article>
  )
}

interface AccionesDeConversacion {
  esAdmin: boolean
  /** Alias de quien abrió el hilo: sus mensajes llevan insignia. */
  autorDelHilo: string
  /** Respuesta que se está contestando ahora mismo, si hay alguna. */
  contestando: string | null
  alContestar: (id: string | null) => void
  /** Ramas abiertas. Vacío al entrar: la conversación empieza plegada. */
  desplegadas: Set<string>
  alDesplegar: (id: string) => void
  alOcultar: (respuesta: Respuesta) => void
  enviando: boolean
  error: boolean
  responder: (cuerpo: string, respuestaPadreId: string) => Promise<void>
}

/**
 * Una respuesta con todo lo que cuelga de ella, a cualquier profundidad.
 *
 * Se dibuja a sí misma para cada contestación: el árbol lo arma
 * `armarConversacion` y aquí solo se recorre.
 *
 * El parentesco lo cuenta una sola línea fina —la de hilo— que baja por la
 * izquierda de las contestaciones y entra en cada una con un codo. Es el único
 * adorno: ni recuadros, ni fondos, ni una etiqueta repitiendo a quién se
 * contesta. La sangría deja de crecer en `TOPE_DE_SANGRIA`, donde ya no queda
 * ancho; de ahí para abajo la conversación sigue, pegada a la misma columna.
 */
function RamaDeLaConversacion({
  rama,
  nivel,
  acciones,
}: {
  rama: RamaDeConversacion
  nivel: number
  acciones: AccionesDeConversacion
}) {
  const { respuesta: r, contestaciones } = rama
  const abierto = acciones.contestando === r.id
  const sangrar = nivel < TOPE_DE_SANGRIA
  const desplegada = acciones.desplegadas.has(r.id)
  const cuantas = contarContestaciones(rama)
  // Al escribir hay que ver dónde cae lo que se escribe: la caja despliega la
  // rama aunque estuviera plegada.
  const verContestaciones = contestaciones.length > 0 && (desplegada || abierto)

  const mostrar = verContestaciones || abierto

  return (
    <li
      className={cn(
        'flex flex-col',
        // El codo: un trazo corto que sale de la línea vertical y llega hasta
        // el mensaje. Sin él la línea pasa de largo y no se ve dónde engancha.
        nivel > 0 &&
          'relative before:absolute before:-left-aire-m before:top-[0.62rem] before:h-px before:w-aire-m before:bg-acento sm:before:-left-aire-l sm:before:w-aire-l',
      )}
    >
      <RespuestaDelHilo
        respuesta={r}
        esAdmin={acciones.esAdmin}
        esDelAutor={r.autor === acciones.autorDelHilo}
        onOcultar={() => acciones.alOcultar(r)}
        onResponder={() => acciones.alContestar(abierto ? null : r.id)}
        contestando={abierto}
        {...(contestaciones.length > 0
          ? {
              contestaciones: cuantas,
              desplegada: verContestaciones,
              onDesplegar: () => acciones.alDesplegar(r.id),
            }
          : {})}
      />

      {/* Abrir y cerrar la rama es un cambio de altura, no un salto.
          `grid-template-rows` de 0fr a 1fr es la única forma de animar hasta
          una altura automática sin medirla en JS ni inventar un máximo. El
          contenido se queda montado —la transición necesita algo que medir—
          e `inert` lo saca del teclado y del lector mientras está plegado. */}
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-fade-corto ease-camino motion-reduce:transition-none',
          mostrar ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
        inert={!mostrar}
      >
        {/* El recorte va en un envoltorio sin borde ni relleno propio: el
            relleno de un elemento sigue dibujándose aunque su altura sea 0, y
            la línea de hilo asomaba bajo las ramas plegadas. */}
        <div className="overflow-hidden">
          <ul
            className={cn(
              'm-0 mt-aire-s flex list-none flex-col gap-aire-m p-0',
              sangrar && 'border-l border-acento pl-aire-m sm:pl-aire-l',
            )}
          >
            {/* La caja va PRIMERO, pegada al mensaje al que se contesta. Al
                final de la lista quedaba debajo de contestaciones ajenas y
                parecía colgar de la última, no de la que se pulsó. */}
            {abierto && (
              <li>
                <FormularioDeRespuesta
                  id={`contestar-${r.id}`}
                  etiqueta={`Contestar a ${r.autor}`}
                  filas={3}
                  enviando={acciones.enviando}
                  error={acciones.error}
                  onCancelar={() => acciones.alContestar(null)}
                  onEnviar={(cuerpo) => acciones.responder(cuerpo, r.id)}
                />
              </li>
            )}
            {contestaciones.map((hija) => (
              <RamaDeLaConversacion
                key={hija.respuesta.id}
                rama={hija}
                nivel={nivel + 1}
                acciones={acciones}
              />
            ))}
          </ul>
        </div>
      </div>
    </li>
  )
}

/** Caja de escritura reutilizable: sirve para el hilo y para una contestación. */
function FormularioDeRespuesta({
  id,
  etiqueta,
  filas,
  enviando,
  error,
  onEnviar,
  onCancelar,
}: {
  id: string
  etiqueta: string
  filas: number
  enviando: boolean
  error: boolean
  onEnviar: (cuerpo: string) => Promise<void>
  onCancelar: () => void
}) {
  const [texto, setTexto] = useState('')

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void onEnviar(texto)
      }}
      className="flex flex-col gap-aire-xs"
    >
      <Field label={etiqueta} htmlFor={id}>
        <Textarea
          id={id}
          rows={filas}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escribe tu respuesta"
          maxLength={5000}
          autoFocus
        />
      </Field>
      {error && (
        <p role="alert" className="m-0 font-ui text-body-s text-peligro">
          No se pudo enviar. Inténtalo de nuevo en un momento.
        </p>
      )}
      <div className="flex flex-wrap gap-aire-xs">
        <Boton
          variante="primary"
          tamano="compacto"
          type="submit"
          disabled={enviando || texto.trim().length < 2}
        >
          {enviando ? 'Enviando…' : 'Responder'}
        </Boton>
        <Boton variante="contorno" tamano="compacto" type="button" onClick={onCancelar}>
          Cancelar
        </Boton>
      </div>
    </form>
  )
}

/** Un hilo con sus respuestas. */
export function HiloPage() {
  const { id = '' } = useParams()
  const { data: hilo, isPending, isError } = useHilo(id)
  const { data: perfil } = usePerfil()
  const esAdmin = perfil?.role === 'ADMIN'
  /** Si está abierta la caja para responder al hilo entero. */
  const [respondiendoAlHilo, setRespondiendoAlHilo] = useState(false)
  /** Respuesta que se está contestando, si hay alguna. */
  const [contestando, setContestando] = useState<string | null>(null)
  /** Ramas desplegadas. Al entrar no hay ninguna: se abren a mano. */
  const [desplegadas, setDesplegadas] = useState<Set<string>>(new Set())
  const responder = useResponder(id)
  const ocultarHilo = useOcultarHilo()
  const ocultarRespuesta = useOcultarRespuesta(id)
  const conversacion = armarConversacion(hilo?.respuestas ?? [])

  const acciones: AccionesDeConversacion = {
    esAdmin,
    autorDelHilo: hilo?.autor ?? '',
    contestando,
    alContestar: setContestando,
    desplegadas,
    alDesplegar: (idDeRama) =>
      setDesplegadas((abiertas) => {
        const siguiente = new Set(abiertas)
        if (!siguiente.delete(idDeRama)) siguiente.add(idDeRama)
        return siguiente
      }),
    alOcultar: (r) => ocultarRespuesta.mutate({ id: r.id, oculto: !r.oculto }),
    enviando: responder.isPending,
    error: responder.isError,
    responder: async (cuerpo, respuestaPadreId) => {
      await responder.mutateAsync({ cuerpo, respuestaPadreId })
      setContestando(null)
      // Lo recién escrito no puede quedar detrás de un «+»: la rama se deja
      // abierta para que se vea dónde cayó.
      setDesplegadas((abiertas) => new Set(abiertas).add(respuestaPadreId))
    },
  }

  if (isError) {
    return (
      <section className="mx-auto w-full max-w-3xl">
        <p className="m-0 font-ui text-body text-acento">Ese hilo no existe o fue retirado.</p>
        <Link to="/comunidad" className="font-mono text-body-s uppercase tracking-label text-acento">
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
      {/* La pregunta que abre el hilo es la pieza de oro macizo de la pantalla:
          el bloque entero va relleno. Las respuestas se quedan con el filete
          dorado al costado, así que la jerarquía se lee de lejos —una pieza
          maciza y muchas con su canto— sin depender del tamaño del texto. */}
      <article className="flex flex-col gap-aire-s border border-oro-hondo bg-oro brillo-oro px-aire-m py-aire-m text-sobreoro">
        <div className="flex flex-wrap items-center justify-between gap-aire-s">
          <p className="m-0 font-mono text-body-s uppercase tracking-label text-sobreoro/75">
            Pregunta del hilo
          </p>
          {/* Responder al hilo se pide desde aquí, no desde una caja siempre
              abierta al final: la pantalla es para leer la conversación, y
              escribir es lo que se hace después de leerla.
              Va relleno de negro sobre el oro —el contorno del tema no se
              vería— y no se mueve al pasar el cursor: el bloque entero es una
              pieza de oro y un botón que cambia de color encima la ensucia. */}
          {!respondiendoAlHilo && (
            <Boton
              variante="contorno"
              tamano="compacto"
              className="border-sobreoro bg-sobreoro text-oro hover:border-sobreoro hover:bg-sobreoro hover:text-oro"
              onClick={() => setRespondiendoAlHilo(true)}
            >
              Responder
            </Boton>
          )}
        </div>
        <h1 className="m-0 font-ui text-h-l font-medium tracking-titulo text-sobreoro">
          {hilo.titulo}
        </h1>
        <p className="m-0 whitespace-pre-wrap font-ui text-body-l leading-relaxed text-sobreoro">
          {hilo.cuerpo}
        </p>
        <p className="m-0 font-mono text-body-s uppercase tracking-label text-sobreoro/70">
          {hilo.autor} · {cuando(hilo.createdAt)}
          {hilo.oculto && ' · Oculto'}
        </p>
        {esAdmin && (
          <div className="flex gap-aire-xs">
            {/* Sobre el oro, el contorno del tema no se ve: se redibuja en el
                mismo tono que el texto del bloque. */}
            <Boton
              variante="contorno"
              tamano="compacto"
              className="border-sobreoro/45 text-sobreoro hover:border-sobreoro hover:text-sobreoro"
              onClick={() => ocultarHilo.mutate({ id: hilo.id, oculto: !hilo.oculto })}
            >
              {hilo.oculto ? 'Mostrar hilo' : 'Ocultar hilo'}
            </Boton>
          </div>
        )}
      </article>

      {respondiendoAlHilo && (
        <FormularioDeRespuesta
          id="responder-al-hilo"
          etiqueta="Responder al hilo"
          filas={4}
          enviando={responder.isPending}
          error={responder.isError}
          onCancelar={() => setRespondiendoAlHilo(false)}
          onEnviar={async (cuerpo) => {
            await responder.mutateAsync({ cuerpo })
            setRespondiendoAlHilo(false)
          }}
        />
      )}

      <h2 className="m-0 font-mono text-body-s uppercase tracking-label text-texto-tenue">
        {hilo.respuestas.length === 0
          ? 'Todavía sin respuestas'
          : `${hilo.respuestas.length} ${hilo.respuestas.length === 1 ? 'respuesta' : 'respuestas'}`}
      </h2>

      <ul className="m-0 flex list-none flex-col gap-aire-m p-0">
        {conversacion.map((rama) => (
          <RamaDeLaConversacion
            key={rama.respuesta.id}
            rama={rama}
            nivel={0}
            acciones={acciones}
          />
        ))}
      </ul>

      <Link
        to="/comunidad"
        className="font-mono text-body-s uppercase tracking-label text-texto-tenue no-underline hover:text-acento"
      >
        ← Volver a la comunidad
      </Link>
    </section>
  )
}
