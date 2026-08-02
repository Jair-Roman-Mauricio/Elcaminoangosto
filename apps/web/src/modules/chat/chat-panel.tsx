import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react'
import { useSession } from '../../auth/session'
import {
  useContactos,
  useAdministradores,
  useConversaciones,
  useAbrirConversacion,
  useMensajes,
  useEnviarMensaje,
} from './chat-api'
import { useRealtimeChat } from './use-realtime-chat'
import './mentor-chat.css'

interface Interlocutor {
  id: string
  nombre: string
  rol: 'ESTUDIANTE' | 'MAESTRO' | 'ADMIN'
  preview: string
  unread: number
  hora: string
  /** Epoch del último mensaje (0 si aún no hay), para ordenar el directorio. */
  ts: number
}

const PALETA = ['#b41e44', '#1b3460', '#2e7d5b', '#c9862b', '#6d4c9f', '#0f766e']

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/)
  return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase() || '·'
}
function colorDe(id: string): string {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return PALETA[h % PALETA.length]!
}
function horaDe(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Chat mentor–estudiante con el aspecto de directorio + conversación.
 * «Tiempo real» por sondeo (React Query). Compartido por alumno y profesor.
 */
export function ChatPanel({ etiqueta }: { etiqueta: 'mentores' | 'estudiantes' | 'administradores' | 'profesores' }) {
  const { session } = useSession()
  const yo = session?.user.id ?? ''

  useRealtimeChat() // push en tiempo real; el sondeo queda solo de respaldo

  const esAdministradores = etiqueta === 'administradores'
  const { data: contactos } = useContactos(!esAdministradores && etiqueta !== 'profesores')
  const { data: administradores } = useAdministradores(esAdministradores)
  const { data: conversaciones } = useConversaciones()
  const abrir = useAbrirConversacion()

  const [activoId, setActivoId] = useState<string | null>(null)
  const [activo, setActivo] = useState<Interlocutor | null>(null)
  const [busqueda, setBusqueda] = useState('')

  // El estudiante ve el directorio completo de mentores (puede consultar a
  // cualquiera). El maestro solo ve a los estudiantes con los que YA conversó
  // (sus conversaciones existentes), nunca la lista completa ni otros maestros.
  const esEstudiante = etiqueta === 'mentores'
  const esMaestro = etiqueta === 'estudiantes'
  const rolDelOtro = esEstudiante || etiqueta === 'profesores'
    ? 'MAESTRO'
    : esAdministradores
      ? 'ADMIN'
      : 'ESTUDIANTE'
  const ordenar = (lista: Interlocutor[]) =>
    // Con mensajes primero (más recientes arriba); el resto, alfabético al final.
    [...lista].sort((a, b) => b.ts - a.ts || a.nombre.localeCompare(b.nombre))

  const directorio = useMemo<Interlocutor[]>(() => {
    const convs = (conversaciones ?? []).filter((c) => c.otherRole === rolDelOtro)
    const convPorOtro = new Map(convs.map((c) => [c.otherId, c]))
    const deConv = (c: (typeof convs)[number]): Interlocutor => ({
      id: c.otherId,
      nombre: c.otherName,
      rol: c.otherRole as Interlocutor['rol'],
      preview: c.lastMessage ?? 'Sin mensajes todavía',
      unread: c.unread,
      hora: horaDe(c.lastMessageAt),
      ts: c.lastMessageAt ? Date.parse(c.lastMessageAt) : 0,
    })

    // Administración recibe solo incidencias que un profesor ya abrió. No se
    // expone el directorio de profesores ni sus datos de perfil fuera del chat.
    if (esMaestro || (!esEstudiante && !esAdministradores)) return ordenar(convs.map(deConv))

    // Módulo aislado de profesor ↔ administración. Todos los administradores
    // aparecen aquí, enriquecidos con su conversación si ya existe.
    if (esAdministradores) {
      const admins = (administradores ?? [])
        .map((c) => {
          const conv = convPorOtro.get(c.id)
          return conv
            ? { ...deConv(conv), nombre: c.name, rol: 'ADMIN' as const }
            : { id: c.id, nombre: c.name, rol: 'ADMIN' as const, preview: 'Inicia una consulta', unread: 0, hora: '', ts: 0 }
        })
      const enBase = new Set(admins.map((admin) => admin.id))
      return ordenar([...admins, ...convs.filter((c) => !enBase.has(c.otherId)).map(deConv)])
    }

    // El estudiante parte de TODOS los mentores (query rápida) para que la lista
    // nunca dependa de que llegue la de conversaciones (la lenta); cada mentor se
    // enriquece con su conversación si existe.
    const base: Interlocutor[] = (contactos ?? []).map((c) => {
      const conv = convPorOtro.get(c.id)
      return conv
        ? { ...deConv(conv), nombre: c.name }
        : { id: c.id, nombre: c.name, rol: 'MAESTRO', preview: 'Inicia la conversación', unread: 0, hora: '', ts: 0 }
    })
    // Conversaciones con un mentor que ya no esté en la lista de contactos (raro).
    const enBase = new Set(base.map((b) => b.id))
    const extra = convs.filter((c) => !enBase.has(c.otherId)).map(deConv)
    return ordenar([...base, ...extra])
  }, [conversaciones, contactos, administradores, rolDelOtro, esEstudiante, esMaestro, esAdministradores])

  const filtrados = directorio.filter((d) =>
    d.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()),
  )

  const seleccionar = (interlocutor: Interlocutor) => {
    setActivo(interlocutor)
    abrir.mutate(interlocutor.id, { onSuccess: (r) => setActivoId(r.conversationId) })
  }

  // Indicador deslizante sobre el elemento activo.
  const listaRef = useRef<HTMLDivElement>(null)
  const [indicador, setIndicador] = useState({ top: 0, height: 0, visible: false })
  useLayoutEffect(() => {
    const cont = listaRef.current
    if (!cont || !activo) {
      setIndicador((i) => ({ ...i, visible: false }))
      return
    }
    const btn = cont.querySelector<HTMLButtonElement>('button.is-active')
    if (!btn) return
    setIndicador({ top: btn.offsetTop, height: btn.offsetHeight, visible: true })
  }, [activo, filtrados.length])

  const renderizarContacto = (d: Interlocutor) => (
    <button
      key={d.id}
      type="button"
      className={activo?.id === d.id ? 'is-active' : undefined}
      onClick={() => seleccionar(d)}
      aria-pressed={activo?.id === d.id}
    >
      <Avatar nombre={d.nombre} id={d.id} />
      <span className="mentor-chat__mentor-copy">
        <span>
          <strong>{d.nombre}</strong>
          <time>{d.hora}</time>
        </span>
        <span className="mentor-chat__preview">
          <span>{d.preview}</span>
          {d.unread > 0 ? <b aria-label={`${d.unread} mensajes sin leer`}>{d.unread}</b> : null}
        </span>
      </span>
    </button>
  )

  return (
    <section className="mentor-chat" aria-label="Chat">
      <div className="mentor-chat__conversation">
        {activo && activoId ? (
          <Conversacion key={activoId} conversationId={activoId} interlocutor={activo} yo={yo} />
        ) : (
          <div className="mentor-chat__messages">
            <p className="mentor-chat__empty">Elige una conversación para empezar a chatear.</p>
          </div>
        )}
      </div>

      <aside className="mentor-chat__directory" aria-label="Directorio">
        <header>
          <span>Acompañamiento</span>
          <h1>{etiqueta === 'mentores' ? 'Mentores' : etiqueta === 'profesores' ? 'Profesores' : esAdministradores ? 'Administradores' : 'Estudiantes'}</h1>
        </header>

        <label className="mentor-chat__search">
          <SearchIcon />
          <span className="sr-only">Buscar</span>
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder={`Buscar ${etiqueta === 'mentores' ? 'mentor' : etiqueta === 'profesores' ? 'profesor' : esAdministradores ? 'administrador' : 'estudiante'}…`}
          />
        </label>

        <div ref={listaRef} className="mentor-chat__mentor-list">
          <span
            className="mentor-chat__mentor-indicator"
            aria-hidden="true"
            style={
              {
                '--mentor-indicator-top': `${indicador.top}px`,
                '--mentor-indicator-left': '0px',
                '--mentor-indicator-width': '100%',
                '--mentor-indicator-height': `${indicador.height}px`,
                opacity: indicador.visible ? 1 : 0,
              } as CSSProperties
            }
          />
          {filtrados.map(renderizarContacto)}
          {filtrados.length === 0 && (
            <p className="mentor-chat__empty">
              {etiqueta === 'mentores'
                ? 'No hay mentores con ese nombre.'
                : etiqueta === 'profesores'
                  ? 'Aún no hay consultas de profesores.'
                  : 'Aún nadie te ha escrito.'}
            </p>
          )}
        </div>
      </aside>
    </section>
  )
}

