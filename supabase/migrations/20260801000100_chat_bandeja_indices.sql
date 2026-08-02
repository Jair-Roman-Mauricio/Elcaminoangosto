-- Bandeja de chat: las dos rutas de participación se consultan por separado
-- por PostgreSQL cuando hay un OR. Estos índices mantienen la primera página
-- de conversaciones y los contadores de no leídos rápidos al crecer la tabla.
create index if not exists conversations_mentor_recency_idx
  on public.conversations (mentor_id, last_message_at desc nulls last, id);

create index if not exists conversations_student_recency_idx
  on public.conversations (student_id, last_message_at desc nulls last, id);

-- La consulta de no leídos filtra exactamente por conversación, remitente y
-- read_at. El índice parcial evita cargar mensajes ya leídos para cada fila.
create index if not exists messages_unread_by_conversation_idx
  on public.messages (conversation_id, sender_id)
  where read_at is null;

-- Directorios de mentores y administradores: orden consistente sin escanear
-- perfiles de otros roles.
create index if not exists profiles_role_name_idx
  on public.profiles (role, display_name, id);
