import { Eyebrow } from '@elcamino/ui'
import { useConsejeros, type Consejero } from './consejeria-api'
import { CANALES, comoSeLee } from './canales'
import { useRegistrarVisita } from '../../lib/analitica'
import { useSeo } from '../../lib/seo'

/**
 * Consejería: a quién escribir cuando lo que pasa no puede esperar.
 *
 * Es la única sección donde la prisa manda sobre el diseño. Quien llega aquí
 * puede estar en su peor día, así que:
 *
 * - Los que atienden urgencias van primero y con su contacto desplegado, no
 *   escondido tras un «ver más».
 * - Cada dato es un enlace que hace lo que dice: marcar, abrir WhatsApp,
 *   escribir el correo. Nadie debería estar copiando dígitos a mano ahora.
 * - Nada de sesión, ni de formulario, ni de pasos. El teléfono, a la vista.
 */
export function ConsejeriaPage() {
  useRegistrarVisita('consejeria')
  useSeo({
    titulo: 'Consejería cristiana',
    descripcion:
      'A quién escribir cuando lo que pasa no puede esperar: consejeros cristianos dispuestos a escuchar y acompañar.',
    ruta: '/consejeria',
  })
  const { data, isPending, isError } = useConsejeros()

  const consejeros = data ?? []
  const urgencias = consejeros.filter((c) => c.atiendeUrgencias)
  const resto = consejeros.filter((c) => !c.atiendeUrgencias)

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-aire-m">
      <header className="flex flex-col gap-aire-xs">
        <Eyebrow>Consejería</Eyebrow>
        <h1 className="m-0 font-ui text-h-l font-medium tracking-titulo text-contenido">
          No tienes que pasar esto solo
        </h1>
        <p className="m-0 max-w-prose font-ui text-body text-texto-tenue">
          Personas reales, con nombre y teléfono. Escribe aunque no sepas por dónde empezar; y si
          lo que estás viviendo no puede esperar, llama ahora.
        </p>
      </header>

      {isError && (
        <p className="m-0 font-ui text-body text-peligro">
          No se pudo cargar la lista. Vuelve a intentarlo en un momento.
        </p>
      )}
      {isPending && <p className="m-0 font-ui text-body text-texto-tenue">Cargando…</p>}
      {!isPending && !isError && consejeros.length === 0 && (
        <p className="m-0 font-ui text-body text-texto-tenue">
          Todavía no hay consejeros publicados.
        </p>
      )}

      {urgencias.length > 0 && (
        <div className="flex flex-col gap-aire-s">
          <h2 className="m-0 font-mono text-body-s uppercase tracking-label text-acento">
            Atienden con urgencia
          </h2>
          <ul className="m-0 grid list-none gap-aire-m p-0 sm:grid-cols-2">
            {urgencias.map((consejero) => (
              <li key={consejero.id} className="min-w-0">
                <FichaDeConsejero consejero={consejero} urgente />
              </li>
            ))}
          </ul>
        </div>
      )}

      {resto.length > 0 && (
        <div className="flex flex-col gap-aire-s">
          {urgencias.length > 0 && (
            <h2 className="m-0 font-mono text-body-s uppercase tracking-label text-texto-tenue">
              También puedes escribirles
            </h2>
          )}
          <ul className="m-0 grid list-none gap-aire-m p-0 sm:grid-cols-2">
            {resto.map((consejero) => (
              <li key={consejero.id} className="min-w-0">
                <FichaDeConsejero consejero={consejero} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function FichaDeConsejero({
  consejero,
  urgente = false,
}: {
  consejero: Consejero
  urgente?: boolean
}) {
  // En el orden de CANALES, que va de lo que responde antes a lo que menos.
  const contactos = CANALES.filter((canal) => consejero.contactos[canal.clave])

  return (
    <article
      className={`relative flex flex-col justify-end overflow-hidden border ${
        urgente ? 'border-oro-hondo' : 'border-linea'
      }`}
    >
      {/* La cara de quien va a responder, entera y sin recortar: la tarjeta mide
          lo que mide la foto. Recortada a una altura fija salían medias caras,
          y aquí la cara es media presentación. */}
      {consejero.fotoUrl ? (
        <img
          src={consejero.fotoUrl}
          alt=""
          loading="lazy"
          className="block h-auto w-full"
        />
      ) : (
        <span
          aria-hidden
          className="grid aspect-[4/5] w-full place-items-start justify-center bg-superficie-2 pt-aire-m font-serif text-[7rem] leading-none text-acento/10"
        >
          {consejero.nombre.trim().charAt(0)}
        </span>
      )}

      {/* El velo se concentra abajo, donde va el texto: arriba deja ver la foto
          casi limpia. Sin nada, un número sobre una zona clara no se lee. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-negro from-15% via-negro/70 via-55% to-transparent"
      />

      <div className="absolute inset-x-0 bottom-0 flex min-w-0 flex-col gap-aire-xs p-aire-m">
        {urgente && (
          <p className="m-0 self-start border border-oro-hondo bg-negro/60 px-[0.5rem] py-[0.15rem] font-mono text-[0.6rem] uppercase tracking-label text-acento">
            Atiende urgencias
          </p>
        )}

        <p className="m-0 font-ui text-h-m font-medium leading-tight text-hueso">
          {consejero.nombre}
        </p>
        {consejero.rol && (
          <p className="m-0 font-mono text-body-s uppercase tracking-label text-hueso/65">
            {consejero.rol}
          </p>
        )}

        {consejero.presentacion && (
          <p className="m-0 font-ui text-body-s leading-relaxed text-hueso/80">
            {consejero.presentacion}
          </p>
        )}

        {/* Los contactos, a la vista y pulsables. Nada de desplegables: quien
            está mal no debería tener que buscar el teléfono. */}
        <ul className="m-0 mt-aire-xs flex min-w-0 list-none flex-col gap-[0.35rem] p-0">
          {contactos.map((canal) => {
            const dato = consejero.contactos[canal.clave]!
            const externo = canal.clave !== 'telefono' && canal.clave !== 'correo'
            return (
              <li key={canal.clave} className="min-w-0">
                <a
                  href={canal.enlace(dato)}
                  {...(externo ? { target: '_blank', rel: 'noreferrer' } : {})}
                  className="flex min-w-0 items-center gap-aire-xs border border-hueso/25 bg-negro/50 px-aire-s py-2 font-mono text-body-s text-hueso no-underline backdrop-blur-sm transition-colors duration-fade ease-camino hover:border-acento hover:text-acento"
                >
                  <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="currentColor" aria-hidden>
                    {canal.icono}
                  </svg>
                  <span className="truncate">{comoSeLee(canal.clave, dato)}</span>
                  <span className="sr-only">— {canal.nombre}</span>
                </a>
              </li>
            )
          })}
          {contactos.length === 0 && (
            <li className="font-mono text-body-s text-hueso/50">Sin contacto publicado</li>
          )}
        </ul>
      </div>
    </article>
  )
}
