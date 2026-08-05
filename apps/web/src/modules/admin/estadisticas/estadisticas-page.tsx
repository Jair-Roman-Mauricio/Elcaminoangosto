import { useState } from 'react'
import { Chip, Eyebrow, Field, Input, Select } from '@elcamino/ui'
import {
  useMasVistos,
  useAlbumesMasEscuchados,
  useFlujoDeVisitantes,
  type ContenidoMasVisto,
  type OrdenDeRanking,
} from './estadisticas-api'

const SOMBRA = 'shadow-[0_0.9rem_2.2rem_-0.5rem_rgba(20,17,15,0.22)]'

const PERIODOS = [
  { dias: 7, label: '7 días' },
  { dias: 30, label: '30 días' },
  { dias: 90, label: '90 días' },
  { dias: 365, label: 'Un año' },
]

const FORMATO_FECHA = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short' })

/** Lo que cada sección controla por su cuenta. */
interface Filtro {
  busqueda: string
  orden: OrdenDeRanking
}

const FILTRO_INICIAL: Filtro = { busqueda: '', orden: 'vistas' }

/**
 * Cabecera de una sección: título a la izquierda y sus herramientas a la
 * derecha, en una sola línea.
 *
 * Los controles NO usan `Field`: su etiqueta encima creaba una segunda altura
 * que descuadraba la fila y dejaba el buscador flotando sobre el título. Aquí
 * el nombre va en `aria-label`, que un lector de pantalla anuncia igual.
 *
 * Tampoco se les fuerza altura ni relleno: el control del sistema ya trae su
 * métrica, y recortarla partía el texto del desplegable por la mitad. Lo único
 * que se ajusta es el ancho.
 */
function CabeceraDeSeccion({
  titulo,
  id,
  placeholder,
  filtro,
  onFiltro,
  sinOrden = false,
}: {
  titulo: string
  id: string
  placeholder: string
  filtro: Filtro
  onFiltro: (filtro: Filtro) => void
  sinOrden?: boolean
}) {
  return (
    <header className="flex flex-col gap-aire-xs border-b border-linea pb-aire-xs sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <h2 className="m-0 font-mono text-h-s font-normal text-contenido">{titulo}</h2>

      {/* En móvil las herramientas ocupan el ancho bajo el título; a partir de
          `sm` acompañan al título en la misma línea. `min-w-0` es lo que les
          permite encoger dentro del flex en vez de desbordar la tarjeta. */}
      <div className="flex w-full min-w-0 flex-wrap items-center gap-aire-xs sm:w-auto sm:flex-1 sm:justify-end">
        <Input
          id={`buscar-${id}`}
          type="search"
          aria-label={`Buscar en ${titulo.toLowerCase()}`}
          value={filtro.busqueda}
          onChange={(e) => onFiltro({ ...filtro, busqueda: e.target.value })}
          placeholder={placeholder}
          className="w-full min-w-0 sm:max-w-[16rem]"
        />
        {!sinOrden && (
          <Select
            id={`orden-${id}`}
            aria-label={`Ordenar ${titulo.toLowerCase()}`}
            value={filtro.orden}
            onChange={(e) => onFiltro({ ...filtro, orden: e.target.value as OrdenDeRanking })}
            className="w-full sm:w-auto"
          >
            <option value="vistas">Reproducciones</option>
            <option value="visitantes">Sesiones</option>
          </Select>
        )}
      </div>
    </header>
  )
}

/**
 * Estadísticas de contenido y visitas (solo ADMIN).
 *
 * Todo se mide con un identificador aleatorio por sesión de navegador, así que
 * «visitantes» son SESIONES distintas, no personas: no se guarda IP ni huella
 * (RNF-9). Quien vuelve mañana cuenta como una sesión nueva, y por eso la
 * pantalla no dice «personas» en ningún sitio.
 *
 * El tráfico de la propia administración no entra en ningún número: hoy es la
 * única cuenta que existe, y revisar tu plataforma no es una visita.
 */
