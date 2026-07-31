import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../lib/api-client'

export interface Contacto {
  id: string
  name: string
}

export interface ConversationSummary {
  id: string
  otherId: string
  otherName: string
  lastMessage: string | null
  lastMessageAt: string | null
  unread: number
  /** Rol de la otra persona: 'ESTUDIANTE' | 'MAESTRO' | 'ADMIN'. */
  otherRole: string
}

export interface Mensaje {
  id: string
  conversationId: string
  senderId: string
  body: string
  readAt: string | null
  createdAt: string
}

export function useContactos() {
  return useQuery({
    queryKey: ['chat', 'contacts'],
    queryFn: () => apiClient.get<Contacto[]>('/chat/contacts'),
  })
}

export function useConversaciones() {
  return useQuery({
    queryKey: ['chat', 'conversations'],
    queryFn: () => apiClient.get<ConversationSummary[]>('/chat/conversations'),
    // La frescura la da Realtime (useRealtimeChat). El sondeo queda de respaldo
    // por si el WebSocket se cae; sigue activo aunque la pestaña no tenga foco.
    refetchInterval: 12000,
    refetchIntervalInBackground: true,
  })
}

/** Abre (o crea) la conversación con alguien; devuelve su id. */
export function useAbrirConversacion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (otherId: string) =>
      apiClient.post<{ conversationId: string; mensajes: Mensaje[] }>('/chat/conversations', {
        otherId,
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['chat', 'conversations'] }),
  })
}

export function useMensajes(conversationId: string | null) {
  return useQuery({
    queryKey: ['chat', 'messages', conversationId],
    queryFn: () => apiClient.get<Mensaje[]>(`/chat/conversations/${conversationId}/messages`),
    enabled: Boolean(conversationId),
    // Tiempo real por Realtime; el sondeo queda de respaldo (pestaña oculta o
    // WebSocket caído), también en segundo plano.
    refetchInterval: 10000,
    refetchIntervalInBackground: true,
  })
}

export function useEnviarMensaje(conversationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: string) =>
      apiClient.post<Mensaje>(`/chat/conversations/${conversationId}/messages`, { body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['chat', 'messages', conversationId] })
      void qc.invalidateQueries({ queryKey: ['chat', 'conversations'] })
    },
  })
}
