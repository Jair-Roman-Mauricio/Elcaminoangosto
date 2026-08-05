import { EditorLectura } from '../../components/editor-lectura'
import { FondoDeDevocional, type ClaveDeFondo } from './fondos-de-devocional'
import { RedesDeLaLectura } from './redes-de-la-lectura'
import type { Lectura } from './lecturas-api'

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
 * No lleva «para seguir leyendo» al final: un devocional se lee y se guarda, y
 * ofrecer el siguiente en la misma página empuja a seguir en vez de dejar que
 * lo leído se asiente. Para eso está el listado.
 */
export function LectorDeDevocional({
  lectura,
  onVolver,
}: {
  lectura: Lectura
  onVolver: () => void
}) {
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

        <div className="relative grid min-h-[34rem] items-start gap-aire-m px-gutter py-aire-l md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
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

            <EditorLectura
              key={lectura.id}
              value={lectura.cuerpo}
              editable={false}
              className="editor-lectura--revista mt-aire-s w-full"
            />

            {lectura.referencia && (
              <p className="m-0 border border-oro-hondo px-[0.55rem] py-[0.25rem] font-mono text-[0.68rem] uppercase tracking-label text-acento">
                {lectura.referencia}
              </p>
            )}

            <p className="m-0 w-full border-t border-linea pt-aire-s text-right font-mono text-body-s uppercase tracking-label text-texto-tenue">
              {lectura.autor}
            </p>
          </div>

          {/* La ilustración se centra en el alto del devocional y tira hacia
              el medio de la banda: pegada arriba y al canto derecho quedaba
              desparejada del texto que acompaña. */}
          {lectura.ilustracionUrl && (
            <img
              src={lectura.ilustracionUrl}
              alt=""
              className="animate-[mensaje-entra_900ms_var(--ease)_both] mx-auto max-h-[70vh] w-full self-center object-contain drop-shadow-[0_1.5rem_3rem_rgba(0,0,0,0.6)] md:-translate-x-[6%] md:scale-[1.1]"
            />
          )}
        </div>
      </section>

    </div>
  )
}
