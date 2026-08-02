-- Evaluaciones: nuevo tipo de lección EXAM y sus preguntas.

-- 1) Añadir el valor al enum de tipo de lección.
alter type lesson_type add value if not exists 'EXAM';

-- 2) Preguntas de la evaluación (array JSON: { enunciado, opciones[], correcta }).
alter table public.lessons
  add column if not exists questions jsonb not null default '[]'::jsonb;

-- 3) El maestro puede editar las preguntas de sus lecciones.
grant update (questions) on public.lessons to authenticated;

-- NOTA: el check de coherencia que contempla EXAM (y luego IMAGE) vive en
-- `20260724000400_lecciones_coherencia.sql`, en su propio archivo: un valor de
-- enum recién añadido no puede usarse en la misma transacción que lo crea.
