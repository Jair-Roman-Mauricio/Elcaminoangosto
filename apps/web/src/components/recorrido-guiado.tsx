import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/** Una parada del recorrido: cuándo la nombra la voz y adónde lleva. */
interface Parada {
  /** Segundo de la narración en que empieza. Sale de Whisper, no de un reparto. */
  desde: number
  /** Sección que se abre al llegar aquí. */
  ruta: string
  /** Lo que se está diciendo, escrito. Sin sonido el recorrido se sigue igual. */
  titulo: string
  detalle: string
  /** En móvil, cuando hay algo distinto que explicar. */
  detalleMovil?: string
}

const PARADAS: Parada[] = [
  {
    desde: 0,
    ruta: '/tarjetas',
    titulo: 'Bienvenido',
    detalle: 'Un lugar al que volver cuando lo necesites',
    // En móvil las secciones viven detrás del botón de arriba a la izquierda.
    // Quien no lo sepa creerá que la plataforma es solo esta pantalla, así que
    // el recorrido lo abre para que se vea de dónde salen.
    detalleMovil: 'Con el botón de arriba se abren las secciones. Mira',
  },
  {
    desde: 11.4,
    ruta: '/tarjetas',
    titulo: 'Tarjetas de Fe',
    detalle: 'Una palabra para hoy, cuando no hay fuerzas para un capítulo entero',
  },
  {
    // La voz encadena «con una basta para empezar» con la presentación de los
    // videos dentro de la misma frase, así que el corte va por palabra y no
    // por el final del bloque anterior.
    desde: 19.52,
    ruta: '/videos',
    titulo: 'Videos cristianos',
    detalle: 'Historias cortas: fe en los minutos que ya tienes',
  },
  {
    desde: 31.96,
    ruta: '/alabanza',
    titulo: 'Alabanza',
    detalle: 'Música para los días en que las palabras no salen',
  },
  {
    desde: 42.68,
    ruta: '/devocionales',
    titulo: 'Devocionales',
    detalle: 'Historias breves para leer de una sentada. No enseñan: acompañan',
  },
  {
    desde: 53.3,
    ruta: '/oraciones',
    titulo: 'Oraciones guiadas',
    detalle: 'Eliges una, la voz empieza y tú solo la sigues',
  },
  {
    desde: 67.16,
    ruta: '/revista',
    titulo: 'Revista',
    detalle: 'Temas que no caben en un párrafo, y tu opinión al final',
  },
  {
    desde: 77.86,
    ruta: '/comunidad',
    titulo: 'Comunidad',
    detalle: 'Pregunta sin dar tu nombre; responde quien ya pasó por ahí',
  },
  {
    desde: 87.18,
    ruta: '/tarjetas',
    titulo: 'Empieza por donde quieras',
    detalle: 'No hace falta recorrerlo todo hoy',
  },
]

const AUDIO = '/videos-lading/recorrido-plataforma.mp3'
/** Dónde acaba de hablar. Con o sin voz, el recorrido dura lo mismo. */
const FIN = 94.04

/**
 * Recorrido guiado de la plataforma.
 *
 * Al llegar desde la landing, una voz nombra cada módulo y la plataforma se
 * mueve sola hasta él: se ve el sitio del que se está hablando, no una captura
 * ni una flecha señalando.
 *
 * Es el último tramo de la presentación, no un tutorial que la plataforma
 * ofrezca por su cuenta: empieza donde termina la mano abierta. Por eso el
 * único disparador es haber visto la historia hasta el final, y por eso no se
 * recuerda si ya se hizo — quien quiera repetirlo vuelve a la portada, que es
 * de donde nace. Se corta con el botón o con Escape.
 */
