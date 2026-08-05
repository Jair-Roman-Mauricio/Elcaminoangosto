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
    detalleMovil: 'Estas son las secciones. En el móvil se abren con el botón de arriba',
  },
  {
    desde: 13.98,
    ruta: '/tarjetas',
    titulo: 'Tarjetas de Fe',
    detalle: 'Una palabra para hoy, cuando no hay fuerzas para un capítulo entero',
  },
  {
    desde: 24.86,
    ruta: '/videos',
    titulo: 'Videos cristianos',
    detalle: 'Historias cortas: fe en los minutos que ya tienes',
  },
  {
    desde: 35.38,
    ruta: '/alabanza',
    titulo: 'Alabanza',
    detalle: 'Música para los días en que las palabras no salen',
  },
  {
    desde: 45.8,
    ruta: '/comunidad',
    titulo: 'Comunidad',
    detalle: 'Pregunta sin dar tu nombre; responde quien ya pasó por ahí',
  },
  {
    desde: 57.1,
    ruta: '/tarjetas',
    titulo: 'Empieza por donde quieras',
    detalle: 'No hace falta recorrerlo todo hoy',
  },
]

const AUDIO = '/videos-lading/recorrido-plataforma.mp3'
/** Marca de que ya se hizo. Un recorrido que se repite es un peaje. */
const CLAVE = 'ec-recorrido-visto'

/** Si ya se hizo el recorrido en este navegador. */
export function recorridoYaVisto(): boolean {
  try {
    return window.localStorage.getItem(CLAVE) === 'si'
  } catch {
    // Sin almacenamiento se repite. Es preferible a no poder entrar.
    return false
  }
}

/**
 * Recorrido guiado de la plataforma.
 *
 * Al llegar desde la landing, una voz nombra cada módulo y la plataforma se
 * mueve sola hasta él: se ve el sitio del que se está hablando, no una captura
 * ni una flecha señalando.
 *
 * Tres reglas que lo mantienen del lado de la bienvenida y no del secuestro:
 * se puede cortar en cualquier momento, ocurre una sola vez por navegador, y
 * solo se dispara viniendo de la historia. Quien entra por un enlace directo a
 * Comunidad va a Comunidad.
 */
export function RecorridoGuiado() {
  const location = useLocation()
  const navegar = useNavigate()
  const pedido = Boolean((location.state as { recorrido?: boolean } | null)?.recorrido)
  const [activo, setActivo] = useState(() => pedido && !recorridoYaVisto())
  const [parada, setParada] = useState(0)
  const [esMovil, setEsMovil] = useState(false)
  const vozRef = useRef<HTMLAudioElement | null>(null)

  // El mismo corte que usa el layout para cambiar el sidebar por un cajón.
  useEffect(() => {
    const consulta = window.matchMedia('(max-width: 819px)')
    const mirar = () => setEsMovil(consulta.matches)
    mirar()
    consulta.addEventListener('change', mirar)
    return () => consulta.removeEventListener('change', mirar)
  }, [])

  /**
   * `dalo POR VISTO` distingue haberlo hecho de no haber podido.
   *
   * Si el navegador no deja sonar el audio, el recorrido se cierra pero NO se
   * marca: la persona no lo ha visto, y consumirlo en silencio le quitaría la
   * bienvenida sin dársela nunca.
   */
  const terminar = useCallback((daloPorVisto = true) => {
    vozRef.current?.pause()
    if (daloPorVisto) {
      try {
        window.localStorage.setItem(CLAVE, 'si')
      } catch {
        // Sin almacenamiento no se recuerda; sigue siendo saltable.
      }
    }
    setActivo(false)
  }, [])

  useEffect(() => {
    if (!activo) return

    const voz = new Audio(AUDIO)
    voz.preload = 'auto'
    vozRef.current = voz

    const alAvanzar = () => {
      const t = voz.currentTime
      let corresponde = 0
      for (let i = PARADAS.length - 1; i >= 0; i -= 1) {
        if (t >= PARADAS[i]!.desde) {
          corresponde = i
          break
        }
      }
      setParada((actual) => (actual === corresponde ? actual : corresponde))
    }

    voz.addEventListener('timeupdate', alAvanzar)
    const alAcabar = () => terminar()
    voz.addEventListener('ended', alAcabar)
    void voz.play().catch(() => {
      // Sin sonido no tiene sentido pasear a nadie: se cierra, pero queda
      // pendiente para la próxima vez.
      terminar(false)
    })

    return () => {
      voz.removeEventListener('timeupdate', alAvanzar)
      voz.removeEventListener('ended', alAcabar)
      voz.pause()
    }
  }, [activo, terminar])

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
  useEffect(() => {
    if (!activo || !esMovil) return
    const abrir = parada === 0
    const boton = document.querySelector<HTMLElement>(
      abrir ? '[aria-label="Abrir el menú"]' : '[aria-label="Cerrar el menú"]',
    )
    // Solo se pulsa si hace falta: el botón de abrir desaparece con el cajón
    // abierto, y al revés.
    boton?.click()
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
  useEffect(() => {
    if (!activo || !esMovil) return
    document.body.dataset.recorrido = 'activo'
    return () => {
      delete document.body.dataset.recorrido
    }
  }, [activo, esMovil])

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
          <button
            type="button"
            onClick={() => terminar()}
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
