-- ═══════════════════════════════════════════════════════════════════════════
-- Privilegios de tabla (GRANT)
--
-- ⚠️ RLS NO concede permisos: los RESTRINGE. Una política `for select using
-- (true)` no sirve de nada si el rol carece del privilegio `SELECT` sobre la
-- tabla; Postgres responde `permission denied` antes de evaluarla.
--
-- Las tablas creadas por nuestras migraciones solo heredaban
-- `REFERENCES, TRIGGER, TRUNCATE` de los default privileges de Supabase.
-- Aquí concedemos el DML y dejamos que RLS filtre las filas.
--
-- `anon` queda deliberadamente FUERA: la plataforma exige sesión y la landing
-- es estática. Ampliarlo requiere una decisión explícita.
-- ═══════════════════════════════════════════════════════════════════════════

grant usage on schema public to authenticated, service_role;

-- El DML lo gobierna RLS fila a fila (migración 20260709000200_rls.sql).
grant select, insert, update, delete on all tables in schema public to authenticated;

-- `service_role` tiene BYPASSRLS: solo el API la usa, en operaciones
-- administrativas controladas (arquitectura.md §5).
grant all on all tables in schema public to service_role;

grant execute on all functions in schema public to authenticated, service_role;

-- Que las tablas y funciones futuras nazcan con los mismos privilegios.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

alter default privileges in schema public
  grant all on tables to service_role;

alter default privileges in schema public
  grant execute on functions to authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- Privilegios de COLUMNA — cierre de escalada de privilegios
--
-- RLS filtra FILAS, no COLUMNAS. Una política `update using (id = auth.uid())`
-- deja al usuario tocar CUALQUIER columna de su propia fila. Verificado: un
-- ESTUDIANTE podía ejecutar `update profiles set role='ADMIN' where id = <yo>`
-- y ascenderse. Postgres solo lo impide con grants por columna.
-- ═══════════════════════════════════════════════════════════════════════════

-- `role` y `current_level_id` son campos de gobernanza:
--   · el rol lo asigna un ADMIN (HU-1.2),
--   · el nivel lo aprueba un MENTOR (HU-6.2),
-- y ambos pasan SIEMPRE por el API con `service_role`, que ignora estos grants.
revoke update on public.profiles from authenticated;
grant update (display_name, bio, avatar_url) on public.profiles to authenticated;

-- El autor edita el texto de su tarjeta, pero NO su `status`: si no, podría
-- revertir una ocultación de moderación (HU-7.2) volviendo a 'PUBLISHED'.
revoke update on public.posts from authenticated;
grant update (caption) on public.posts to authenticated;

-- El maestro no reasigna la autoría ni fuerza la publicación de su curso.
-- Las transiciones de estado las ejecuta el API tras validar la máquina de
-- estados (packages/shared-types/src/course-status.ts).
revoke update on public.courses from authenticated;
grant update (title, description, thumbnail_asset_id, required_level_id, is_free, planned_modules, status)
  on public.courses to authenticated;
