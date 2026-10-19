import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Heart } from '@phosphor-icons/react'
import { cn, useReducedMotion } from '@elcamino/ui/static'
import { useSeo } from '../../lib/seo'
import { CopiarBoton } from './copiar-boton'
import { cciConEspacios, DATOS_DE_DONACION, medioDisponible, type Metodo } from './datos'
import { useContextoDeDonacion, type Idioma } from './contexto'
import { TEXTOS, type Paso, type Textos } from './textos'

/** Curva del sistema (DESIGN.md §5): ease-out puro, sin rebote. */
const EASE = [0.22, 0.61, 0.36, 1] as const

const IDIOMAS: Idioma[] = ['es', 'en', 'pt']

/**
 * Donación: una página, un propósito. Quien llega ya decidió mirar, así que no
 * se le convence de nada: se le dice con claridad que es voluntario, que no es
 * requisito y para qué sirve, y se le da el paso a paso del medio que le toca.
 *
 * El medio se sugiere por región (Yape en Perú, transferencia fuera) pero se
 * puede cambiar: alguien en Perú puede preferir su banco, y un peruano en el
 * extranjero sigue usando Yape.
 */
export function DonacionPage() {
  const { idioma, metodo, sugerido, elegirIdioma, elegirMetodo } = useContextoDeDonacion()
  const t = TEXTOS[idioma]
  const reducido = useReducedMotion()

  useSeo({
    titulo: t.pagina.seoTitulo,
    descripcion: t.pagina.seoDescripcion,
    ruta: '/donacion',
  })

  const disponible = medioDisponible(metodo)
  const pasos = metodo === 'yape' ? t.pasos.yape : t.pasos.cci

  return (
    <section lang={idioma} className="mx-auto flex w-full max-w-5xl flex-col gap-aire-l">
      <div className="flex justify-end">
        <SelectorDeIdioma actual={idioma} etiqueta={t.selector.idioma} onElegir={elegirIdioma} />
      </div>

      <div className="grid items-start gap-aire-l min-[1180px]:grid-cols-[1.05fr_0.95fr]">
        <header className="flex flex-col gap-aire-m">
          <div className="flex flex-col gap-aire-s">
            <Heart size={28} weight="fill" aria-hidden className="text-acento" />
            <h1 className="m-0 max-w-[16ch] text-balance font-ui text-h-xl font-medium leading-[1.1] tracking-titulo text-contenido">
              {t.pagina.titulo}
            </h1>
            <p className="m-0 max-w-[58ch] font-ui text-body-l leading-relaxed text-texto-tenue">
              {t.pagina.intro}
            </p>
          </div>

          <dl className="m-0 flex flex-col gap-aire-s">
            {t.pagina.compromisos.map((c) => (
              <div key={c.titulo} className="flex flex-col gap-1">
                <dt className="font-ui text-body font-medium text-contenido">{c.titulo}</dt>
                <dd className="m-0 max-w-[52ch] font-ui text-body-s leading-relaxed text-texto-tenue">
                  {c.texto}
                </dd>
              </div>
            ))}
          </dl>
        </header>

        <div className="flex flex-col gap-aire-s rounded border border-linea bg-superficie-1 p-aire-m">
          <SelectorDeMedio
            metodo={metodo}
            t={t}
            onElegir={elegirMetodo}
          />
          <p className="m-0 min-h-[2.6em] font-ui text-body-s leading-snug text-texto-tenue">
            {sugerido ? (metodo === 'yape' ? t.selector.sugeridoYape : t.selector.sugeridoCci) : ''}
          </p>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={metodo}
              initial={{ opacity: 0, y: reducido ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reducido ? 0 : -4 }}
              transition={{ duration: reducido ? 0.01 : 0.2, ease: EASE }}
            >
              {metodo === 'yape' ? <PanelYape t={t} /> : <PanelCci t={t} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {disponible && (
        <section aria-labelledby="pasos-titulo" className="flex flex-col gap-aire-m">
          <h2
            id="pasos-titulo"
            className="m-0 font-ui text-h-l font-medium tracking-titulo text-contenido"
          >
            {t.pasos.titulo}
          </h2>
          <AnimatePresence mode="wait" initial={false}>
            <motion.ol
              key={metodo}
              initial="oculto"
              animate="visible"
              exit={{ opacity: 0, transition: { duration: reducido ? 0.01 : 0.12 } }}
              variants={{ oculto: {}, visible: { transition: { staggerChildren: reducido ? 0 : 0.05 } } }}
              className="m-0 flex max-w-2xl list-none flex-col gap-aire-m p-0"
            >
              {pasos.map((paso, i) => (
                <PasoDeLista key={paso.titulo} numero={i + 1} paso={paso} reducido={reducido} />
              ))}
            </motion.ol>
          </AnimatePresence>
        </section>
      )}

      <p className="m-0 max-w-[52ch] font-ui text-body text-texto-tenue">{t.pagina.agradecimiento}</p>
    </section>
  )
}

function PasoDeLista({ numero, paso, reducido }: { numero: number; paso: Paso; reducido: boolean }) {
  return (
    <motion.li
      variants={{
        oculto: { opacity: 0, y: reducido ? 0 : 10 },
        visible: { opacity: 1, y: 0, transition: { duration: reducido ? 0.01 : 0.28, ease: EASE } },
      }}
      className="grid grid-cols-[2.75rem_1fr] items-baseline gap-aire-xs"
    >
      <span
        aria-hidden
        className="font-mono text-h-m tabular-nums leading-none text-acento"
      >
        {String(numero).padStart(2, '0')}
      </span>
      <div className="flex flex-col gap-1">
        <h3 className="m-0 font-ui text-body-l font-medium text-contenido">{paso.titulo}</h3>
        <p className="m-0 max-w-[60ch] font-ui text-body leading-relaxed text-texto-tenue">
          {paso.detalle}
        </p>
      </div>
    </motion.li>
  )
}

function SelectorDeMedio({
  metodo,
  t,
  onElegir,
}: {
  metodo: Metodo
  t: Textos
  onElegir: (m: Metodo) => void
}) {
  const opciones: { id: Metodo; etiqueta: string }[] = [
    { id: 'yape', etiqueta: t.selector.yape },
    { id: 'cci', etiqueta: t.selector.cci },
  ]
  return (
    <div
      role="group"
      aria-label={t.selector.etiqueta}
      className="inline-flex self-start rounded-full border border-linea p-1"
    >
      {opciones.map((o) => {
        const activo = o.id === metodo
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={activo}
            onClick={() => onElegir(o.id)}
            className={cn(
              'rounded-full px-[1.1rem] py-[0.5rem] font-ui text-body-s font-medium',
              'transition-[color,background-color] duration-fade-corto ease-camino',
              activo
                ? 'bg-oro text-sobreoro'
                : 'text-texto-tenue hover:text-contenido',
            )}
          >
            {o.etiqueta}
          </button>
        )
      })}
    </div>
  )
}

