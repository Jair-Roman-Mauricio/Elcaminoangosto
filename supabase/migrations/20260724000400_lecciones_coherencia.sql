-- Coherencia de contenido por tipo de lección, ahora incluyendo IMAGE.
-- Una lección IMAGE guarda su galería (array JSON de URLs) en `content`.
alter table public.lessons drop constraint if exists lessons_contenido_coherente;
alter table public.lessons add constraint lessons_contenido_coherente check (
  (type = 'VIDEO' and media_asset_id is not null)
  or (type = 'TEXT' and content is not null)
  or (type = 'EXAM' and jsonb_array_length(questions) > 0)
  or (type = 'IMAGE' and content is not null)
);
