-- «Lo que aprenderás»: objetivos de aprendizaje que redacta el propio maestro,
-- en vez de generarse a partir de los títulos de los módulos.
alter table public.courses
  add column if not exists learning_objectives jsonb not null default '[]'::jsonb;

-- Defensa en profundidad: el maestro puede editar esta columna (como title/description).
grant update (learning_objectives) on public.courses to authenticated;
