-- Ficha de una Tarjeta de Fe (HU-3.3).
--
-- La pantalla del feed ya mostraba título, manifiesto, relato, origen y
-- referencia, pero la tabla solo guardaba `caption`: esos campos se inventaban
-- en el cliente a partir del texto. Aquí pasan a ser datos de verdad, que el
-- admin rellena al publicar.
--
-- Todo es opcional salvo el medio: una tarjeta antigua (solo con `caption`)
-- sigue siendo válida y el cliente la completa como antes.
alter table public.posts
  add column if not exists title text,
  add column if not exists manifesto text,
  -- Relato completo. Los párrafos se separan con una línea en blanco.
  add column if not exists story text,
  add column if not exists origin text,
  add column if not exists reference text,
  -- Relato hablado, opcional. Si se borra el medio, la tarjeta sobrevive.
  add column if not exists audio_asset_id uuid
    references public.media_assets (id) on delete set null;

comment on column public.posts.manifesto is 'Frase destacada de la tarjeta';
comment on column public.posts.story is 'Relato; párrafos separados por línea en blanco';
comment on column public.posts.reference is 'Referencia bíblica (p. ej. Mateo 7:13–14)';
