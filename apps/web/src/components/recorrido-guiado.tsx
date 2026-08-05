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
}

const PARADAS: Parada[] = [
  { desde: 0, ruta: '/tarjetas', titulo: 'Bienvenido', detalle: 'Un lugar al que volver cuando lo necesites' },
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
  const vozRef = useRef<HTMLAudioElement | null>(null)

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
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-gutter pb-aire-m"
    >
      <div className="pointer-events-auto flex w-full max-w-3xl flex-col gap-aire-xs border border-acento bg-negro/85 px-aire-m py-aire-s backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-aire-s">
          <p className="m-0 font-mono text-body-s uppercase tracking-label text-acento">
            {actual.titulo}
          </p>
          <button
            type="button"
            onClick={() => terminar()}
            className="border-0 bg-transparent p-0 font-mono text-body-s uppercase tracking-label text-hueso/60 transition-colors duration-fade ease-camino hover:text-hueso"
          >
            Saltar recorrido
          </button>
        </div>
        <p className="m-0 font-ui text-body text-hueso">{actual.detalle}</p>

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
