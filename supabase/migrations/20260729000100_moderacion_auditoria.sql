-- Auditoría de moderación (HU-7.2) y cerrojo RLS del contenido no aprobado.
--
-- 1) `moderation_actions`: toda decisión del admin sobre un curso publicado
--    (aprobar/bloquear un contenido, bloquear/reactivar el curso) queda
--    registrada. Es un registro de auditoría: nadie lo edita ni lo borra.
-- 2) Índice para la cola de moderación (solo lo que no está aprobado).
-- 3) RLS: el estudiante no ve cursos bloqueados ni contenido sin aprobar.
--    La autorización primaria vive en los guards del API; esto es el segundo
--    cerrojo (arquitectura.md §5).

-- ─── 1. Bitácora de moderación ─────────────────────────────────────────────
create table if not exists public.moderation_actions (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references public.courses (id) on delete cascade,
  -- Referencia deliberada SIN clave ajena: la bitácora debe sobrevivir al
  -- borrado de la lección que la originó. `lesson_title` guarda el nombre que
  -- tenía en el momento de la decisión.
  lesson_id    uuid,
  lesson_title text,
  action       text not null,
  moderator_id uuid not null references public.profiles (id) on delete restrict,
  created_at   timestamptz not null default now(),
  constraint moderation_actions_accion_valida check (
    action in (
      'LESSON_APPROVED', 'LESSON_PENDING', 'LESSON_BLOCKED',
      'COURSE_BLOCKED', 'COURSE_UNBLOCKED'
    )
  ),
  -- Una decisión sobre un contenido siempre identifica la lección; una
  -- decisión sobre el curso, nunca.
  constraint moderation_actions_objetivo check (
    (action like 'LESSON\_%') = (lesson_id is not null)
  )
);

create index if not exists moderation_actions_course_idx
  on public.moderation_actions (course_id, created_at desc);

alter table public.moderation_actions enable row level security;
alter table public.moderation_actions force row level security;

-- Solo el admin registra decisiones; nadie las modifica ni las borra.
create policy moderation_actions_admin_leer on public.moderation_actions
  for select to authenticated using (public.es_admin());

create policy moderation_actions_admin_crear on public.moderation_actions
  for insert to authenticated
  with check (public.es_admin() and moderator_id = auth.uid());

-- El maestro dueño lee la bitácora de su curso: así sabe qué corregir.
create policy moderation_actions_owner_leer on public.moderation_actions
  for select to authenticated using (public.es_dueno_del_curso(course_id));

-- ─── 2. Índice de la cola de moderación ────────────────────────────────────
create index if not exists lessons_moderacion_pendiente_idx
  on public.lessons (moderation_status)
  where moderation_status <> 'APPROVED';

-- ─── 3. RLS: ocultar lo bloqueado y lo no aprobado ─────────────────────────
-- Un curso bloqueado deja de existir para el estudiante; el maestro dueño y el
-- admin lo siguen viendo (el maestro necesita corregirlo).
drop policy if exists courses_leer on public.courses;
create policy courses_leer on public.courses for select to authenticated
using (
  public.es_admin()
  or teacher_id = auth.uid()
  or (
    status = 'PUBLISHED'
    and blocked = false
    and (
      required_level_id is null
      or public.nivel_actual() >= (select rank from public.levels where id = required_level_id)
    )
  )
);

-- Un contenido nuevo o cambiado (PENDING) o retirado (BLOCKED) no lo ve el
-- estudiante inscrito hasta que el admin lo apruebe.
drop policy if exists lessons_leer on public.lessons;
create policy lessons_leer on public.lessons for select to authenticated
using (
  exists (
    select 1 from public.course_modules m
     where m.id = module_id
       and (
         public.es_admin()
         or public.es_dueno_del_curso(m.course_id)
         or (public.esta_inscrito(m.course_id) and lessons.moderation_status = 'APPROVED')
       )
  )
);
