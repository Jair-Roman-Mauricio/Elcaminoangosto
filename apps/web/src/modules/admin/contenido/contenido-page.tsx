import { useLayoutEffect, useRef, useState } from 'react'
import { Eyebrow } from '@elcamino/ui'
import { TarjetasPanel } from './tarjetas-panel'
import { VideosPanel } from './videos-panel'
import { CancionesPanel } from './canciones-panel'
import { LecturasPanel } from './lecturas-panel'
import { OracionesPanel } from './oraciones-panel'
import { ConsejerosPanel } from './consejeros-panel'

type Seccion =
  | 'TARJETAS'
  | 'CANCIONES'
  | 'VIDEOS'
  | 'DEVOCIONALES'
  | 'REVISTA'
  | 'ORACIONES'
  | 'CONSEJERIA'

const SECCIONES: { valor: Seccion; label: string }[] = [
  { valor: 'TARJETAS', label: 'Tarjetas' },
  { valor: 'CANCIONES', label: 'Canciones' },
  { valor: 'VIDEOS', label: 'Videos' },
  { valor: 'DEVOCIONALES', label: 'Devocionales' },
  { valor: 'REVISTA', label: 'Revista' },
  { valor: 'ORACIONES', label: 'Oraciones' },
  { valor: 'CONSEJERIA', label: 'Consejería' },
]

/**
 * Contenido (solo ADMIN): un único sitio para publicar y administrar lo que la
 * plataforma ofrece fuera de los cursos — tarjetas, canciones, videos, lecturas
 * y oraciones guiadas.
 *
 * Cada pestaña se apoya en su bounded context: tarjetas en `feed`, videos en
 * `videos` (HU-9.3) y canciones en `music` (HU-9.2).
 */
export function ContenidoPage() {
  const [seccion, setSeccion] = useState<Seccion>('TARJETAS')

  const navRef = useRef<HTMLElement>(null)
  const [indicador, setIndicador] = useState({ left: 0, width: 0 })
  useLayoutEffect(() => {
    const mover = () => {
      const nav = navRef.current
      const boton = nav?.querySelector<HTMLButtonElement>(`[data-seccion="${seccion}"]`)
      if (!nav || !boton) return
      setIndicador({ left: boton.offsetLeft, width: boton.offsetWidth })
    }
    mover()
    window.addEventListener('resize', mover)
    return () => window.removeEventListener('resize', mover)
  }, [seccion])

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-aire-m py-aire-m">
      <header className="flex flex-col gap-aire-xs">
        <Eyebrow>Administración</Eyebrow>
        <h1 className="m-0 font-mono text-h-l font-normal text-contenido">Contenido</h1>
        <p className="m-0 font-mono text-body-s text-texto-tenue">
          Publica y administra lo que se ve fuera de los cursos: tarjetas, canciones, videos,
          devocionales, revista, oraciones
          guiadas y consejería.
        </p>
      </header>

      <nav ref={navRef} aria-label="Tipo de contenido" className="relative flex flex-wrap gap-aire-m">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-0 h-0.5 bg-oro transition-[width,transform] duration-[600ms] ease-camino"
          style={{ width: indicador.width, transform: `translateX(${indicador.left}px)` }}
        />
        {SECCIONES.map((s) => (
          <button
            key={s.valor}
            type="button"
            data-seccion={s.valor}
            onClick={() => setSeccion(s.valor)}
            aria-pressed={seccion === s.valor}
            className={[
              'shrink-0 pb-2 font-ui text-body-s font-medium transition-colors',
              seccion === s.valor ? 'text-contenido' : 'text-texto-tenue hover:text-contenido',
            ].join(' ')}
          >
            {s.label}
          </button>
        ))}
      </nav>

      {seccion === 'TARJETAS' && <TarjetasPanel />}
      {seccion === 'CANCIONES' && <CancionesPanel />}
      {seccion === 'VIDEOS' && <VideosPanel />}
      {seccion === 'DEVOCIONALES' && <LecturasPanel tipo="DEVOCIONAL" />}
      {seccion === 'REVISTA' && <LecturasPanel tipo="ARTICULO" />}
      {seccion === 'ORACIONES' && <OracionesPanel />}
      {seccion === 'CONSEJERIA' && <ConsejerosPanel />}
    </div>
  )
}
