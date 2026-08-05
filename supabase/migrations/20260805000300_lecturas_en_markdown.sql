-- El cuerpo de una lectura pasa de lista de párrafos a Markdown.
--
-- Un artículo de revista de verdad no es una tira de párrafos: tiene
-- subtítulos que parten el texto en secciones, imágenes dentro de cada una y
-- más imágenes al cierre. Guardar `text[]` obligaba a inventar un campo por
-- cada cosa nueva; Markdown ya sabe expresar todo eso y además es lo que
-- escupe el editor que ya vive en la plataforma.
--
-- Las imágenes van al bucket público `thumbnails`, así que su URL es
-- permanente y puede viajar dentro del propio texto sin caducar.

alter table public.lecturas add column cuerpo text;

-- Lo ya publicado se conserva: cada párrafo separado por una línea en blanco,
-- que es exactamente un párrafo en Markdown.
update public.lecturas set cuerpo = array_to_string(parrafos, E'\n\n');

alter table public.lecturas alter column cuerpo set not null;
alter table public.lecturas add constraint lecturas_cuerpo_no_vacio
  check (length(btrim(cuerpo)) > 0);

alter table public.lecturas drop column parrafos;
