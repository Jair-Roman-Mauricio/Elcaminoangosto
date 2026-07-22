import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import './mentor-chat.css'

type Mentor = {
  id: string
  nombre: string
  iniciales: string
  especialidad: string
  estado: 'Disponible' | 'Ausente'
  color: string
  ultimoMensaje: string
  hora: string
  pendientes?: number
}

type Mensaje = {
  id: string
  autor: 'MENTOR' | 'YO'
  texto: string
  hora: string
}

const MENTORES: Mentor[] = [
  {
    id: 'ana-torres',
    nombre: 'Ana Torres',
    iniciales: 'AT',
    especialidad: 'Vida espiritual',
    estado: 'Disponible',
    color: '#8f2948',
    ultimoMensaje: 'Estoy aquí para acompañarte.',
    hora: '00:42',
  },
  {
    id: 'samuel-rios',
    nombre: 'Samuel Ríos',
    iniciales: 'SR',
    especialidad: 'Discipulado',
    estado: 'Disponible',
    color: '#304f79',
    ultimoMensaje: 'Podemos revisar ese pasaje juntos.',
    hora: 'Ayer',
    pendientes: 2,
  },
  {
    id: 'rebeca-salazar',
    nombre: 'Rebeca Salazar',
    iniciales: 'RS',
    especialidad: 'Familia y propósito',
    estado: 'Ausente',
    color: '#70543f',
    ultimoMensaje: 'Gracias por compartir lo que sientes.',
    hora: 'Lun',
  },
  {
    id: 'daniel-leon',
    nombre: 'Daniel León',
    iniciales: 'DL',
    especialidad: 'Oración y estudio bíblico',
    estado: 'Disponible',
    color: '#47665a',
    ultimoMensaje: 'Te responderé con calma esta noche.',
    hora: 'Dom',
  },
  {
    id: 'maria-celeste',
    nombre: 'María Celeste',
    iniciales: 'MC',
    especialidad: 'Acompañamiento juvenil',
    estado: 'Ausente',
    color: '#6d477a',
    ultimoMensaje: 'Recuerda que no caminas solo.',
    hora: 'Vie',
  },
]

const CONVERSACIONES_INICIALES: Record<string, Mensaje[]> = {
  'ana-torres': [
    { id: 'ana-1', autor: 'MENTOR', texto: 'Hola. Me alegra encontrarte aquí. ¿Cómo está tu corazón hoy?', hora: '00:31' },
    { id: 'ana-2', autor: 'YO', texto: 'He estado pensando mucho en mi propósito y no sé por dónde empezar.', hora: '00:34' },
    { id: 'ana-3', autor: 'MENTOR', texto: 'No necesitas tener todas las respuestas ahora. Podemos comenzar escuchando qué inquietud vuelve con más fuerza.', hora: '00:37' },
    { id: 'ana-4', autor: 'YO', texto: 'Quiero servir, pero me preocupa equivocarme al elegir el camino.', hora: '00:39' },
    { id: 'ana-5', autor: 'MENTOR', texto: 'El discernimiento también se aprende caminando. Cuéntame qué dones reconocen en ti las personas que te conocen bien.', hora: '00:42' },
  ],
  'samuel-rios': [
    { id: 'samuel-1', autor: 'YO', texto: 'Samuel, me cuesta entender el pasaje que vimos en el curso.', hora: 'Ayer, 21:08' },
    { id: 'samuel-2', autor: 'MENTOR', texto: 'Podemos revisarlo juntos. Dime qué parte te genera más preguntas y empezamos desde allí.', hora: 'Ayer, 21:12' },
  ],
  'rebeca-salazar': [
    { id: 'rebeca-1', autor: 'YO', texto: 'Quisiera aprender a conversar con mi familia sin que todo termine en una discusión.', hora: 'Lun, 18:20' },
    { id: 'rebeca-2', autor: 'MENTOR', texto: 'Gracias por compartirlo. Primero vamos a reconocer qué ocurre justo antes de que la conversación cambie de tono.', hora: 'Lun, 18:26' },
  ],
  'daniel-leon': [
    { id: 'daniel-1', autor: 'MENTOR', texto: '¿Cómo te fue con la práctica de oración de esta semana?', hora: 'Dom, 20:15' },
  ],
  'maria-celeste': [
    { id: 'maria-1', autor: 'MENTOR', texto: 'Recuerda que no caminas solo. Cuando quieras, retomamos nuestra conversación.', hora: 'Vie, 16:40' },
  ],
}

