import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Boton, Modal, clasesDeBoton } from '@elcamino/ui'
import { medioDisponible } from './datos'
import { metodoSugerido, useContextoDeDonacion } from './contexto'
import { TEXTOS } from './textos'

/** Tiempo de visita ACTIVA en una sección antes de mostrar el aviso. */
const ESPERA_SEGUNDOS = 30
/** Veces seguidas que sale antes de descansar. */
const VECES_POR_CICLO = 3
/** Descanso tras completar el ciclo. Pasado, empieza otro ciclo de tres. */
const DESCANSO_MS = 60 * 60 * 1000
/** `v2`: ignora las marcas del formato anterior, que callaban días enteros. */
const CLAVE = 'eca.donacion.aviso.v2'

interface Registro {
  /** Veces que ha salido en el ciclo en curso. */
  mostradas: number
  /** Hasta cuándo descansa, en ms. 0 si no está descansando. */
  descansaHasta: number
}

function leerRegistro(): Registro {
  try {
    const m = JSON.parse(localStorage.getItem(CLAVE) ?? 'null') as Registro | null
    if (m && Number.isFinite(m.mostradas) && Number.isFinite(m.descansaHasta)) return m
  } catch {
    /* sin almacenamiento o dato corrupto: se empieza de cero */
  }
  return { mostradas: 0, descansaHasta: 0 }
}

function guardarRegistro(registro: Registro): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(registro))
  } catch {
    /* sin almacenamiento: el límite vale solo mientras la pestaña siga abierta */
  }
}

/** ¿Toca mostrarlo ahora? No si está descansando; un descanso vencido abre otro ciclo. */
function puedeMostrarse(ahora: number): boolean {
  const r = leerRegistro()
  return ahora >= r.descansaHasta
}

/** Anota una aparición. A la tercera empieza el descanso y el contador vuelve a cero. */
function anotarAparicion(ahora: number): void {
  const r = leerRegistro()
  const mostradas = (ahora >= r.descansaHasta ? r.mostradas : 0) + 1
  guardarRegistro(
    mostradas >= VECES_POR_CICLO
      ? { mostradas: 0, descansaHasta: ahora + DESCANSO_MS }
      : { mostradas, descansaHasta: 0 },
  )
}

/**
 * Aviso de donación. Sale en cada sección que se visita, tras un rato de uso
 * real en ella, hasta 3 veces seguidas; después descansa una hora y vuelve a
 * empezar. Nunca interrumpe lo importante:
 *
 * - El tiempo solo corre con la pestaña visible. Una pestaña olvidada en
 *   segundo plano no lo dispara, y el tiempo ya acumulado pasa de una sección a
 *   la siguiente (cambiar de sección no lo reinicia).
 * - No sale durante el recorrido guiado ni en la propia página de donación.
 * - Ir a donar da por cumplido el ciclo: descansa una hora.
 * - No pide nada a cambio de seguir: todo el contenido sigue abierto.
 */
export function AvisoDeDonacion() {
  const { pathname } = useLocation()
  const { idioma } = useContextoDeDonacion()
  const [abierto, setAbierto] = useState(false)
  const t = TEXTOS[idioma].aviso

  const hayMedio = medioDisponible(metodoSugerido()) || medioDisponible('yape') || medioDisponible('cci')
  const enDonacion = pathname.startsWith('/donacion')

  // Segundos de uso acumulados desde la última aparición. Vive fuera del efecto
  // para que cambiar de sección no lo reinicie.
  const acumulado = useRef(0)

  useEffect(() => {
    if (!hayMedio || enDonacion) return
    // Una aparición por sección: al entrar en otra, vuelve a poder salir.
    let yaSalioAqui = false
    const reloj = window.setInterval(() => {
      if (yaSalioAqui) return
      if (document.visibilityState !== 'visible') return
      if (document.body.dataset.recorrido === 'activo') return
      acumulado.current += 1
      if (acumulado.current < ESPERA_SEGUNDOS) return
      const ahora = Date.now()
      if (!puedeMostrarse(ahora)) return
      anotarAparicion(ahora)
      acumulado.current = 0
      yaSalioAqui = true
      setAbierto(true)
    }, 1000)
    return () => window.clearInterval(reloj)
  }, [hayMedio, enDonacion, pathname])

  const cerrar = () => setAbierto(false)

  const alDonar = () => {
    guardarRegistro({ mostradas: 0, descansaHasta: Date.now() + DESCANSO_MS })
    setAbierto(false)
  }

  return (
    <Modal
      abierto={abierto}
      onCerrar={cerrar}
      titulo={t.titulo}
      descripcion={t.descripcion}
      className="max-w-3xl [scrollbar-color:rgba(247,246,242,0.3)_transparent] [scrollbar-width:thin]"
    >
      <div
        lang={idioma}
        className="grid items-stretch gap-aire-s min-[760px]:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] min-[760px]:gap-aire-m"
      >
        {/* Decorativa: el mensaje ya dice todo lo que importa. El fondo de la
            imagen es negro puro, así que se funde con el del recuadro. */}
        <div className="overflow-hidden rounded bg-negro">
          <img
            src="/donaciones/pan-y-biblia.jpg"
            alt=""
            width={846}
            height={900}
            decoding="async"
            className="h-40 w-full object-cover object-[50%_30%] min-[760px]:h-full min-[760px]:object-contain"
          />
        </div>

        <div className="flex flex-col gap-aire-s">
          {t.parrafos.map((p) => (
            <p
              key={p}
              className="m-0 font-ui text-[1.0625rem] font-semibold leading-snug text-contenido min-[760px]:text-[1.1875rem]"
            >
              {p}
            </p>
          ))}
          <p className="m-0 font-ui text-h-s font-semibold text-acento">{t.bendicion}</p>
          <div className="mt-aire-xs flex flex-wrap items-center gap-aire-s">
            <Link to="/donacion" onClick={alDonar} className={clasesDeBoton('formulario')}>
              {t.donar}
            </Link>
            <Boton variante="sutil" onClick={cerrar}>
              {t.ahoraNo}
            </Boton>
          </div>
        </div>
      </div>
    </Modal>
  )
}
