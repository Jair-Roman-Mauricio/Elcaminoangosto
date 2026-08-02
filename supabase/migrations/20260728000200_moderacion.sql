-- Moderación de cursos ya publicados (HU-7.2).
-- Un contenido nuevo o cambiado en un curso publicado pasa a PENDING y queda
-- oculto al alumno hasta que el admin lo apruebe. Si el admin pide corregirlo,
-- queda BLOCKED. Un curso puede bloquearse por completo (blocked = true).
do $$
begin
  if not exists (select 1 from pg_type where typname = 'moderation_status') then
    create type moderation_status as enum ('APPROVED', 'PENDING', 'BLOCKED');
  end if;
end $$;

alter table public.lessons
  add column if not exists moderation_status moderation_status not null default 'APPROVED';

alter table public.courses
  add column if not exists blocked boolean not null default false;
