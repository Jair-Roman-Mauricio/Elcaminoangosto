\pset pager off
\set QUIET on
set client_min_messages = notice;

-- Suite de RLS de una plataforma ABIERTA.
--
-- Lo que se comprueba cambió de raíz al desaparecer alumnos y profesores: ya no
-- hay niveles, inscripciones ni conversaciones que aislar. Queda una regla
-- sencilla y dos maneras de romperla:
--
--   · Cualquiera —con cuenta o sin ella— lee lo PUBLICADO.
--   · Nadie salvo el admin escribe, ni ve lo que aún no está publicado.
--
-- El admin lo crea la migración `20260802000100` con id generado, así que se
-- busca por correo en vez de darlo por sabido.
select (select id from auth.users where email = 'admin@elcaminoangosto.test') as admin_id
\gset

-- El bloque `do` no puede leerlo como :'variable' —psql no interpola dentro de
-- $$…$$—, así que viaja por un ajuste de sesión.
select set_config('prueba.admin_id', :'admin_id', false);

-- Fixtures: de cada clase, una pieza publicada y otra sin publicar. Así se
-- distingue «no lo ve porque está oculto» de «no ve nada».
insert into public.media_assets (id, owner_id, bucket, path, kind, status)
values ('77777777-7777-4777-8777-000000000001', :'admin_id',
        'feed-media', concat(:'admin_id', '/a.mp4'), 'VIDEO', 'READY')
on conflict do nothing;

insert into public.posts (id, author_id, type, media_asset_id, caption, status, published_at)
values
  ('66666666-6666-4666-8666-000000000001', :'admin_id', 'VIDEO',
   '77777777-7777-4777-8777-000000000001', 'Tarjeta oculta', 'HIDDEN', now()),
  ('66666666-6666-4666-8666-000000000002', :'admin_id', 'VIDEO',
   '77777777-7777-4777-8777-000000000001', 'Tarjeta publicada', 'PUBLISHED', now())
on conflict do nothing;

insert into public.videos (id, title, media_asset_id, created_by, status, published_at)
values
  ('55555555-5555-4555-8555-000000000001', 'Video oculto',
   '77777777-7777-4777-8777-000000000001', :'admin_id', 'HIDDEN', now()),
  ('55555555-5555-4555-8555-000000000002', 'Video visible',
   '77777777-7777-4777-8777-000000000001', :'admin_id', 'PUBLISHED', now())
on conflict do nothing;

insert into public.artists (id, name)
values ('44444444-4444-4444-8444-000000000001', 'Artista de prueba')
on conflict do nothing;

insert into public.songs (id, artist_id, title, is_published) values
  ('33333333-3333-4333-8333-000000000001', '44444444-4444-4444-8444-000000000001', 'Borrador', false),
  ('33333333-3333-4333-8333-000000000002', '44444444-4444-4444-8444-000000000001', 'Publicada', true)
on conflict do nothing;

-- Helpers de aserción y de suplantación.
create or replace function pg_temp.afirmar(etiqueta text, ok boolean) returns int
language plpgsql as $$
begin
  if ok then
    raise notice '  PASA  %', etiqueta;
    return 0;
  else
    raise warning '  FALLA %', etiqueta;
    return 1;
  end if;
end;
$$;

create or replace function pg_temp.como(usuario text) returns void
language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', usuario, 'role', 'authenticated')::text, true);
end;
$$;

-- Visitante sin cuenta: en esta plataforma es el caso normal, no la excepción.
create or replace function pg_temp.como_anonimo() returns void
language plpgsql as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
end;
$$;

create or replace function pg_temp.como_postgres() returns void
language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

do $$
declare
  ADMIN constant text := current_setting('prueba.admin_id');
  POST_OCULTO     constant uuid := '66666666-6666-4666-8666-000000000001';
  POST_VISIBLE    constant uuid := '66666666-6666-4666-8666-000000000002';
  VIDEO_OCULTO    constant uuid := '55555555-5555-4555-8555-000000000001';
  VIDEO_VISIBLE   constant uuid := '55555555-5555-4555-8555-000000000002';
  ARTISTA         constant uuid := '44444444-4444-4444-8444-000000000001';
  CANCION_OCULTA  constant uuid := '33333333-3333-4333-8333-000000000001';
  CANCION_VISIBLE constant uuid := '33333333-3333-4333-8333-000000000002';
  fallos int := 0;
  n int;