export function EstadisticasPage() {
  const [dias, setDias] = useState(30)
  // Cada sección busca y ordena por su cuenta: mirar los videos no debería
  // reordenar las canciones.
  const [videosFiltro, setVideosFiltro] = useState<Filtro>(FILTRO_INICIAL)
  const [tarjetasFiltro, setTarjetasFiltro] = useState<Filtro>(FILTRO_INICIAL)
  const [cancionesFiltro, setCancionesFiltro] = useState<Filtro>(FILTRO_INICIAL)
  const [lecturasFiltro, setLecturasFiltro] = useState<Filtro>(FILTRO_INICIAL)
  const [oracionesFiltro, setOracionesFiltro] = useState<Filtro>(FILTRO_INICIAL)
  const [albumesBusqueda, setAlbumesBusqueda] = useState('')

  const videos = useMasVistos('VIDEO', dias, videosFiltro.busqueda, videosFiltro.orden)
  const tarjetas = useMasVistos('POST', dias, tarjetasFiltro.busqueda, tarjetasFiltro.orden)
  const canciones = useMasVistos('SONG', dias, cancionesFiltro.busqueda, cancionesFiltro.orden)
  // Un solo ranking para devocionales y revista: son la misma tabla y la
  // columna de contexto ya dice de cuál de las dos secciones viene cada uno.
  const lecturas = useMasVistos('LECTURA', dias, lecturasFiltro.busqueda, lecturasFiltro.orden)
  const oraciones = useMasVistos('ORACION', dias, oracionesFiltro.busqueda, oracionesFiltro.orden)
  const albumes = useAlbumesMasEscuchados(dias, albumesBusqueda)
  const visitantes = useFlujoDeVisitantes(dias)

  const flujo = visitantes.data

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-aire-m py-aire-m">
      <header className="flex flex-wrap items-end justify-between gap-aire-s">
        <div className="flex flex-col gap-aire-xs">
          <Eyebrow>Administración</Eyebrow>
          <h1 className="m-0 font-mono text-h-l font-normal text-contenido">Estadísticas</h1>
          <p className="m-0 font-mono text-body-s text-texto-tenue">
            Qué se ve, qué se escucha y cuánta gente entra. Sin tu propio tráfico.
          </p>
        </div>
        <Field label="Periodo" htmlFor="periodo">
          <Select id="periodo" value={dias} onChange={(e) => setDias(Number(e.target.value))}>
            {PERIODOS.map((p) => (
              <option key={p.dias} value={p.dias}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>
      </header>

      {/* ── Visitantes ─────────────────────────────────────────────────── */}
      <section className={`flex flex-col gap-aire-s bg-superficie-1 p-aire-m ${SOMBRA}`}>
        <h2 className="m-0 font-mono text-h-s font-normal text-contenido">Quién entra</h2>
        {/* Tres números, ninguno derivado ni estimado: una sesión distinta, una
            entrada a sección y una pieza abierta son tres filas contadas en la
            base. Antes había un «se registraron» que hoy sería siempre cero. */}
        <div className="grid gap-aire-s sm:grid-cols-3">
          <Dato
            valor={flujo?.visitantes}
            label="Visitantes"
            nota="Sesiones distintas de navegador"
          />
          <Dato
            valor={flujo?.visitas}
            label="Visitas"
            nota="Entradas a una sección; quien recorre cuatro cuenta cuatro"
          />
          <Dato
            valor={flujo?.vistasDeContenido}
            label="Piezas abiertas"
            nota="Todo lo que alguien abrió: videos, tarjetas, canciones, lecturas y oraciones"
          />
        </div>

        {flujo && flujo.porSeccion.length > 0 && (
          <div className="flex flex-col gap-aire-xs">
            <h3 className="m-0 font-mono text-eyebrow uppercase tracking-label text-texto-tenue">
              Por sección
            </h3>
            <ul className="m-0 flex list-none flex-col gap-aire-xs p-0">
              {flujo.porSeccion.map((s) => (
                <li key={s.seccion} className="flex flex-wrap items-center gap-x-aire-s gap-y-[0.2rem]">
                  <span className="min-w-0 flex-1 truncate font-mono text-body-s text-contenido">
                    {s.seccion}
                  </span>
                  <Barra valor={s.visitas} maximo={flujo.porSeccion[0]?.visitas ?? 1} />
                  <span className="shrink-0 whitespace-nowrap text-right font-mono text-eyebrow text-texto-tenue sm:w-28">
                    {s.visitas} · {s.visitantes} ses.
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {flujo && flujo.porDia.length > 0 && (
          <div className="flex flex-col gap-aire-xs">
            <h3 className="m-0 font-mono text-eyebrow uppercase tracking-label text-texto-tenue">
              Día a día
            </h3>
            <ul className="m-0 flex list-none flex-wrap gap-aire-xs p-0">
              {flujo.porDia.map((d) => (
                <li
                  key={d.dia}
                  className="flex flex-col gap-[0.15rem] border-l-2 border-linea pl-aire-xs"
                  title={`${d.visitantes} sesiones · ${d.visitas} visitas`}
                >
                  <span className="font-mono text-eyebrow text-texto-debil">
                    {FORMATO_FECHA.format(new Date(`${d.dia}T00:00:00`))}
                  </span>
                  <span className="font-mono text-body-s text-contenido">{d.visitantes}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {visitantes.isPending && <Cargando />}
      </section>

      {/* ── Videos ─────────────────────────────────────────────────────── */}
      <section className={`flex flex-col gap-aire-s bg-superficie-1 p-aire-m ${SOMBRA}`}>
        <CabeceraDeSeccion
          titulo="Videos más vistos"
          id="videos"
          placeholder="Buscar por título"
          filtro={videosFiltro}
          onFiltro={setVideosFiltro}
        />
        <Ranking datos={videos.data} cargando={videos.isPending} unidad="vistas" />
      </section>

      {/* ── Tarjetas ───────────────────────────────────────────────────── */}
      <section className={`flex flex-col gap-aire-s bg-superficie-1 p-aire-m ${SOMBRA}`}>
        <CabeceraDeSeccion
          titulo="Tarjetas más vistas"
          id="tarjetas"
          placeholder="Buscar por título o texto"
          filtro={tarjetasFiltro}
          onFiltro={setTarjetasFiltro}
        />
        <Ranking datos={tarjetas.data} cargando={tarjetas.isPending} unidad="vistas" />
      </section>

      {/* ── Devocionales y revista ─────────────────────────────────────── */}
      <section className={`flex flex-col gap-aire-s bg-superficie-1 p-aire-m ${SOMBRA}`}>
        <CabeceraDeSeccion
          titulo="Lecturas más abiertas"
          id="lecturas"
          placeholder="Buscar por título"
          filtro={lecturasFiltro}
          onFiltro={setLecturasFiltro}
        />
        <Ranking datos={lecturas.data} cargando={lecturas.isPending} unidad="lecturas" />
      </section>

      {/* ── Oraciones guiadas ──────────────────────────────────────────── */}
      <section className={`flex flex-col gap-aire-s bg-superficie-1 p-aire-m ${SOMBRA}`}>
        <CabeceraDeSeccion
          titulo="Oraciones más rezadas"
          id="oraciones"
          placeholder="Buscar por título"
          filtro={oracionesFiltro}
          onFiltro={setOracionesFiltro}
        />
        <Ranking datos={oraciones.data} cargando={oraciones.isPending} unidad="veces" />
      </section>

      {/* ── Canciones y álbumes ────────────────────────────────────────── */}
      <div className="grid gap-aire-m md:grid-cols-2">
        <section className={`flex flex-col gap-aire-s bg-superficie-1 p-aire-m ${SOMBRA}`}>
          <CabeceraDeSeccion
            titulo="Canciones más escuchadas"
            id="canciones"
            placeholder="Buscar por título"
            filtro={cancionesFiltro}
            onFiltro={setCancionesFiltro}
          />
          <Ranking datos={canciones.data} cargando={canciones.isPending} unidad="escuchas" />
        </section>

        <section className={`flex flex-col gap-aire-s bg-superficie-1 p-aire-m ${SOMBRA}`}>
          <CabeceraDeSeccion
            titulo="Álbumes más escuchados"
            id="albumes"
            placeholder="Buscar por álbum"
            filtro={{ busqueda: albumesBusqueda, orden: 'vistas' }}
            onFiltro={(f) => setAlbumesBusqueda(f.busqueda)}
            /* Un álbum solo se ordena por escuchas: no hay «personas» que
               contar sin duplicar a quien oye varias canciones suyas. */
            sinOrden
          />
          {albumes.isPending && <Cargando />}
          {albumes.data?.length === 0 && <SinDatos />}
          <ul className="m-0 flex list-none flex-col gap-aire-xs p-0">
            {(albumes.data ?? []).map((a, i) => (
              <li key={a.albumId} className="flex flex-wrap items-center gap-x-aire-s gap-y-[0.2rem]">
                <span className="w-6 shrink-0 font-mono text-eyebrow text-texto-debil">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-body-s text-contenido">
                  {a.numero ? `${a.numero} · ` : ''}
                  {a.titulo}
                </span>
                <Chip tamano="mini" className="hidden sm:inline-flex">
                  {a.canciones} canción(es)
                </Chip>
                <span className="ml-auto shrink-0 text-right font-mono text-body-s text-contenido sm:w-20">
                  {a.escuchas}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}

function Ranking({
  datos,
  cargando,
  unidad,
}: {
  datos: ContenidoMasVisto[] | undefined
  cargando: boolean
  unidad: string
}) {
  if (cargando) return <Cargando />
  if (!datos || datos.length === 0) return <SinDatos />

  const maximo = datos[0]?.vistas ?? 1

  return (
    <ul className="m-0 flex list-none flex-col gap-aire-xs p-0">
      {datos.map((d, i) => (
        <li key={d.contentId} className="flex flex-wrap items-center gap-x-aire-s gap-y-[0.2rem]">
          <span className="w-6 shrink-0 font-mono text-eyebrow text-texto-debil">
            {String(i + 1).padStart(2, '0')}
          </span>
          <span className="min-w-0 flex-1 basis-40">
            <span className="block truncate font-mono text-body-s text-contenido">{d.titulo}</span>
            {d.contexto && (
              <span className="block truncate font-ui text-eyebrow text-texto-tenue">
                {d.contexto}
              </span>
            )}
          </span>
          <Barra valor={d.vistas} maximo={maximo} />
          {/* En móvil el recuento cae a la línea siguiente en vez de empujar
              la fila fuera de la tarjeta. */}
          <span
            className="ml-auto shrink-0 whitespace-nowrap text-right font-mono text-eyebrow text-texto-tenue sm:w-36"
            title={`${d.visitantes} sesiones distintas`}
          >
            {d.vistas} {unidad} · {d.visitantes} ses.
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Barra proporcional al primero del ranking: compara de un vistazo. */
function Barra({ valor, maximo }: { valor: number; maximo: number }) {
  const porcentaje = maximo > 0 ? Math.max(4, Math.round((valor / maximo) * 100)) : 0
  return (
    <span
      aria-hidden="true"
      className="hidden h-1.5 w-32 shrink-0 overflow-hidden rounded-full bg-superficie-2 sm:block"
    >
      <span className="block h-full rounded-full bg-oro" style={{ width: `${porcentaje}%` }} />
    </span>
  )
}

function Dato({ valor, label, nota }: { valor: number | undefined; label: string; nota: string }) {
  return (
    <div className="flex flex-col gap-[0.2rem] border-l-2 border-linea pl-aire-s">
      <span className="font-mono text-h-m text-contenido">{valor ?? '—'}</span>
      <span className="font-mono text-eyebrow uppercase tracking-label text-contenido">{label}</span>
      <span className="font-ui text-eyebrow text-texto-tenue">{nota}</span>
    </div>
  )
}

const Cargando = () => (
  <p className="m-0 font-ui text-body-s text-texto-tenue">Cargando…</p>
)

const SinDatos = () => (
  <p className="m-0 font-ui text-body-s text-texto-tenue">
    Todavía no hay datos en este periodo.
  </p>
)
