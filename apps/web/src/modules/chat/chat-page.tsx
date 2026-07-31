import { ChatPanel } from './chat-panel'

/** Chat del estudiante con cualquier mentor (consulta libre, sin inscripción). */
export function MentorChatPage() {
  return <ChatPanel etiqueta="mentores" />
}

/** Chat del profesor con los estudiantes inscritos en sus cursos. */
export function ChatConEstudiantesPage() {
  return <ChatPanel etiqueta="estudiantes" />
}
