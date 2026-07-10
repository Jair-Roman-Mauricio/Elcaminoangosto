\pset pager off
\set QUIET on
set client_min_messages = notice;

-- Fixtures extra (como postgres, que tiene BYPASSRLS).
insert into public.courses (id, teacher_id, title, slug, required_level_id, status, published_at)
values ('99999999-9999-4999-8999-000000000009','22222222-2222-4222-8222-000000000002',
        'Curso avanzado','curso-avanzado','11111111-1111-4111-8111-000000000003','PUBLISHED', now())
on conflict do nothing;

insert into public.courses (id, teacher_id, title, slug, status)
values ('99999999-9999-4999-8999-000000000010','22222222-2222-4222-8222-000000000002',
        'Borrador propio','borrador-propio','DRAFT')
on conflict do nothing;

insert into public.conversations (id, mentor_id, student_id)
values ('88888888-8888-4888-8888-000000000001','22222222-2222-4222-8222-000000000002',
        '22222222-2222-4222-8222-000000000003') on conflict do nothing;
insert into public.messages (conversation_id, sender_id, body)
values ('88888888-8888-4888-8888-000000000001','22222222-2222-4222-8222-000000000003','Hola mentor')
on conflict do nothing;

insert into public.media_assets (id, owner_id, bucket, path, kind, status)
values ('77777777-7777-4777-8777-000000000001','22222222-2222-4222-8222-000000000002',
        'feed-media','22222222-2222-4222-8222-000000000002/a.mp4','VIDEO','READY') on conflict do nothing;
insert into public.posts (id, author_id, type, media_asset_id, caption, status, published_at)
values ('66666666-6666-4666-8666-000000000001','22222222-2222-4222-8222-000000000002',
        'VIDEO','77777777-7777-4777-8777-000000000001','Tarjeta','HIDDEN', now()) on conflict do nothing;

-- Helpers de aserción y de suplantación de usuario.
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

create or replace function pg_temp.como_postgres() returns void
language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

do $$
declare
  ADMIN   constant text := '22222222-2222-4222-8222-000000000001';
  MAESTRO constant text := '22222222-2222-4222-8222-000000000002';
  ESTER   constant text := '22222222-2222-4222-8222-000000000003';
  ESTEBAN constant text := '22222222-2222-4222-8222-000000000004';
  CURSO_DRAFT constant uuid := '99999999-9999-4999-8999-000000000010';
  POST_OCULTO constant uuid := '66666666-6666-4666-8666-000000000001';
  fallos int := 0;
  n int;
  r text;
  s text;
