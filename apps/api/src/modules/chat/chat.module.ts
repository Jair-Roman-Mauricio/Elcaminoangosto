import { Module } from '@nestjs/common'
import { ChatController } from './interface/chat.controller'
import { ChatService } from './application/chat.service'
import { ChatRepository } from './domain/chat.repository'
import { DrizzleChatRepository } from './infrastructure/drizzle-chat.repository'

/**
 * Bounded context `chat`: conversaciones mentor–estudiante (HU-6.1).
 * Capas: interface / application / domain / infrastructure.
 */
@Module({
  controllers: [ChatController],
  providers: [ChatService, { provide: ChatRepository, useClass: DrizzleChatRepository }],
  exports: [ChatService],
})
export class ChatModule {}
