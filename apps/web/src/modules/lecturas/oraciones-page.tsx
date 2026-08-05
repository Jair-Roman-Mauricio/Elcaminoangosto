import { useEffect, useMemo, useState } from 'react'
import { useOraciones, type OracionGuiada } from './lecturas-api'
import { neonDeCategoria } from './neon-de-categoria'
import { RezoEnMarcha } from './rezo-en-marcha'
import { useRegistrarVisita } from '../../lib/analitica'

/** Lo que se muestra cuando no se ha filtrado nada. */
const TODAS = 'Todas'

/**
 * Oraciones guiadas: un carrusel de estampas, no un listado.
 *
 * Cada oración se presenta con un recorte sin fondo flotando sobre el negro,
 * con el brillo de su categoría alrededor. La forma dice a qué se entra: una
 * lista de filas se hojea, y una estampa a pantalla se mira y se reza.
 *
 * El color no se elige al publicar, se deduce de la categoría, así que el
 * filtro de arriba también cambia el ambiente de la página: al pasar de
 * «Descanso» a «Miedo» cambia el brillo del fondo, no solo lo que se lista.
 */
export function OracionesPage() {
  useRegistrarVisita('oraciones')
  const { data, isPending, isError } = useOraciones()
  const [categoria, setCategoria] = useState(TODAS)
  const [indice, setIndice] = useState(0)
  const [rezando, setRezando] = useState<OracionGuiada | null>(null)

  const todas = useMemo(() => data ?? [], [data])

  const categorias = useMemo(() => {
    const vistas = new Set<string>()
    for (const oracion of todas) if (oracion.tema) vistas.add(oracion.tema)
    return [TODAS, ...[...vistas].sort((a, b) => a.localeCompare(b, 'es'))]
  }, [todas])

  const visibles = useMemo(
    () => (categoria === TODAS ? todas : todas.filter((o) => o.tema === categoria)),
    [categoria, todas],
  )

  // Al cambiar de categoría se vuelve al principio: quedarse en la cuarta de la
  // lista anterior deja mirando algo que no se pidió.
  useEffect(() => setIndice(0), [categoria])

  const actual = visibles[indice] ?? visibles[0]
  const neon = neonDeCategoria(actual?.tema ?? null)

  // El carrusel es una pantalla, no una página que se recorre: mientras está
  // delante, el resto del documento no se desplaza. Se restaura al salir para
  // no dejar el navegador trabado en otras secciones.
  useEffect(() => {
    const antes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = antes
    }
  }, [])

  if (rezando) return <RezoEnMarcha oracion={rezando} onSalir={() => setRezando(null)} />

  return (
    <section
      className="pantalla-de-oraciones relative mx-auto flex w-full max-w-5xl flex-col items-center justify-center gap-aire-s"
      style={{ ['--neon' as string]: neon }}
    >
      {/* El brillo de la categoría, detrás de todo y fundido con el negro. */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[38rem] w-[min(90vw,52rem)] -translate-x-1/2 transition-[background] duration-[900ms] ease-camino"
        style={{
          background:
            'radial-gradient(60% 55% at 50% 42%, rgba(var(--neon), 0.22) 0%, transparent 70%)',
        }}
      />

      {/* Un solo rótulo: el nombre de la sección y nada más. Todo lo que se
          añada aquí se lo quita a la estampa, que es lo que hay que mirar. */}
      <header className="flex flex-col items-center text-center">
        <h1 className="m-0 font-ui text-h-l font-medium tracking-titulo text-contenido">
          Oraciones guiadas
        </h1>
      </header>

      {isError && (
        <p className="m-0 font-ui text-body text-peligro">No se pudieron cargar las oraciones.</p>
      )}
      {isPending && <p className="m-0 font-ui text-body text-texto-tenue">Cargando…</p>}
      {!isPending && !isError && todas.length === 0 && (
        <p className="m-0 font-ui text-body text-texto-tenue">Todavía no hay oraciones.</p>
      )}

      {categorias.length > 1 && (
        <nav aria-label="Categorías" className="flex flex-wrap justify-center gap-aire-xs">
          {categorias.map((nombre) => {
            const activa = nombre === categoria
            return (
              <button
                key={nombre}
                type="button"
                onClick={() => setCategoria(nombre)}
                aria-pressed={activa}
                className="rounded-full border px-[1.1rem] py-[0.4rem] font-mono text-body-s uppercase tracking-label transition-colors duration-fade ease-camino"
                style={
                  activa
                    ? {
                        borderColor: `rgba(${neonDeCategoria(nombre === TODAS ? null : nombre)}, 0.7)`,
                        color: `rgb(${neonDeCategoria(nombre === TODAS ? null : nombre)})`,
                        background: `rgba(${neonDeCategoria(nombre === TODAS ? null : nombre)}, 0.12)`,
                      }
                    : { borderColor: 'var(--linea)', color: 'var(--contenido-tenue)' }
                }
              >
                {nombre}
              </button>
            )
          })}
        </nav>
      )}

      {actual && (
        <Carrusel
          oraciones={visibles}
          indice={Math.min(indice, visibles.length - 1)}
          onIndice={setIndice}
          onRezar={setRezando}
        />
      )}
    </section>
  )
}

