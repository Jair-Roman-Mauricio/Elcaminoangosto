-- «Propósito» del curso: texto propio que redacta el maestro, distinto de la
-- descripción general.
alter table public.courses
  add column if not exists purpose text;

-- El maestro puede editar el propósito (como title/description).
grant update (purpose) on public.courses to authenticated;
