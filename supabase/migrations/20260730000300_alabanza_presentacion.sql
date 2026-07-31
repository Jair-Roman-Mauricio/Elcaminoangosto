-- Alabanza: campos de presentación de álbumes y canciones (HU-9.2).
--
-- Las tablas `artists`, `albums` y `songs` existían desde el esquema inicial,
-- pero solo con los datos "de catálogo" (título, artista, audio, duración). La
-- pantalla de Alabanza muestra además una identidad visual por álbum (número,
-- tono, color del disco) y por canción (subtítulo, fondo, subtítulos del
-- karaoke). Eso vivía en un fichero del cliente; aquí pasa a ser dato.
--
-- Las portadas y los fondos son URL públicas (mismo criterio que la portada de
-- un curso): no son medios privados y no necesitan firma ni transcodificación.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'alabanza_tono') then
    create type alabanza_tono as enum ('vino', 'marfil', 'azul');
  end if;
end $$;

alter table public.albums
  -- Número de catálogo visible: A01, A02…
  add column if not exists number text,
  add column if not exists description text,
  add column if not exists cover_image_url text,
  add column if not exists tone alabanza_tono not null default 'vino',
  -- Color del vinilo en la portada animada.
  add column if not exists disc_color text;

alter table public.songs
  -- Posición dentro del álbum: 01, 02…
  add column if not exists track_number integer,
  add column if not exists subtitle text,
  add column if not exists tone alabanza_tono not null default 'vino',
  -- Fondo de la reproducción: una imagen o un video.
  add column if not exists background_url text,
  add column if not exists background_type text,
  -- Pista de subtítulos (.srt) para la letra.
  add column if not exists subtitles_url text;

alter table public.songs drop constraint if exists songs_background_type_check;
alter table public.songs add constraint songs_background_type_check
  check (background_type is null or background_type in ('imagen', 'video'));

comment on column public.albums.tone is 'Identidad visual del álbum en la pantalla de Alabanza';
comment on column public.songs.background_type is 'imagen | video: qué se ve al reproducir';

-- El catálogo ordena por álbum y número de pista.
create index if not exists songs_album_track_idx
  on public.songs (album_id, track_number);