export function RecorridoGuiado() {
  const location = useLocation()
  const navegar = useNavigate()
  const [activo, setActivo] = useState(() =>
    Boolean((location.state as { recorrido?: boolean } | null)?.recorrido),
  )
  const [parada, setParada] = useState(0)
  const [esMovil, setEsMovil] = useState(false)
  const [conVoz, setConVoz] = useState(true)
  const vozRef = useRef<HTMLAudioElement | null>(null)

  // El mismo corte que usa el layout para cambiar el sidebar por un cajón.
  useEffect(() => {
    const consulta = window.matchMedia('(max-width: 819px)')
    const mirar = () => setEsMovil(consulta.matches)
    mirar()
    consulta.addEventListener('change', mirar)
    return () => consulta.removeEventListener('change', mirar)
  }, [])

  const terminar = useCallback(() => {
    vozRef.current?.pause()
    setActivo(false)
  }, [])

  /**
   * El recorrido ocurre suene o no la voz.
   *
   * Antes, si el navegador bloqueaba el audio, se cerraba entero: la persona no
   * veía ni el recorrido ni el motivo. Y algunos navegadores —Safari, sobre
   * todo— son severos con un `Audio` creado por código aunque ya hubiera habido
   * un gesto en la página.
   *
   * Ahora el reloj es la voz **si suena**, y si no, el tiempo de pared. Las
   * paradas son las mismas y duran lo mismo; lo único que falta es el sonido, y
   * para eso está el botón de activarla.
   */
  useEffect(() => {
    if (!activo) return

    const voz = new Audio(AUDIO)
    voz.preload = 'auto'
    vozRef.current = voz

    const arranque = performance.now()
    // Quién manda el tiempo se decide una sola vez, al arrancar. Mirar
    // `voz.paused` en cada vuelta parecía equivalente y no lo es: mientras el
    // audio carga, o si se pausa un instante, el reloj saltaba al tiempo de
    // pared —que va por su cuenta— y el recorrido daba un brinco.
    let laVozManda = false
    void voz.play().then(
      () => {
        laVozManda = true
        setConVoz(true)
      },
      () => setConVoz(false),
    )

    // Si la voz llega hasta el final, el recorrido se acaba con ella y no
    // espera a que el reloj alcance la marca.
    voz.addEventListener('ended', terminar)

    const reloj = window.setInterval(() => {
      const t = laVozManda ? voz.currentTime : (performance.now() - arranque) / 1000
      if (t >= FIN) {
        terminar()
        return
      }
      let corresponde = 0
      for (let i = PARADAS.length - 1; i >= 0; i -= 1) {
        if (t >= PARADAS[i]!.desde) {
          corresponde = i
          break
        }
      }
      setParada((actual) => (actual === corresponde ? actual : corresponde))
    }, 200)

    return () => {
      window.clearInterval(reloj)
      voz.removeEventListener('ended', terminar)
      voz.pause()
    }
  }, [activo, terminar])

  /** Reintenta la voz desde el punto en que va el recorrido. */
  const activarVoz = () => {
    const voz = vozRef.current
    if (!voz) return
    voz.currentTime = PARADAS[parada]!.desde
    void voz.play().then(() => setConVoz(true), () => undefined)
  }

  // Cada parada abre su sección. `replace` para no dejar seis entradas en el
  // historial: volver atrás debe llevar a la historia, no a media visita.
  useEffect(() => {
    if (!activo) return
    const destino = PARADAS[parada]!.ruta
    if (location.pathname !== destino) navegar(destino, { replace: true })
  }, [activo, parada, location.pathname, navegar])

  /**
   * En móvil, el menú se abre solo durante la bienvenida.
   *
   * Es la única parte de la plataforma que en una pantalla pequeña está
   * escondida: quien no descubra ese botón creerá que esto es una sola
   * pantalla. Verlo abrirse mientras la voz dice «déjame mostrarte lo que hay»
   * enseña dónde vive todo sin gastar una parada en explicarlo.
   *
   * Se acciona pulsando el botón real y no levantando el estado hasta aquí: el
   * cajón pertenece al layout, y atarlo al recorrido dejaría un cable tendido
   * entre dos cosas que no tienen por qué conocerse.
   */
  /**
   * En móvil, cada parada abre el menú a la vista y lo vuelve a cerrar.
   *
   * Es la única forma de aprender un botón que está escondido: verlo pulsarse.
   * Y se hace en CADA sección, no solo al principio, porque un gesto se aprende
   * repitiéndolo — a la tercera vez ya se sabe de dónde salen las secciones.
   *
   * La coreografía tiene tres tiempos: el botón se ilumina como si lo pulsaran,
   * el cajón se abre con la sección de turno marcada, y se cierra para dejar
   * ver el contenido del que habla la voz.
   */
  useEffect(() => {
    if (!activo || !esMovil) return
    let cancelado = false
    const relojes: number[] = []
    const cuerpo = document.body

    cuerpo.dataset.recorridoPulsando = 'si'
    relojes.push(
      window.setTimeout(() => {
        if (cancelado) return
        delete cuerpo.dataset.recorridoPulsando
        document.querySelector<HTMLElement>('[aria-label="Abrir el menú"]')?.click()
        relojes.push(
          window.setTimeout(() => {
            if (cancelado) return
            document.querySelector<HTMLElement>('[aria-label="Cerrar el menú"]')?.click()
          }, 1900),
        )
      }, 450),
    )

    return () => {
      cancelado = true
      for (const reloj of relojes) window.clearTimeout(reloj)
      delete cuerpo.dataset.recorridoPulsando
      // Si el recorrido se corta con el cajón abierto, se cierra: nadie pidió
      // quedarse con el menú encima.
      document.querySelector<HTMLElement>('[aria-label="Cerrar el menú"]')?.click()
    }
  }, [activo, esMovil, parada])

  /**
   * El botón del menú late durante todo el recorrido en móvil.
   *
   * Enseñarlo abriendo el cajón no basta: el cajón lo tapa, y el aviso acaba
   * señalando algo que no está a la vista. Con el cajón ya cerrado, el latido
   * dice dónde estaba lo que se acaba de ver.
   *
   * Va por un atributo en el `body` y una regla de CSS, no tocando clases del
   * botón: el botón es del layout y el recorrido no tiene por qué manosearlo.
   */
  /**
   * Marca en el `body` que hay un recorrido en curso.
   *
   * En móvil sirve para que lata el botón del menú, y en cualquier tamaño para
   * que la sección de videos se silencie: dos voces a la vez no se entienden, y
   * la que manda mientras dura la presentación es la del recorrido.
   */
  useEffect(() => {
    if (!activo) return
    document.body.dataset.recorrido = 'activo'
    return () => {
      delete document.body.dataset.recorrido
    }
  }, [activo])

  // Escapar es lo primero que intenta quien quiere salir de algo.
  useEffect(() => {
    if (!activo) return
    const alTeclear = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') terminar()
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [activo, terminar])

  if (!activo) return null

  const actual = PARADAS[parada]!

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-aire-s pb-aire-s cine:px-gutter cine:pb-aire-m"
    >
      <div className="pointer-events-auto flex w-full max-w-3xl flex-col gap-aire-xs border border-acento bg-negro/90 px-aire-s py-aire-s backdrop-blur-md cine:px-aire-m">
        <div className="flex items-center justify-between gap-aire-s">
          <p className="m-0 min-w-0 truncate font-mono text-body-s uppercase tracking-label text-acento">
            {actual.titulo}
          </p>
          {!conVoz && (
            <button
              type="button"
              onClick={activarVoz}
              className="shrink-0 border border-acento px-aire-xs py-[0.15rem] font-mono text-body-s uppercase tracking-label text-acento transition-colors duration-fade ease-camino hover:bg-oro hover:text-sobreoro"
            >
              Con voz
            </button>
          )}
          <button
            type="button"
            onClick={terminar}
            className="shrink-0 border-0 bg-transparent p-0 font-mono text-body-s uppercase tracking-label text-hueso/60 transition-colors duration-fade ease-camino hover:text-hueso"
          >
            {/* En una pantalla estrecha el rótulo entero empujaba la salida a
                otra línea, y la salida no puede quedar en segundo plano. */}
            <span className="cine:hidden">Saltar</span>
            <span className="hidden cine:inline">Saltar recorrido</span>
          </button>
        </div>
        <p className="m-0 font-ui text-body-s leading-snug text-hueso cine:text-body">
          {(esMovil && actual.detalleMovil) || actual.detalle}
        </p>

        {/* Cuánto queda. Saber que esto acaba es parte de poder quedarse. */}
        <div aria-hidden className="flex gap-[0.3rem]">
          {PARADAS.map((p, i) => (
            <span
              key={p.desde}
              className={`h-[2px] flex-1 rounded-full transition-colors duration-fade ease-camino ${
                i <= parada ? 'bg-acento' : 'bg-hueso/25'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
