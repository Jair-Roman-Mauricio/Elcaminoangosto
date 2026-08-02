import { ForbiddenException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'
import { ChatService } from './chat.service'

const profesor = { id: '11111111-1111-4111-8111-111111111111', role: 'MAESTRO' as const, levelRank: 1 }
const estudiante = { id: '22222222-2222-4222-8222-222222222222', role: 'ESTUDIANTE' as const, levelRank: 1 }
const admin = { id: '33333333-3333-4333-8333-333333333333', role: 'ADMIN' as const, levelRank: 1 }

function repositorio() {
  return {
    mentores: vi.fn().mockResolvedValue([{ id: profesor.id, name: 'Profesor', role: 'MAESTRO' }]),
    administradores: vi.fn().mockResolvedValue([{ id: admin.id, name: 'Administración', role: 'ADMIN' }]),
    contactsForTeacher: vi.fn().mockResolvedValue([{ id: estudiante.id, name: 'Estudiante', role: 'ESTUDIANTE' }]),
    rolDe: vi.fn(async (id: string) => ({ [profesor.id]: 'MAESTRO', [estudiante.id]: 'ESTUDIANTE', [admin.id]: 'ADMIN' })[id] ?? null),
    findConversation: vi.fn().mockResolvedValue(null),
    createConversation: vi.fn(async (mentorId: string, studentId: string) => ({ id: 'conv-1', mentorId, studentId, lastMessageAt: null })),
    markRead: vi.fn().mockResolvedValue(undefined),
    listMessages: vi.fn().mockResolvedValue([]),
    listConversations: vi.fn().mockResolvedValue([]),
    findConversationById: vi.fn().mockResolvedValue(null),
    sendMessage: vi.fn(),
    esMentor: vi.fn(),
  }
}

describe('ChatService', () => {
  it('mantiene el contacto estudiante-profesor y crea el par ordenado', async () => {
    const repo = repositorio()
    const service = new ChatService(repo as never)

    await service.abrir(estudiante, profesor.id)

    expect(repo.createConversation).toHaveBeenCalledWith(profesor.id, estudiante.id)
  })

  it('separa el directorio de estudiantes y el de administración para el profesor', async () => {
    const repo = repositorio()
    const service = new ChatService(repo as never)

    await expect(service.contactos(profesor)).resolves.toEqual([
      { id: estudiante.id, name: 'Estudiante', role: 'ESTUDIANTE' },
    ])
    await expect(service.administradores(profesor)).resolves.toEqual([
      { id: admin.id, name: 'Administración', role: 'ADMIN' },
    ])
    await service.abrir(profesor, admin.id)
    expect(repo.createConversation).toHaveBeenCalledWith(profesor.id, admin.id)
  })

  it('no permite a estudiantes descubrir o abrir chats con administración', async () => {
    const repo = repositorio()
    const service = new ChatService(repo as never)

    await expect(service.abrir(estudiante, admin.id)).rejects.toBeInstanceOf(ForbiddenException)
    await expect(service.administradores(estudiante)).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('permite al admin responder un hilo existente, pero no iniciar uno nuevo', async () => {
    const repo = repositorio()
    const service = new ChatService(repo as never)

    await expect(service.abrir(admin, profesor.id)).rejects.toBeInstanceOf(ForbiddenException)
    repo.findConversation.mockResolvedValueOnce({ id: 'conv-1', mentorId: profesor.id, studentId: admin.id, lastMessageAt: null })
    await expect(service.abrir(admin, profesor.id)).resolves.toMatchObject({ conversationId: 'conv-1' })
  })
})
