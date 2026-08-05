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
import { TarjetaDeLectura } from './devocionales-page'
import { useRegistrarVisita } from '../../lib/analitica'

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

  const [principal, ...resto] = data ?? []

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-aire-m">
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
      {!isPending && !isError && (data?.length ?? 0) === 0 && (
        <p className="m-0 font-ui text-body text-texto-tenue">
          Todavía no hay artículos publicados.
        </p>
      )}

      {principal && (
        <TarjetaDeLectura lectura={principal} onAbrir={() => abrir(principal.id)} destacada />
      )}

      {resto.length > 0 && (
        <ul className="m-0 grid list-none grid-cols-1 gap-aire-m p-0 sm:grid-cols-2 lg:grid-cols-3">
          {resto.map((lectura) => (
            <li key={lectura.id}>
              <TarjetaDeLectura lectura={lectura} onAbrir={() => abrir(lectura.id)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
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
