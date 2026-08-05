-- La puesta en página de un devocional: su ilustración y su fondo.
--
-- Un devocional no se lee como un artículo de revista. El artículo abre con una
-- foto a sangre y baja en una columna; el devocional se presenta de una vez —el
-- texto a un lado, una ilustración recortada al otro— y por eso necesita dos
-- cosas que la portada de la tarjeta no cubre.
--
-- La ilustración va aparte de la portada a propósito: la portada es la foto que
-- vende la tarjeta en el listado, y la ilustración es un recorte sin fondo que
-- solo funciona dentro. Meterlas en el mismo campo obligaba a elegir cuál de
-- los dos trabajos hacía peor la misma imagen.

alter table public.lecturas
  add column ilustracion_asset_id uuid references public.media_assets(id) on delete set null;

-- Qué se ve detrás. Nulo es el fondo liso de la plataforma; si no, la clave de
-- uno de los telones que trae la interfaz. Se guarda la clave y no el dibujo
-- para poder retocarlos sin tocar lo ya publicado.
alter table public.lecturas add column fondo text;

alter table public.lecturas add constraint lecturas_fondo_conocido
  check (fondo is null or fondo in ('brasas', 'vitral', 'ondas', 'polvo'));
