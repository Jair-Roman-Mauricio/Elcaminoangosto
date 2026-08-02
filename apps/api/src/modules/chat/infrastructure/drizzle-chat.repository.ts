import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { and, eq, isNull, ne, or, sql } from 'drizzle-orm'
import { DRIZZLE, type Database } from '../../shared'
import {
  conversations,
  messages,
  profiles,
  enrollments,
  courses,
} from '../../shared/database/schema'
import {
  ChatRepository,
  type ConversationEntity,
  type ConversationSummary,
  type Contacto,
  type MessageEntity,
} from '../domain/chat.repository'

@Injectable()
export class DrizzleChatRepository extends ChatRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {
    super()
  }

  async findConversation(mentorId: string, studentId: string): Promise<ConversationEntity | null> {
    const filas = await this.db
      .select({
        id: conversations.id,
        mentorId: conversations.mentorId,
        studentId: conversations.studentId,
        lastMessageAt: conversations.lastMessageAt,
      })
      .from(conversations)
      .where(and(eq(conversations.mentorId, mentorId), eq(conversations.studentId, studentId)))
      .limit(1)
    return filas[0] ?? null
  }

  async createConversation(mentorId: string, studentId: string): Promise<ConversationEntity> {
    const [fila] = await this.db
      .insert(conversations)
      .values({ mentorId, studentId })
      .returning({
        id: conversations.id,
        mentorId: conversations.mentorId,
        studentId: conversations.studentId,
        lastMessageAt: conversations.lastMessageAt,
      })
    if (!fila) throw new NotFoundException('No se pudo crear la conversación')
    return fila
  }

  async findConversationById(id: string): Promise<ConversationEntity | null> {
    const filas = await this.db
      .select({
        id: conversations.id,
        mentorId: conversations.mentorId,
        studentId: conversations.studentId,
        lastMessageAt: conversations.lastMessageAt,
      })
      .from(conversations)
      .where(eq(conversations.id, id))
      .limit(1)
    return filas[0] ?? null
  }

  async listConversations(userId: string): Promise<ConversationSummary[]> {
    // Una sola consulta con subconsultas correlacionadas (último mensaje y
    // no leídos) en lugar de N+1 viajes a la BD por conversación: en producción
    // cada viaje suma latencia de red, así que esto es lo que hacía «tardar
    // mucho en listarse» la bandeja del maestro.
    const otroId = sql<string>`case when ${conversations.mentorId} = ${userId}
      then ${conversations.studentId} else ${conversations.mentorId} end`

    const filas = await this.db
      .select({
        id: conversations.id,
        otherId: otroId,
        otherName: profiles.displayName,
        otherRole: profiles.role,
        lastMessageAt: conversations.lastMessageAt,
        lastMessage: sql<string | null>`(
          select m.body from ${messages} m
          where m.conversation_id = ${conversations.id}
          order by m.created_at desc limit 1)`,
        unread: sql<number>`(
          select count(*)::int from ${messages} m
          where m.conversation_id = ${conversations.id}
            and m.sender_id <> ${userId} and m.read_at is null)`,
      })
      .from(conversations)
      .innerJoin(profiles, eq(profiles.id, otroId))
      .where(or(eq(conversations.mentorId, userId), eq(conversations.studentId, userId)))
      // Las más recientes primero; las vacías (sin mensajes) al final.
      // El id rompe empates de reloj de forma determinista. Así la lista no
      // parece reordenarse al refrescar cuando dos envíos caen en el mismo ms.
      .orderBy(sql`${conversations.lastMessageAt} desc nulls last`, conversations.id)

    return filas.map((f) => ({
      id: f.id,
      otherId: f.otherId,
      otherName: f.otherName ?? 'Usuario',
      lastMessage: f.lastMessage ?? null,
      lastMessageAt: f.lastMessageAt,
      unread: Number(f.unread ?? 0),
      otherRole: f.otherRole ?? 'ESTUDIANTE',
    }))
  }

  async listMessages(conversationId: string): Promise<MessageEntity[]> {
    return this.db
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        senderId: messages.senderId,
        body: messages.body,
        readAt: messages.readAt,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt)
  }

  async sendMessage(conversationId: string, senderId: string, body: string): Promise<MessageEntity> {
    const [fila] = await this.db
      .insert(messages)
      .values({ conversationId, senderId, body })
      .returning({
        id: messages.id,
        conversationId: messages.conversationId,
        senderId: messages.senderId,
        body: messages.body,
        readAt: messages.readAt,
        createdAt: messages.createdAt,
      })
    if (!fila) throw new NotFoundException('No se pudo enviar el mensaje')
    await this.db
      .update(conversations)
      // La marca de orden debe ser la del mensaje insertado, no la hora en la
      // que terminó el UPDATE: con dos envíos simultáneos eso podía invertir el
      // orden de las conversaciones.
      .set({ lastMessageAt: fila.createdAt, updatedAt: fila.createdAt })
      .where(eq(conversations.id, conversationId))
    return fila
  }

  async markRead(conversationId: string, readerId: string): Promise<void> {
    await this.db
      .update(messages)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(messages.conversationId, conversationId),
          ne(messages.senderId, readerId),
          isNull(messages.readAt),
        ),
      )
  }

  async contactsForTeacher(teacherId: string): Promise<Contacto[]> {
    return this.db
      .selectDistinct({ id: profiles.id, name: profiles.displayName, role: profiles.role })
      .from(enrollments)
      .innerJoin(courses, eq(courses.id, enrollments.courseId))
      .innerJoin(profiles, eq(profiles.id, enrollments.studentId))
      // El directorio del profesor solo incluye alumnado de sus cursos. Sin
      // este filtro una inscripción atípica de un maestro también entraba en
      // la respuesta, aunque no fuese un contacto permitido por la UI.
      .where(and(eq(courses.teacherId, teacherId), eq(profiles.role, 'ESTUDIANTE')))
  }

  async mentores(): Promise<Contacto[]> {
    return this.db
      .select({ id: profiles.id, name: profiles.displayName, role: profiles.role })
      .from(profiles)
      .where(eq(profiles.role, 'MAESTRO'))
      .orderBy(profiles.displayName)
  }

  async administradores(): Promise<Contacto[]> {
    return this.db
      .select({ id: profiles.id, name: profiles.displayName, role: profiles.role })
      .from(profiles)
      .where(eq(profiles.role, 'ADMIN'))
      .orderBy(profiles.displayName)
  }

  async rolDe(userId: string): Promise<Contacto['role'] | null> {
    const [fila] = await this.db
      .select({ role: profiles.role })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1)
    return fila?.role ?? null
  }

  async esMentor(userId: string): Promise<boolean> {
    const [fila] = await this.db
      .select({ role: profiles.role })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1)
    return fila?.role === 'MAESTRO'
  }
}
