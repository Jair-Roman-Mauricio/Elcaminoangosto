import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../lib/api-client'

export interface Contacto {
  id: string
  name: string
  role: 'ESTUDIANTE' | 'MAESTRO' | 'ADMIN'
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

export function useContactos(enabled = true) {
  return useQuery({
    queryKey: ['chat', 'contacts'],
    queryFn: () => apiClient.get<Contacto[]>('/chat/contacts'),
    // Un directorio no puede depender de que ocurra otro evento para
    // completarse. Reintentamos pronto y refrescamos de forma independiente de
    // las conversaciones, que es lo que evita el estado parcial prolongado.
    staleTime: 0,
    retry: 1,
    retryDelay: 800,
    refetchOnMount: 'always',
    refetchInterval: 20_000,
    refetchIntervalInBackground: true,
    enabled,
  })
}

/** Directorio aislado para el módulo profesor ↔ administración. */
export function useAdministradores(enabled = true) {
  return useQuery({
    queryKey: ['chat', 'administrators'],
    queryFn: () => apiClient.get<Contacto[]>('/chat/administrators'),
    staleTime: 0,
    retry: 1,
    retryDelay: 800,
    refetchOnMount: 'always',
    refetchInterval: 20_000,
    refetchIntervalInBackground: true,
    enabled,
  })
}

export function useConversaciones() {
  return useQuery({
    queryKey: ['chat', 'conversations'],
    queryFn: () => apiClient.get<ConversationSummary[]>('/chat/conversations'),
    // La frescura la da Realtime (useRealtimeChat). El sondeo queda de respaldo
    // por si el WebSocket se cae; sigue activo aunque la pestaña no tenga foco.
    refetchInterval: 3500,
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
    onSuccess: (nuevo) => {
      // Quien envía ve el reordenamiento al resolver el POST, sin esperar al
      // WebSocket ni al siguiente sondeo. El receptor recibe el mismo cambio
      // por Realtime y el sondeo corto queda como red de seguridad.
      qc.setQueryData<ConversationSummary[]>(['chat', 'conversations'], (prev) => {
        if (!prev) return prev
        const actualizada = prev.map((conversacion) =>
          conversacion.id === conversationId
            ? {
                ...conversacion,
                lastMessage: nuevo.body,
                lastMessageAt: nuevo.createdAt,
              }
            : conversacion,
        )
        return [...actualizada].sort(compararConversaciones)
      })
      void qc.invalidateQueries({ queryKey: ['chat', 'messages', conversationId] })
      void qc.invalidateQueries({ queryKey: ['chat', 'conversations'] })
    },
  })
}

export function compararConversaciones(a: ConversationSummary, b: ConversationSummary): number {
  const fechaA = a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0
  const fechaB = b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0
  return fechaB - fechaA || a.id.localeCompare(b.id)
}
