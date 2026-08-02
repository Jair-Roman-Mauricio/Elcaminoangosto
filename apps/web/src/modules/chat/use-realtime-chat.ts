import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useSession } from '../../auth/session'
import { compararConversaciones, type ConversationSummary, type Mensaje } from './chat-api'

/** Fila cruda (snake_case) que entrega Realtime para la tabla `messages`. */
interface FilaMensaje {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  read_at: string | null
  created_at: string
}

function aMensaje(f: FilaMensaje): Mensaje {
  return {
    id: f.id,
    conversationId: f.conversation_id,
    senderId: f.sender_id,
    body: f.body,
    readAt: f.read_at,
    createdAt: f.created_at,
  }
}

/**
 * Suscribe el chat a los cambios en tiempo real (Supabase Realtime). En lugar de
 * sondear —que el navegador ralentiza cuando la pestaña no está visible, por eso
 * antes «había que hacer clic»— los mensajes llegan por push (WebSocket).
 *
 * Clave para la latencia: el mensaje entrante se inserta directo en la caché con
 * el propio payload del evento, SIN volver a pedirlo por HTTP. Así el hilo se
 * actualiza en ~100 ms en vez de esperar un refetch de ida y vuelta.
 *
 * Realtime respeta RLS: cada usuario solo recibe los INSERT de sus propias
 * conversaciones y mensajes.
 */
export function useRealtimeChat() {
  const qc = useQueryClient()
  const { session } = useSession()
  const token = session?.access_token

  useEffect(() => {
    if (!token) return

    // Autentica el socket para que RLS entregue solo lo que el usuario puede ver.
    supabase.realtime.setAuth(token)

    const canal = supabase
      .channel(`chat-realtime:${session.user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const nuevo = aMensaje(payload.new as FilaMensaje)
          // Inserta el mensaje directo en el hilo (sin refetch). Dedupe por id
          // para no duplicar con el eco optimista del propio emisor.
          qc.setQueryData<Mensaje[]>(['chat', 'messages', nuevo.conversationId], (prev) => {
            if (!prev) return prev // hilo no abierto: se cargará al entrar
            if (prev.some((m) => m.id === nuevo.id)) return prev
            return [...prev, nuevo]
          })
          // Si ese hilo está abierto, la consulta de mensajes vuelve a pasar
          // por el API y marca el recibido como leído. Así el badge no queda
          // encendido para una conversación que el usuario ya está viendo.
          void qc.invalidateQueries({ queryKey: ['chat', 'messages', nuevo.conversationId] })
          // Actualiza primero la fila que ya está en caché: orden, preview y
          // badge no esperan una ida HTTP. El refetch posterior reconcilia
          // lecturas concurrentes o un hilo que se creó mientras tanto.
          qc.setQueryData<ConversationSummary[]>(['chat', 'conversations'], (prev) => {
            if (!prev) return prev
            const encontrada = prev.some((conversacion) => conversacion.id === nuevo.conversationId)
            if (!encontrada) return prev
            const actualizadas = prev.map((conversacion) =>
              conversacion.id === nuevo.conversationId
                ? {
                    ...conversacion,
                    lastMessage: nuevo.body,
                    lastMessageAt: nuevo.createdAt,
                    unread:
                      nuevo.senderId === session.user.id
                        ? conversacion.unread
                        : conversacion.unread + 1,
                  }
                : conversacion,
            )
            return [...actualizadas].sort(compararConversaciones)
          })
          void qc.invalidateQueries({ queryKey: ['chat', 'conversations'] })
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversations' },
        () => {
          // Un estudiante nuevo que escribe por primera vez aparece al momento.
          void qc.invalidateQueries({ queryKey: ['chat', 'conversations'] })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(canal)
    }
  }, [qc, token])
}