/**
 * El carrusel: la estampa del centro manda y las de al lado se insinúan.
 *
 * Se mueve con las flechas y con el teclado. No hay desplazamiento libre: una
 * oración se elige, no se hojea, y detenerse en cada una es parte de la cosa.
 */
function Carrusel({
  oraciones,
  indice,
  onIndice,
  onRezar,
}: {
  oraciones: OracionGuiada[]
  indice: number
  onIndice: (i: number) => void
  onRezar: (oracion: OracionGuiada) => void
}) {
  const actual = oraciones[indice]!
  const mover = (paso: number) =>
    onIndice((indice + paso + oraciones.length) % oraciones.length)

  return (
    // `min-h-0` es lo que deja que el hijo se encoja: sin él, un flex item se
    // niega a bajar de su tamaño natural y empuja el resto fuera de la pantalla.
    <div className="flex w-full min-h-0 flex-1 flex-col items-center gap-aire-s">
      <div className="flex w-full min-h-0 flex-1 items-center justify-center gap-aire-s">
        {oraciones.length > 1 && (
          <FlechaDelCarrusel hacia="anterior" onClick={() => mover(-1)} />
        )}

        <article
          key={actual.id}
          className="flex h-full min-h-0 min-w-0 flex-1 animate-[mensaje-entra_600ms_var(--ease)_both] flex-col items-center justify-center gap-aire-s"
        >
          {actual.tema && (
            // Pegada a la imagen, no flotando: la categoría es de la estampa.
            <p
              className="m-0 rounded-full border px-[0.8rem] py-[0.2rem] font-mono text-[0.62rem] uppercase tracking-label"
              style={{
                borderColor: `rgba(${neonDeCategoria(actual.tema)}, 0.55)`,
                color: `rgb(${neonDeCategoria(actual.tema)})`,
              }}
            >
              {actual.tema}
            </p>
          )}

          {actual.imagenUrl ? (
            <img
              src={actual.imagenUrl}
              alt=""
              className="min-h-0 w-auto max-w-full flex-1 object-contain"
              // El brillo va en el borde del dibujo, no en una caja: por eso es
              // `drop-shadow` y no `box-shadow`, que dibujaría un rectángulo.
              style={{
                filter: `drop-shadow(0 0 1.6rem rgba(${neonDeCategoria(actual.tema)}, 0.55)) drop-shadow(0 0 4rem rgba(${neonDeCategoria(actual.tema)}, 0.3))`,
              }}
            />
          ) : (
            <span
              aria-hidden
              className="grid w-full max-w-sm flex-1 place-items-center rounded-full"
              style={{
                background: `radial-gradient(closest-side, rgba(${neonDeCategoria(actual.tema)}, 0.18), transparent)`,
              }}
            />
          )}

          <h2 className="m-0 text-center font-serif text-[clamp(1.5rem,3.4vw,2.4rem)] font-light text-contenido">
            {actual.titulo}
          </h2>

          <button
            type="button"
            onClick={() => onRezar(actual)}
            className="rounded-full border px-[2rem] py-[0.8rem] font-mono text-body-s uppercase tracking-boton text-hueso transition-colors duration-fade ease-camino"
            style={{
              borderColor: `rgba(${neonDeCategoria(actual.tema)}, 0.6)`,
              background: `rgba(${neonDeCategoria(actual.tema)}, 0.14)`,
              boxShadow: `0 0 2rem rgba(${neonDeCategoria(actual.tema)}, 0.3)`,
            }}
          >
            Orar conmigo
          </button>
        </article>

        {oraciones.length > 1 && <FlechaDelCarrusel hacia="siguiente" onClick={() => mover(1)} />}
      </div>

      {oraciones.length > 1 && (
        <div className="flex items-center gap-aire-xs">
          {oraciones.map((oracion, i) => (
            <button
              key={oracion.id}
              type="button"
              onClick={() => onIndice(i)}
              aria-label={`Ir a ${oracion.titulo}`}
              aria-current={i === indice ? 'true' : undefined}
              className="size-2 rounded-full transition-colors duration-fade"
              style={{
                background:
                  i === indice ? `rgb(${neonDeCategoria(oracion.tema)})` : 'var(--linea)',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function FlechaDelCarrusel({
  hacia,
  onClick,
}: {
  hacia: 'anterior' | 'siguiente'
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={hacia === 'anterior' ? 'Oración anterior' : 'Oración siguiente'}
      className="grid size-11 shrink-0 place-items-center rounded-full border border-linea text-texto-tenue transition-colors duration-fade ease-camino hover:border-acento hover:text-acento"
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path
          d={hacia === 'anterior' ? 'M15 5 8 12l7 7' : 'M9 5l7 7-7 7'}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}
