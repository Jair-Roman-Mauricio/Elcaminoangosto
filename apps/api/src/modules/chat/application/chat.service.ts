import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import type { Actor } from '../../shared'
import {
  ChatRepository,
  type Contacto,
  type ConversationSummary,
  type MessageEntity,
} from '../domain/chat.repository'

/**
 * Chat mentor–estudiante (HU-6.1). Un maestro conversa con los estudiantes
 * inscritos en sus cursos, y viceversa. La autorización se resuelve aquí: solo
 * los dos participantes leen/escriben en una conversación, y solo se puede
 * iniciar una si comparten una inscripción.
 */
@Injectable()
export class ChatService {
  constructor(private readonly chat: ChatRepository) {}

  /** Personas con las que el actor puede conversar. */
  async contactos(actor: Actor): Promise<Contacto[]> {
    // El estudiante consulta a cualquier mentor libremente (sin inscripción).
    if (actor.role === 'ESTUDIANTE') return this.chat.mentores()
    // El mentor ve a sus estudiantes inscritos para poder contactarlos.
    if (actor.role === 'MAESTRO') return this.chat.contactsForTeacher(actor.id)
    return []
  }

  /** Conversaciones del actor, con la otra persona y el último mensaje. */
  async conversaciones(actor: Actor): Promise<ConversationSummary[]> {
    return this.chat.listConversations(actor.id)
  }

  /**
   * Abre (o crea) la conversación con otra persona y devuelve sus mensajes.
   * El maestro es el `mentor`; el estudiante, el `student`.
   */
  async abrir(actor: Actor, otroId: string): Promise<{ conversationId: string; mensajes: MessageEntity[] }> {
    if (otroId === actor.id) throw new ForbiddenException('No puedes chatear contigo mismo')

    const mentorId = actor.role === 'MAESTRO' ? actor.id : otroId
    const studentId = actor.role === 'MAESTRO' ? otroId : actor.id

    // El lado «mentor» de la conversación debe ser un mentor real. No se exige
    // inscripción: el estudiante consulta a cualquier mentor de forma libre.
    if (!(await this.chat.esMentor(mentorId))) {
      throw new ForbiddenException('Solo puedes iniciar una conversación con un mentor')
    }

    const existente = await this.chat.findConversation(mentorId, studentId)
    const conv = existente ?? (await this.chat.createConversation(mentorId, studentId))
    await this.chat.markRead(conv.id, actor.id)
    return { conversationId: conv.id, mensajes: await this.chat.listMessages(conv.id) }
  }

  /** Mensajes de una conversación (solo un participante); marca lo recibido como leído. */
  async mensajes(actor: Actor, conversationId: string): Promise<MessageEntity[]> {
    await this.exigirParticipante(actor, conversationId)
    await this.chat.markRead(conversationId, actor.id)
    return this.chat.listMessages(conversationId)
  }

  /** Envía un mensaje en una conversación propia. */
  async enviar(actor: Actor, conversationId: string, body: string): Promise<MessageEntity> {
    await this.exigirParticipante(actor, conversationId)
    return this.chat.sendMessage(conversationId, actor.id, body.trim())
  }

  private async exigirParticipante(actor: Actor, conversationId: string): Promise<void> {
    const conv = await this.chat.findConversationById(conversationId)
    if (!conv) throw new NotFoundException('Conversación no encontrada')
    const participante =
      conv.mentorId === actor.id || conv.studentId === actor.id || actor.role === 'ADMIN'
    if (!participante) throw new ForbiddenException('No participas en esta conversación')
  }
}
