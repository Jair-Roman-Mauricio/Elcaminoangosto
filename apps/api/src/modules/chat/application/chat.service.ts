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
    // El mentor ve solo a sus estudiantes inscritos en este módulo.
    if (actor.role === 'MAESTRO') return this.chat.contactsForTeacher(actor.id)
    return []
  }

  /** Directorio independiente para consultas de profesor a administración. */
  async administradores(actor: Actor): Promise<Contacto[]> {
    if (actor.role !== 'MAESTRO') {
      throw new ForbiddenException('Solo los profesores pueden contactar a administración')
    }
    return this.chat.administradores()
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
    const rolDelOtro = await this.chat.rolDe(otroId)
    if (!rolDelOtro) throw new NotFoundException('Usuario no encontrado')

    let mentorId: string
    let studentId: string
    let permitirCrear = true

    if (actor.role === 'ESTUDIANTE' && rolDelOtro === 'MAESTRO') {
      mentorId = otroId
      studentId = actor.id
    } else if (actor.role === 'MAESTRO' && rolDelOtro === 'ESTUDIANTE') {
      // Un profesor solo puede iniciar con estudiantes de sus cursos. Esto
      // evita convertir el directorio de perfiles en un canal de contacto.
      const autorizados = await this.chat.contactsForTeacher(actor.id)
      if (!autorizados.some((contacto) => contacto.id === otroId)) {
        throw new ForbiddenException('Este estudiante no pertenece a tus cursos')
      }
      mentorId = actor.id
      studentId = otroId
    } else if (actor.role === 'MAESTRO' && rolDelOtro === 'ADMIN') {
      // Reutilizamos el par estable de la conversación: profesor en mentor_id
      // y admin en student_id. El nombre histórico de las columnas no se
      // expone por el contrato HTTP.
      mentorId = actor.id
      studentId = otroId
    } else if (actor.role === 'ADMIN' && rolDelOtro === 'MAESTRO') {
      // Administración responde incidencias abiertas por un profesor, pero no
      // inicia conversaciones arbitrarias con él.
      mentorId = otroId
      studentId = actor.id
      permitirCrear = false
    } else {
      throw new ForbiddenException('No puedes iniciar una conversación con este usuario')
    }

    const existente = await this.chat.findConversation(mentorId, studentId)
    if (!existente && !permitirCrear) {
      throw new ForbiddenException('El profesor debe iniciar la conversación')
    }
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
      conv.mentorId === actor.id || conv.studentId === actor.id
    if (!participante) throw new ForbiddenException('No participas en esta conversación')
  }
}
