-- Alabanza: el fondo y los subtítulos dejan de ser URL escritas a mano.
--
-- FONDO. Puede ser una imagen o un video, y cada uno vive en un sitio distinto:
--   · imagen → bucket público `thumbnails` (URL permanente, como las portadas)
--   · video  → `media_assets` (privado, transcodificado, servido firmado)
-- Por eso son dos columnas y no una: el tipo ya no es una etiqueta suelta, se
-- deduce de cuál está rellena.
--
-- SUBTÍTULOS. El `.srt` es un archivo de texto pequeño y ningún bucket acepta
-- ese tipo. Se guarda su CONTENIDO: el cliente ya sabe interpretarlo
-- (`parsearSrt`), así que se ahorra una petición y un bucket nuevo.
alter table public.songs
  add column if not exists background_asset_id uuid
    references public.media_assets (id) on delete set null,
  add column if not exists subtitles_srt text;

-- `subtitles_url` se sustituye por el contenido; no había datos que conservar.
alter table public.songs drop column if exists subtitles_url;

comment on column public.songs.background_url is 'Fondo de imagen: URL pública';
comment on column public.songs.background_asset_id is 'Fondo de video: medio privado';
comment on column public.songs.subtitles_srt is 'Contenido del .srt con la letra';