function Conversacion({
  conversationId,
  interlocutor,
  yo,
}: {
  conversationId: string
  interlocutor: Interlocutor
  yo: string
}) {
  const { data: mensajes } = useMensajes(conversationId)
  const enviar = useEnviarMensaje(conversationId)
  const [borrador, setBorrador] = useState('')
  const finalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    finalRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes?.length])

  const mandar = (e: FormEvent) => {
    e.preventDefault()
    const texto = borrador.trim()
    if (!texto) return
    setBorrador('')
    enviar.mutate(texto)
  }

  return (
    <>
      <header className="mentor-chat__conversation-header">
        <Avatar nombre={interlocutor.nombre} id={interlocutor.id} />
        <div>
          <strong>{interlocutor.nombre}</strong>
          <span>Conversación</span>
        </div>
      </header>

      <div className="mentor-chat__messages" role="log" aria-live="polite">
        {(mensajes ?? []).map((m) => {
          const mio = m.senderId === yo
          return (
            <div key={m.id} className={`mentor-message${mio ? ' mentor-message--mine' : ''}`}>
              {!mio && <Avatar nombre={interlocutor.nombre} id={interlocutor.id} compact />}
              <div>
                <p>{m.body}</p>
                <time>{horaDe(m.createdAt)}</time>
              </div>
            </div>
          )
        })}
        {mensajes && mensajes.length === 0 && (
          <p className="mentor-chat__empty">Escribe el primer mensaje.</p>
        )}
        <div ref={finalRef} />
      </div>

      <form className="mentor-chat__composer" onSubmit={mandar}>
        <button type="button" aria-label="Adjuntar" title="Adjuntar (próximamente)">
          <AttachIcon />
        </button>
        <label>
          <span className="sr-only">Escribe un mensaje</span>
          <input
            value={borrador}
            onChange={(e) => setBorrador(e.target.value)}
            placeholder={`Escribe a ${interlocutor.nombre.split(' ')[0]}…`}
            autoComplete="off"
          />
        </label>
        <button
          type="submit"
          className="mentor-chat__send"
          disabled={!borrador.trim() || enviar.isPending}
          aria-label="Enviar mensaje"
        >
          <SendIcon />
        </button>
      </form>
    </>
  )
}

function Avatar({ nombre, id, compact = false }: { nombre: string; id: string; compact?: boolean }) {
  return (
    <span
      className={`mentor-avatar${compact ? ' mentor-avatar--compact' : ''}`}
      style={{ '--mentor-color': colorDe(id) } as CSSProperties}
      aria-hidden="true"
    >
      {iniciales(nombre)}
    </span>
  )
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
function AttachIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <path
        d="M20 11.5 12.5 19a4.5 4.5 0 0 1-6.4-6.4l7.9-7.9a3 3 0 0 1 4.3 4.3l-8 8a1.5 1.5 0 0 1-2.1-2.1l7-7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <path d="m4 4 17 8-17 8 3-8-3-8Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M7 12h14" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}
