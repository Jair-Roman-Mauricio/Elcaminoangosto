import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Boton, Eyebrow, Field, Textarea } from '@elcamino/ui'
import {
  useComentarLectura,
  useComentariosDeLectura,
  useLectura,
  useRevista,
} from './lecturas-api'
import { LectorEditorial } from './lector-editorial'
import { TarjetaDeLectura } from './tarjeta-de-lectura'
import { useRegistrarVisita } from '../../lib/analitica'
import type { Lectura } from './lecturas-api'

const fechaCorta = new Intl.DateTimeFormat('es-PE', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

/**
 * Revista: artículos largos, con conversación debajo.
 *
 * La portada usa una rejilla desigual —una pieza grande y el resto menores— en
 * lugar de una cuadrícula uniforme. Es la diferencia entre una portada, donde
 * alguien decidió qué es lo importante de este número, y un archivo, donde
 * todo pesa lo mismo y nada llama.
 */
export function RevistaPage() {
  useRegistrarVisita('revista')
  const { articuloId } = useParams()
  const navegar = useNavigate()
  const { data, isPending, isError } = useRevista()
  // Cada artículo vive en su propia dirección, así que el índice no guarda cuál
  // está abierto: lo dice la URL, y por eso el enlace se puede compartir.
  const abierto = useLectura(articuloId ?? null)

  const abrir = (id: string) => navegar(`/revista/${id}`)

  if (articuloId) {
    if (abierto.isError) {
      return (
        <p className="m-0 font-ui text-body text-peligro">Ese artículo ya no está disponible.</p>
      )
    }
    if (!abierto.data) {
      return <p className="m-0 font-ui text-body text-texto-tenue">Cargando…</p>
    }
    return (
      <LectorEditorial lectura={abierto.data} onVolver={() => navegar('/revista')}>
        <Conversacion lecturaId={abierto.data.id} />
      </LectorEditorial>
    )
  }

  const lista = data ?? []
  // La portada reparte por peso, no por fecha: una pieza de apertura, cuatro
  // que la acompañan y el resto agrupado por sección.
  const apertura = lista[0]
  const acompanan = lista.slice(1, 5)
  const resto = lista.slice(5)

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-aire-l">
      <header className="flex flex-col gap-aire-xs">
        <Eyebrow>Revista</Eyebrow>
        <h1 className="m-0 font-ui text-h-l font-medium tracking-titulo text-contenido">
          Para leer con calma
        </h1>
        <p className="m-0 max-w-prose font-ui text-body text-texto-tenue">
          Temas que no caben en un párrafo. Al final de cada artículo puedes decir lo tuyo.
        </p>
      </header>

      {isError && (
        <p className="m-0 font-ui text-body text-peligro">No se pudo cargar la revista.</p>
      )}
      {isPending && <p className="m-0 font-ui text-body text-texto-tenue">Cargando…</p>}
      {!isPending && !isError && lista.length === 0 && (
        <p className="m-0 font-ui text-body text-texto-tenue">
          Todavía no hay artículos publicados.
        </p>
      )}

      {/* El mosaico de apertura: la pieza grande a la izquierda y las que la
          acompañan a la derecha, pegadas entre sí. La separación fina es lo que
          hace que se lea como una portada y no como tarjetas sueltas. */}
      {apertura && (
        <section className="grid gap-[2px] md:grid-cols-2">
          <TarjetaDeLectura lectura={apertura} onAbrir={() => abrir(apertura.id)} tamano="grande" />
          {acompanan.length > 0 && (
            <div className="grid gap-[2px] sm:grid-cols-2">
              {acompanan.map((lectura) => (
                <TarjetaDeLectura
                  key={lectura.id}
                  lectura={lectura}
                  onAbrir={() => abrir(lectura.id)}
                  tamano="media"
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Las secciones van en columnas, una al lado de otra. Apiladas en filas
          de cuatro, una sección con un solo artículo dejaba tres huecos y la
          portada se venía abajo. */}
      {resto.length > 0 && (
        <div className="grid gap-aire-m sm:grid-cols-2 md:grid-cols-3">
          {agruparPorSeccion(resto).map(([seccion, articulos]) => (
            <section key={seccion} className="flex flex-col gap-aire-s">
              <TituloDeSeccion>{seccion}</TituloDeSeccion>
              <div className="flex flex-col gap-[2px]">
                {articulos.map((lectura) => (
                  <TarjetaDeLectura
                    key={lectura.id}
                    lectura={lectura}
                    onAbrir={() => abrir(lectura.id)}
                    tamano="media"
                    // La sección ya la dice el encabezado de la columna.
                    conEtiqueta={false}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Encabezado de sección: una línea que cruza y la etiqueta al final.
 *
 * Marca dónde empieza cada bloque sin robarle peso a los titulares, que es lo
 * que tiene que llamar en una portada.
 */
function TituloDeSeccion({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-aire-xs">
      <span aria-hidden className="h-px flex-1 bg-linea" />
      <h2 className="m-0 bg-oro px-aire-xs py-[0.15rem] font-mono text-[0.62rem] uppercase tracking-label text-sobreoro">
        {children}
      </h2>
    </div>
  )
}

/**
 * Reparte los artículos en bloques por sección, en el orden en que aparecen.
 *
 * Lo que no lleva sección va junto al final: es contenido bueno que todavía no
 * tiene casa, y esconderlo sería peor que agruparlo.
 */
function agruparPorSeccion(articulos: Lectura[]): [string, Lectura[]][] {
  const bloques = new Map<string, Lectura[]>()
  for (const articulo of articulos) {
    const clave = articulo.seccion ?? 'Más lecturas'
    bloques.set(clave, [...(bloques.get(clave) ?? []), articulo])
  }
  return [...bloques.entries()]
}

/**
 * Lo que se dice bajo un artículo.
 *
 * Sin cuentas: cada quien lleva un alias dentro de este artículo y nada más,
 * igual que en la comunidad.
 */
function Conversacion({ lecturaId }: { lecturaId: string }) {
  const comentarios = useComentariosDeLectura(lecturaId)
  const comentar = useComentarLectura(lecturaId)
  const [texto, setTexto] = useState('')

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault()
    if (!texto.trim()) return
    try {
      await comentar.mutateAsync(texto.trim())
      setTexto('')
    } catch {
      // El aviso del formulario ya lo cuenta.
    }
  }

  const lista = comentarios.data ?? []

  return (
    <section className="flex max-w-[62ch] flex-col gap-aire-m border-t border-linea pt-aire-l">
      <h2 className="m-0 font-mono text-body-s uppercase tracking-label text-texto-tenue">
        {lista.length === 0
          ? 'Sé el primero en decir algo'
          : `${lista.length} ${lista.length === 1 ? 'comentario' : 'comentarios'}`}
      </h2>

      <form onSubmit={(e) => void enviar(e)} className="flex flex-col gap-aire-xs">
        <Field label="Tu comentario" htmlFor={`comentar-${lecturaId}`}>
          <Textarea
            id={`comentar-${lecturaId}`}
            rows={3}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escribe sin registrarte…"
            maxLength={1000}
          />
        </Field>
        {comentar.isError && (
          <p role="alert" className="m-0 font-ui text-body-s text-peligro">
            No se pudo publicar. Inténtalo de nuevo en un momento.
          </p>
        )}
        <Boton
          variante="pastilla"
          tamano="compacto"
          type="submit"
          className="self-start text-body-s"
          disabled={comentar.isPending || texto.trim().length < 2}
        >
          {comentar.isPending ? 'Enviando…' : 'Publicar'}
        </Boton>
      </form>

      <ul className="m-0 flex list-none flex-col gap-aire-m p-0">
        {lista.map((comentario) => (
          <li key={comentario.id} className="flex flex-col gap-aire-xs border-l-2 border-acento pl-aire-m">
            <p className="m-0 font-mono text-body-s uppercase tracking-label text-texto-tenue">
              {comentario.autor} · {fechaCorta.format(new Date(comentario.createdAt))}
            </p>
            <p className="m-0 whitespace-pre-wrap font-ui text-body leading-relaxed text-contenido">
              {comentario.mensaje}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