function SelectorDeIdioma({
  actual,
  etiqueta,
  onElegir,
}: {
  actual: Idioma
  etiqueta: string
  onElegir: (i: Idioma) => void
}) {
  return (
    <div role="group" aria-label={etiqueta} className="flex items-center gap-aire-xs">
      {IDIOMAS.map((id) => (
        <button
          key={id}
          type="button"
          lang={id}
          aria-pressed={id === actual}
          onClick={() => onElegir(id)}
          className={cn(
            'font-ui text-body-s transition-colors duration-fade-corto ease-camino',
            'underline-offset-[0.45em]',
            id === actual
              ? 'text-contenido underline decoration-acento'
              : 'text-texto-tenue hover:text-contenido',
          )}
        >
          {TEXTOS[id].nombre}
        </button>
      ))}
    </div>
  )
}

function PanelYape({ t }: { t: Textos }) {
  const [fallo, setFallo] = useState(false)
  if (!medioDisponible('yape') || fallo) {
    return <p className="m-0 font-ui text-body text-texto-tenue">{t.panel.yapeSinImagen}</p>
  }
  return (
    <figure className="m-0 flex flex-col items-center gap-aire-s sm:items-start">
      {/* El QR va sobre papel claro: sin margen blanco los lectores no lo leen. */}
      <div className="rounded bg-hueso p-3">
        <img
          src={DATOS_DE_DONACION.yapeQr}
          alt={t.panel.yapeAlt}
          width={224}
          height={224}
          onError={() => setFallo(true)}
          className="block h-56 w-56 object-contain"
        />
      </div>
      <figcaption className="font-ui text-body-s text-texto-tenue">{t.panel.yapeLeyenda}</figcaption>
    </figure>
  )
}

function PanelCci({ t }: { t: Textos }) {
  if (!medioDisponible('cci')) {
    return <p className="m-0 font-ui text-body text-texto-tenue">{t.panel.cciSinNumero}</p>
  }
  const filas = [
    { etiqueta: t.panel.banco, valor: DATOS_DE_DONACION.banco },
    { etiqueta: t.panel.titular, valor: DATOS_DE_DONACION.titular },
  ]
  return (
    <dl className="m-0 flex flex-col gap-aire-s">
      {filas.map((f) => (
        <div key={f.etiqueta} className="flex flex-col gap-1">
          <dt className="font-ui text-body-s text-texto-tenue">{f.etiqueta}</dt>
          <dd className="m-0 font-ui text-body-l text-contenido">{f.valor}</dd>
        </div>
      ))}
      <div className="flex flex-col gap-2">
        <dt className="font-ui text-body-s text-texto-tenue">{t.panel.cci}</dt>
        <dd className="m-0 flex flex-wrap items-center gap-aire-xs">
          <span className="font-mono text-h-s tabular-nums tracking-wide text-contenido [overflow-wrap:anywhere]">
            {cciConEspacios(DATOS_DE_DONACION.cci)}
          </span>
          <CopiarBoton
            valor={DATOS_DE_DONACION.cci}
            etiqueta={t.panel.copiar}
            etiquetaCopiado={t.panel.copiado}
          />
        </dd>
      </div>
    </dl>
  )
}
