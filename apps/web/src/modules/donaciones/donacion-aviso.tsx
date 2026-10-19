import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Boton, Modal, clasesDeBoton } from '@elcamino/ui'
import { medioDisponible } from './datos'
import { metodoSugerido, useContextoDeDonacion } from './contexto'
import { TEXTOS } from './textos'

/** Tiempo de visita ACTIVA antes de mostrar el aviso. Una vez por visita, no en cada página. */
const ESPERA_SEGUNDOS = 75
/**
 * Cuánto calla el aviso después de salir. Vuelve cada tanto, no una sola vez,
 * pero sin insistir: quien dice «ahora no» lo vuelve a ver a los 3 días, y quien
 * pasó a la página de donación tiene dos semanas de calma.
 */
const SILENCIO_AHORA_NO_DIAS = 3
const SILENCIO_DONAR_DIAS = 14
const CLAVE = 'eca.donacion.aviso'

interface Marca {
  /** Cuándo se vio por última vez, en ms. */
  en: number
  /** Cuántos días calla desde entonces. */
  dias: number
}

function leerMarca(): Marca | null {
  try {
    const crudo = localStorage.getItem(CLAVE)
    if (!crudo) return null
    const m = JSON.parse(crudo) as Marca
    return Number.isFinite(m.en) && Number.isFinite(m.dias) ? m : null
  } catch {
    return null
  }
}

function yaSeVio(): boolean {
  const marca = leerMarca()
  return marca !== null && Date.now() - marca.en < marca.dias * 86_400_000
}

function marcarComoVisto(dias: number): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify({ en: Date.now(), dias } satisfies Marca))
  } catch {
    /* sin almacenamiento: sale una vez por visita, no más */
  }
}

/**
 * Aviso de donación. Aparece una sola vez, tras un rato de visita real, y
 * nunca interrumpe lo importante:
 *
 * - El tiempo solo corre con la pestaña visible; una pestaña olvidada en
 *   segundo plano no lo dispara.
 * - No sale durante el recorrido guiado ni en la propia página de donación.
 * - Vuelve cada tanto: 3 días después de «Ahora no», 14 tras ir a donar.
 * - No pide nada a cambio de seguir: todo el contenido sigue abierto.
 */
export function AvisoDeDonacion() {
  const { pathname } = useLocation()
  const { idioma } = useContextoDeDonacion()
  const [abierto, setAbierto] = useState(false)
  const t = TEXTOS[idioma].aviso

  const hayMedio = medioDisponible(metodoSugerido()) || medioDisponible('yape') || medioDisponible('cci')
  const enDonacion = pathname.startsWith('/donacion')

  useEffect(() => {
    if (!hayMedio || enDonacion || yaSeVio()) return
    let segundos = 0
    const reloj = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      if (document.body.dataset.recorrido === 'activo') return
      segundos += 1
      if (segundos >= ESPERA_SEGUNDOS) {
        window.clearInterval(reloj)
        setAbierto(true)
      }
    }, 1000)
    return () => window.clearInterval(reloj)
  }, [hayMedio, enDonacion])

  const cerrar = () => {
    marcarComoVisto(SILENCIO_AHORA_NO_DIAS)
    setAbierto(false)
  }

  const alDonar = () => {
    marcarComoVisto(SILENCIO_DONAR_DIAS)
    setAbierto(false)
  }

  return (
    <Modal abierto={abierto} onCerrar={cerrar} titulo={t.titulo} descripcion={t.descripcion} className="max-w-lg">
      <div lang={idioma} className="flex flex-col gap-aire-s">
        {t.parrafos.map((p) => (
          <p key={p} className="m-0 font-ui text-body leading-relaxed text-texto-tenue">
            {p}
          </p>
        ))}
        <div className="mt-aire-xs flex flex-wrap items-center gap-aire-s">
          <Link to="/donacion" onClick={alDonar} className={clasesDeBoton('formulario')}>
            {t.donar}
          </Link>
          <Boton variante="sutil" onClick={cerrar}>
            {t.ahoraNo}
          </Boton>
        </div>
      </div>
    </Modal>
  )
}
