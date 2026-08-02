-- Indicaciones de cambio del admin sobre recursos concretos de un curso en
-- revisión (HU-5.2). El admin las crea desde el canvas de revisión y el profesor
-- las ve en su editor, junto a cada recurso, para saber qué corregir.
--
-- resource_type: LESSON | DESCRIPTION | PURPOSE | OBJECTIVES | COVER | MODULE | COURSE
-- resource_id: id de la lección/módulo; nulo para recursos del curso.
create table if not exists public.content_observations (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  resource_type text not null,
  resource_id uuid,
  note text not null,
  created_by uuid not null references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists content_observations_course_idx
  on public.content_observations (course_id);

alter table public.content_observations enable row level security;
alter table public.content_observations force row level security;

-- El admin gestiona (crea/edita/borra) las indicaciones.
create policy content_observations_admin_all on public.content_observations
  for all to authenticated
  using (public.es_admin())
  with check (public.es_admin());

-- El profesor dueño del curso puede leer las indicaciones de su curso.
create policy content_observations_owner_read on public.content_observations
  for select to authenticated
  using (
    exists (
      select 1 from public.courses c
      where c.id = content_observations.course_id and c.teacher_id = auth.uid()
    )
  );
