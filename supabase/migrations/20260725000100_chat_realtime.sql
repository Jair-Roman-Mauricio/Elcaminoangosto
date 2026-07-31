-- Habilita Supabase Realtime para el chat mentor–estudiante. Con esto el
-- navegador recibe los mensajes nuevos por push (WebSocket) en lugar de por
-- sondeo, que el navegador estrangula cuando la pestaña no está visible.
--
-- Realtime respeta RLS: cada quien solo recibe los INSERT de las
-- conversaciones y mensajes en los que participa (policies *_leer).

-- `add table` falla si la tabla ya está en la publicación; el guard lo evita
-- para que la migración sea idempotente.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversations'
  ) then
    alter publication supabase_realtime add table public.conversations;
  end if;
end $$;
