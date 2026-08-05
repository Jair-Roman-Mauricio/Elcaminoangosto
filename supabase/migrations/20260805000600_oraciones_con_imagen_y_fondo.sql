-- Una oración guiada deja de ser una fila de texto y pasa a tener cara.
--
-- En el carrusel se presenta con un recorte sin fondo —no una tarjeta— y al
-- reproducirse necesita algo detrás sobre lo que leer: un video o una imagen a
-- pantalla completa con la letra encima.
--
-- Son dos imágenes distintas y no una: el recorte funciona flotando sobre el
-- negro y el fondo funciona a sangre. Con un solo campo, una de las dos
-- posiciones se vería siempre mal.

alter table public.oraciones_guiadas
  add column imagen_asset_id uuid references public.media_assets(id) on delete set null,
  add column fondo_asset_id uuid references public.media_assets(id) on delete set null;
