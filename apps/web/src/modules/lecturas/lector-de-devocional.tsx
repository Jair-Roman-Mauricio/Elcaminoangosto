import { EditorLectura } from '../../components/editor-lectura'
import { FondoDeDevocional, type ClaveDeFondo } from './fondos-de-devocional'
import { RedesDeLaLectura } from './redes-de-la-lectura'
import { TarjetaDeDevocional } from './tarjeta-de-devocional'
import { useRelacionadas, type Lectura } from './lecturas-api'

const formatoFecha = new Intl.DateTimeFormat('es-PE', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

/**
 * La página de un devocional.
 *
 * Se presenta de una vez y no se baja como un artículo: el texto a un lado, un
 * recorte sin fondo al otro y un telón detrás. Es a propósito que no se parezca
 * a la revista —dos secciones que se leen igual acaban siendo la misma— y
 * también que quepa de una sentada, que es lo que un devocional promete.
 *
 * La ilustración se queda quieta mientras el texto baja: es la imagen de lo que
 * se está leyendo, no una foto que se abandona al primer desplazamiento.
 */
export function LectorDeDevocional({
  lectura,
  onVolver,
  onAbrirOtra,
}: {
  lectura: Lectura
  onVolver: () => void
  onAbrirOtra?: (id: string) => void
}) {
  const relacionadas = useRelacionadas(onAbrirOtra ? lectura.id : null)
  const otras = relacionadas.data ?? []

  return (
    <div className="flex flex-col gap-aire-l">
      {/* El telón se come el margen de la página, como la portada de un
          artículo: si dejara ver el fondo liso alrededor parecería una caja. */}
      <section className="lectura-portada relative overflow-hidden">
        {lectura.fondo && (
          <>
            <FondoDeDevocional clave={lectura.fondo as ClaveDeFondo} />
            {/* El telón se apaga hacia abajo: cortado en seco dejaba una raya
                horizontal donde termina la sección. */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-fondo"
            />
          </>
        )}

        <div className="relative grid min-h-[34rem] items-center gap-aire-m px-gutter py-aire-l md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] md:py-0">
          <div className="flex flex-col items-start gap-aire-s">
            <button
              type="button"
              onClick={onVolver}
              className="border-0 bg-transparent p-0 font-mono text-body-s uppercase tracking-label text-texto-tenue transition-colors duration-fade ease-camino hover:text-acento"
            >
              ← Volver
            </button>

            <p className="m-0 border border-oro-hondo px-[0.55rem] py-[0.2rem] font-mono text-[0.62rem] uppercase tracking-label text-acento">
              {lectura.seccion ?? 'Devocional'} · {lectura.minutos} min
            </p>

            {/* En crema y no en blanco: sobre un fondo de color el blanco puro
                se despega, y el titular tiene que verse dentro de la escena. */}
            <h1 className="m-0 font-ui text-[clamp(2.2rem,5.5vw,4.2rem)] font-bold uppercase leading-[0.9] tracking-[-0.02em] text-oro-claro">
              {lectura.titulo}
            </h1>

            {lectura.entradilla && (
              <p className="m-0 max-w-[42ch] font-serif text-[clamp(1.1rem,2vw,1.5rem)] font-light italic leading-[1.3] text-texto-tenue">
                {lectura.entradilla}
              </p>
            )}

            <p className="m-0 font-mono text-body-s uppercase tracking-label text-texto-debil">
              {lectura.autor}
              {lectura.publishedAt && ` · ${formatoFecha.format(new Date(lectura.publishedAt))}`}
            </p>

            <RedesDeLaLectura redes={lectura.redes} orientacion="fila" />
          </div>

          {/* La ilustración manda en su mitad y se sale de la banda por arriba
              y por abajo: contenida con margen parecía una foto pegada, no la
              imagen de lo que se está leyendo. */}
          {lectura.ilustracionUrl && (
            <img
              src={lectura.ilustracionUrl}
              alt=""
              className="animate-[mensaje-entra_900ms_var(--ease)_both] mx-auto h-full w-full self-stretch object-contain drop-shadow-[0_1.5rem_3rem_rgba(0,0,0,0.6)] md:my-[-3rem] md:h-[calc(100%+6rem)] md:scale-[1.12]"
            />
          )}
        </div>
      </section>

      <div className="w-full max-w-[46rem] px-gutter">
        <EditorLectura
          key={lectura.id}
          value={lectura.cuerpo}
          editable={false}
          className="editor-lectura--revista"
        />

        {lectura.referencia && (
          <p className="m-0 mt-aire-m border border-linea px-[0.55rem] py-[0.25rem] font-mono text-[0.68rem] uppercase tracking-label text-acento [display:inline-block]">
            {lectura.referencia}
          </p>
        )}

        <p className="m-0 mt-aire-m border-t border-linea pt-aire-s text-right font-mono text-body-s uppercase tracking-label text-texto-tenue">
          {lectura.autor}
        </p>
      </div>

      {onAbrirOtra && otras.length > 0 && (
        <section className="flex w-full flex-col gap-aire-s border-t border-linea pt-aire-l">
          <h2 className="m-0 font-mono text-body-s uppercase tracking-label text-texto-tenue">
            Para seguir leyendo
          </h2>
          <ul className="m-0 flex list-none flex-col divide-y divide-linea p-0">
            {otras.map((otra) => (
              <li key={otra.id}>
                <TarjetaDeDevocional lectura={otra} onAbrir={() => onAbrirOtra(otra.id)} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