export function MentorChatPage() {
  const [mentorId, setMentorId] = useState(MENTORES[0]?.id ?? '')
  const [busqueda, setBusqueda] = useState('')
  const [borrador, setBorrador] = useState('')
  const [conversaciones, setConversaciones] = useState(CONVERSACIONES_INICIALES)
  const finalRef = useRef<HTMLDivElement>(null)
  const listaMentoresRef = useRef<HTMLDivElement>(null)
  const [indicadorMentor, setIndicadorMentor] = useState({ top: 0, left: 0, width: 0, height: 0, visible: false })

  const mentorActivo = MENTORES.find((mentor) => mentor.id === mentorId) ?? MENTORES[0]!
  const mensajes = conversaciones[mentorActivo.id] ?? []
  const mentoresFiltrados = useMemo(() => {
    const consulta = busqueda.trim().toLocaleLowerCase('es-PE')
    if (!consulta) return MENTORES
    return MENTORES.filter((mentor) =>
      `${mentor.nombre} ${mentor.especialidad}`.toLocaleLowerCase('es-PE').includes(consulta),
    )
  }, [busqueda])

  useEffect(() => {
    finalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [mentorActivo.id, mensajes.length])

  useLayoutEffect(() => {
    const actualizarIndicador = () => {
      const lista = listaMentoresRef.current
      const mentorSeleccionado = lista?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
      if (!lista || !mentorSeleccionado) {
        setIndicadorMentor((actual) => ({ ...actual, visible: false }))
        return
      }

      setIndicadorMentor({
        top: mentorSeleccionado.offsetTop,
        left: mentorSeleccionado.offsetLeft,
        width: mentorSeleccionado.offsetWidth,
        height: mentorSeleccionado.offsetHeight,
        visible: true,
      })
    }

    actualizarIndicador()
    window.addEventListener('resize', actualizarIndicador)
    return () => window.removeEventListener('resize', actualizarIndicador)
  }, [mentorActivo.id, mentoresFiltrados])

  const enviarMensaje = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const texto = borrador.trim()
    if (!texto) return

    const ahora = new Date()
    const hora = ahora.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
    const nuevo: Mensaje = { id: `mensaje-${ahora.getTime()}`, autor: 'YO', texto, hora }
    setConversaciones((actuales) => ({
      ...actuales,
      [mentorActivo.id]: [...(actuales[mentorActivo.id] ?? []), nuevo],
    }))
    setBorrador('')
  }

  return (
    <section className="mentor-chat" aria-label="Chat con mentor">
      <div className="mentor-chat__conversation">
        <header className="mentor-chat__conversation-header">
          <Avatar mentor={mentorActivo} />
          <div>
            <strong>{mentorActivo.nombre}</strong>
            <span>{mentorActivo.especialidad} · {mentorActivo.estado}</span>
          </div>
        </header>

        <div className="mentor-chat__messages" role="log" aria-live="polite" aria-label={`Conversación con ${mentorActivo.nombre}`}>
          <div className="mentor-chat__day"><span>Hoy</span></div>
          {mensajes.map((mensaje) => (
            <div key={mensaje.id} className={`mentor-message mentor-message--${mensaje.autor === 'YO' ? 'mine' : 'mentor'}`}>
              {mensaje.autor === 'MENTOR' && <Avatar mentor={mentorActivo} compact />}
              <div>
                <p>{mensaje.texto}</p>
                <time>{mensaje.hora}</time>
              </div>
            </div>
          ))}
          <div ref={finalRef} />
        </div>

        <form className="mentor-chat__composer" onSubmit={enviarMensaje}>
          <button type="button" aria-label="Adjuntar archivo" title="Adjuntar archivo">
            <AttachIcon />
          </button>
          <label>
            <span className="sr-only">Escribe un mensaje</span>
            <input
              value={borrador}
              onChange={(event) => setBorrador(event.target.value)}
              placeholder={`Escribe a ${mentorActivo.nombre.split(' ')[0]}...`}
              autoComplete="off"
            />
          </label>
          <button type="submit" className="mentor-chat__send" disabled={!borrador.trim()} aria-label="Enviar mensaje">
            <SendIcon />
          </button>
        </form>
      </div>

      <aside className="mentor-chat__directory" aria-label="Mentores de la plataforma">
        <header>
          <span>Acompañamiento</span>
          <h1>Mentores</h1>
        </header>

        <label className="mentor-chat__search">
          <SearchIcon />
          <span className="sr-only">Buscar mentor</span>
          <input
            type="search"
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar mentor..."
          />
        </label>

        <div ref={listaMentoresRef} className="mentor-chat__mentor-list">
          <span
            className="mentor-chat__mentor-indicator"
            aria-hidden="true"
            style={{
              '--mentor-indicator-top': `${indicadorMentor.top}px`,
              '--mentor-indicator-left': `${indicadorMentor.left}px`,
              '--mentor-indicator-width': `${indicadorMentor.width}px`,
              '--mentor-indicator-height': `${indicadorMentor.height}px`,
              opacity: indicadorMentor.visible ? 1 : 0,
            } as CSSProperties}
          />
          {mentoresFiltrados.map((mentor) => (
            <button
              key={mentor.id}
              type="button"
              className={mentor.id === mentorActivo.id ? 'is-active' : undefined}
              onClick={() => setMentorId(mentor.id)}
              aria-pressed={mentor.id === mentorActivo.id}
            >
              <Avatar mentor={mentor} />
              <span className="mentor-chat__mentor-copy">
                <span>
                  <strong>{mentor.nombre}</strong>
                  <time>{mentor.hora}</time>
                </span>
                <small>{mentor.especialidad}</small>
                <span className="mentor-chat__preview">
                  <span>{mentor.ultimoMensaje}</span>
                  {mentor.pendientes ? <b>{mentor.pendientes}</b> : null}
                </span>
              </span>
            </button>
          ))}
          {mentoresFiltrados.length === 0 && <p className="mentor-chat__empty">No encontramos mentores con ese nombre.</p>}
        </div>
      </aside>
    </section>
  )
}

function Avatar({ mentor, compact = false }: { mentor: Mentor; compact?: boolean }) {
  return (
    <span
      className={`mentor-avatar${compact ? ' mentor-avatar--compact' : ''}`}
      style={{ '--mentor-color': mentor.color } as React.CSSProperties}
      aria-hidden="true"
    >
      {mentor.iniciales}
      <i className={mentor.estado === 'Disponible' ? 'is-online' : undefined} />
    </span>
  )
}

function SearchIcon() {
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.6" /><path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
}

function AttachIcon() {
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true"><path d="m9.5 12.5 5.7-5.7a3.2 3.2 0 0 1 4.5 4.5l-8 8a5 5 0 0 1-7.1-7.1l8-8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

function SendIcon() {
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true"><path d="m4 4 17 8-17 8 3-8-3-8Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M7 12h14" stroke="currentColor" strokeWidth="1.6" /></svg>
}