begin
  raise notice '';
  raise notice '-- RLS activo en todas las tablas --';
  select count(*) into n from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
    where ns.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  fallos := fallos + pg_temp.afirmar('0 tablas sin RLS (hay ' || n || ')', n = 0);

  raise notice '';
  raise notice '-- Contenido abierto: se lee SIN cuenta --';
  perform pg_temp.como_anonimo();

  -- Se cuentan SOLO las piezas de esta suite: la base puede traer contenido
  -- real y un total absoluto haría fallar la prueba por motivos ajenos.
  select count(*) into n from public.posts where id = POST_VISIBLE;
  fallos := fallos + pg_temp.afirmar('Un visitante lee la tarjeta publicada', n = 1);

  select count(*) into n from public.videos where id = VIDEO_VISIBLE;
  fallos := fallos + pg_temp.afirmar('...y el video publicado', n = 1);

  select count(*) into n from public.songs where id = CANCION_VISIBLE;
  fallos := fallos + pg_temp.afirmar('...y la canción publicada', n = 1);

  select count(*) into n from public.artists where id = ARTISTA;
  fallos := fallos + pg_temp.afirmar('...y el artista del catálogo', n = 1);

  raise notice '';
  raise notice '-- Lo no publicado sigue siendo privado --';
  select count(*) into n from public.posts where id = POST_OCULTO;
  fallos := fallos + pg_temp.afirmar('Un visitante NO ve una tarjeta oculta', n = 0);

  select count(*) into n from public.videos where id = VIDEO_OCULTO;
  fallos := fallos + pg_temp.afirmar('...ni un video oculto', n = 0);

  select count(*) into n from public.songs where id = CANCION_OCULTA;
  fallos := fallos + pg_temp.afirmar('...ni una cancion sin publicar', n = 0);

  raise notice '';
  raise notice '-- Escribir es cosa del admin --';
  begin
    insert into public.videos (title, media_asset_id, created_by, status)
    values ('Colado', '77777777-7777-4777-8777-000000000001', ADMIN::uuid, 'PUBLISHED');
    fallos := fallos + pg_temp.afirmar('Un visitante NO publica videos', false);
  exception when others then
    fallos := fallos + pg_temp.afirmar('Un visitante NO publica videos', true);
  end;

  -- Sin permiso de UPDATE la sentencia lanza excepcion; con permiso pero sin
  -- politica no afectaria filas. Se comprueban las dos salidas.
  begin
    update public.posts set status = 'PUBLISHED' where id = POST_OCULTO;
  exception when others then
    null;
  end;
  perform pg_temp.como_postgres();
  select count(*) into n from public.posts where id = POST_OCULTO and status = 'HIDDEN';
  fallos := fallos + pg_temp.afirmar('Un visitante NO desoculta una tarjeta', n = 1);
  perform pg_temp.como_anonimo();

  raise notice '';
  raise notice '-- Las colecciones de favoritos no se leen desde el cliente --';
  -- No tienen politica: se entra por el API, que es quien conoce el codigo. Si
  -- alguna vez se les anadiera una, cualquiera podria enumerar las colecciones
  -- ajenas, y esta comprobacion lo delataria.
  select count(*) into n from pg_policies
    where schemaname = 'public'
      and tablename in ('colecciones', 'coleccion_favoritos', 'coleccion_albumes',
                        'coleccion_album_canciones');
  fallos := fallos + pg_temp.afirmar('0 politicas sobre las colecciones (hay ' || n || ')', n = 0);

  raise notice '';
  raise notice '-- El admin si lo ve todo --';
  perform pg_temp.como(ADMIN);

  select count(*) into n from public.posts where id in (POST_OCULTO, POST_VISIBLE);
  fallos := fallos + pg_temp.afirmar('El admin ve tambien lo oculto', n = 2);

  select count(*) into n from public.songs where id in (CANCION_OCULTA, CANCION_VISIBLE);
  fallos := fallos + pg_temp.afirmar('...y las canciones sin publicar', n = 2);

  perform pg_temp.como_postgres();

  raise notice '';
  if fallos > 0 then
    raise exception '==== % COMPROBACIONES FALLARON ====', fallos;
  end if;
  raise notice '==== TODAS LAS COMPROBACIONES PASARON ====';
end;
$$;
