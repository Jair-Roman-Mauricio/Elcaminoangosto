export interface ConversationEntity {
  id: string
  mentorId: string
  studentId: string
  lastMessageAt: Date | null
}

export interface MessageEntity {
  id: string
  conversationId: string
  senderId: string
  body: string
  readAt: Date | null
  createdAt: Date
}

/** Resumen de una conversación para la lista (la otra persona + último mensaje). */
export interface ConversationSummary {
  id: string
  otherId: string
  otherName: string
  lastMessage: string | null
  lastMessageAt: Date | null
  unread: number
  /** Rol de la otra persona: distingue chats con estudiantes vs. con mentores. */
  otherRole: string
}

/** Persona con la que se puede conversar (contacto). */
export interface Contacto {
  id: string
  name: string
  /** Rol mínimo necesario para separar directorios sin exponer perfiles completos. */
  role: 'ESTUDIANTE' | 'MAESTRO' | 'ADMIN'
}

/** Puerto del repositorio de chat. */
export abstract class ChatRepository {
  abstract findConversation(mentorId: string, studentId: string): Promise<ConversationEntity | null>
  abstract createConversation(mentorId: string, studentId: string): Promise<ConversationEntity>
  abstract findConversationById(id: string): Promise<ConversationEntity | null>
  abstract listConversations(userId: string): Promise<ConversationSummary[]>
  abstract listMessages(conversationId: string): Promise<MessageEntity[]>
  abstract sendMessage(conversationId: string, senderId: string, body: string): Promise<MessageEntity>
  abstract markRead(conversationId: string, readerId: string): Promise<void>

  /** Estudiantes inscritos en algún curso del maestro (para que él los contacte). */
  abstract contactsForTeacher(teacherId: string): Promise<Contacto[]>
  /** Todos los mentores disponibles: el estudiante puede consultar a cualquiera. */
  abstract mentores(): Promise<Contacto[]>
  /** Administradores disponibles únicamente para consultas de profesores. */
  abstract administradores(): Promise<Contacto[]>
  /** Rol del destinatario, usado para aplicar la política antes de crear un chat. */
  abstract rolDe(userId: string): Promise<Contacto['role'] | null>
  /** ¿Este usuario es un mentor (MAESTRO)? Autoriza chatear con él. */
  abstract esMentor(userId: string): Promise<boolean>
}