begin
  raise notice '';
  raise notice '── RLS activo en todas las tablas ──';
  select count(*) into n from pg_class c join pg_namespace ns on ns.oid=c.relnamespace
    where ns.nspname='public' and c.relkind='r' and not c.relrowsecurity;
  fallos := fallos + pg_temp.afirmar('0 tablas sin RLS (hay '||n||')', n = 0);

  raise notice '';
  raise notice '── Catálogo por nivel (HU-4.1) ──';
  perform pg_temp.como(ESTEBAN);
  select count(*) into n from public.courses;
  fallos := fallos + pg_temp.afirmar('Esteban (nivel 1) ve 1 curso, no el de nivel 3 (ve '||n||')', n = 1);

  perform pg_temp.como(ESTER);
  select count(*) into n from public.courses;
  fallos := fallos + pg_temp.afirmar('Ester (nivel 2) tampoco ve el de nivel 3 (ve '||n||')', n = 1);

  perform pg_temp.como(MAESTRO);
  select count(*) into n from public.courses;
  fallos := fallos + pg_temp.afirmar('El maestro ve TODOS los suyos, en cualquier estado (ve '||n||')', n = 3);

  perform pg_temp.como(ADMIN);
  select count(*) into n from public.courses;
  fallos := fallos + pg_temp.afirmar('El admin ve todo (ve '||n||')', n = 3);

  raise notice '';
  raise notice '── Escalada de privilegios ──';
  perform pg_temp.como(ESTEBAN);
  begin
    update public.profiles set role = 'ADMIN' where id = ESTEBAN::uuid;
    fallos := fallos + pg_temp.afirmar('Un estudiante NO se asciende a ADMIN', false);
  exception when insufficient_privilege then
    fallos := fallos + pg_temp.afirmar('Un estudiante NO se asciende a ADMIN', true);
  end;

  begin
    update public.profiles set current_level_id = '11111111-1111-4111-8111-000000000003'
      where id = ESTEBAN::uuid;
    fallos := fallos + pg_temp.afirmar('Un estudiante NO se sube de nivel solo', false);
  exception when insufficient_privilege then
    fallos := fallos + pg_temp.afirmar('Un estudiante NO se sube de nivel solo', true);
  end;

  update public.profiles set display_name = 'Esteban E.' where id = ESTEBAN::uuid;
  select display_name into r from public.profiles where id = ESTEBAN::uuid;
  fallos := fallos + pg_temp.afirmar('...pero SÍ edita su nombre (HU-1.1)', r = 'Esteban E.');

  raise notice '';
  raise notice '── Gobernanza de cursos (regla inviolable) ──';
  perform pg_temp.como(MAESTRO);
  begin
    update public.courses set status='PUBLISHED', published_at=now() where id = CURSO_DRAFT;
    fallos := fallos + pg_temp.afirmar('Un maestro NO autopublica su curso', false);
  exception when insufficient_privilege or check_violation then
    fallos := fallos + pg_temp.afirmar('Un maestro NO autopublica su curso', true);
  end;

  update public.courses set status='SUBMITTED' where id = CURSO_DRAFT;
  select status::text into s from public.courses where id = CURSO_DRAFT;
  fallos := fallos + pg_temp.afirmar('...pero SÍ lo envía a revisión (HU-5.1)', s = 'SUBMITTED');
  perform pg_temp.como_postgres();
  update public.courses set status='DRAFT' where id = CURSO_DRAFT;

  raise notice '';
  raise notice '── Moderación (HU-7.2) ──';
  perform pg_temp.como(MAESTRO);
  begin
    update public.posts set status='PUBLISHED' where id = POST_OCULTO;
    fallos := fallos + pg_temp.afirmar('El autor NO revierte la ocultación de su tarjeta', false);
  exception when insufficient_privilege then
    fallos := fallos + pg_temp.afirmar('El autor NO revierte la ocultación de su tarjeta', true);
  end;

  raise notice '';
  raise notice '── Contenido gated por inscripción (HU-4.2) ──';
  perform pg_temp.como(ESTEBAN);
  select count(*) into n from public.lessons;
  fallos := fallos + pg_temp.afirmar('Esteban (no inscrito) no lee lecciones (lee '||n||')', n = 0);

  perform pg_temp.como(ESTER);
  select count(*) into n from public.lessons;
  fallos := fallos + pg_temp.afirmar('Ester (inscrita) lee las 3 lecciones (lee '||n||')', n = 3);

  raise notice '';
  raise notice '── Chat privado (HU-6.1) ──';
  perform pg_temp.como(ESTEBAN);
  select count(*) into n from public.messages;
  fallos := fallos + pg_temp.afirmar('Un tercero no ve la conversación ajena (ve '||n||')', n = 0);

  perform pg_temp.como(MAESTRO);
  select count(*) into n from public.messages;
  fallos := fallos + pg_temp.afirmar('El mentor sí ve su conversación (ve '||n||')', n = 1);

  perform pg_temp.como(ADMIN);
  select count(*) into n from public.messages;
  fallos := fallos + pg_temp.afirmar('El admin ve la conversación (moderación) (ve '||n||')', n = 1);

  raise notice '';
  raise notice '── Música publicada (HU-2.2) ──';
  perform pg_temp.como_postgres();
  insert into public.artists (id, name) values ('55555555-5555-4555-8555-000000000001','Artista')
    on conflict do nothing;
  insert into public.songs (id, artist_id, title, is_published) values
    ('55555555-5555-4555-8555-000000000002','55555555-5555-4555-8555-000000000001','Publicada', true),
    ('55555555-5555-4555-8555-000000000003','55555555-5555-4555-8555-000000000001','Borrador', false)
    on conflict do nothing;

  perform pg_temp.como(ESTER);
  select count(*) into n from public.songs;
  fallos := fallos + pg_temp.afirmar('El estudiante solo ve canciones publicadas (ve '||n||')', n = 1);

  perform pg_temp.como_postgres();
  raise notice '';
  if fallos = 0 then
    raise notice '════ TODAS LAS COMPROBACIONES PASAN ════';
  else
    raise exception '════ % COMPROBACIONES FALLARON ════', fallos;
  end if;
end;
$$;
