-- Datos que la plataforma necesita para funcionar en CUALQUIER entorno.
--
-- Hasta ahora vivían solo en `supabase/seed.sql`, que corre en local y en CI
-- pero nunca en un despliegue (`supabase db push` no ejecuta el seed, y hace
-- bien: los datos de prueba no deben llegar a producción). El resultado era un
-- entorno desplegado sin niveles y sin ninguna cuenta con la que entrar.
--
-- 1. NIVELES. Sin un nivel de rank 1 el trigger `asegurar_nivel_base_estudiante`
--    lanza excepción, así que **nadie podía registrarse**: no es contenido de
--    prueba, es una precondición del modelo.
--
-- 2. CUENTAS DE GOBIERNO. Un ADMIN y un MAESTRO que siempre existan, ya
--    confirmados: sus correos no tienen por qué recibir nada, y sin
--    `email_confirmed_at` la política de ADR-009 impediría entrar.
--
-- La contraseña NO se escribe aquí (AGENTS.md §7: nada de secretos en el
-- repositorio). Se toma de un ajuste de la base y, si no está definido, se
-- genera una aleatoria y se avisa: la cuenta existe, pero hay que fijarle
-- contraseña antes de usarla. Ver el final del archivo.

-- ─── 1. Niveles ────────────────────────────────────────────────────────────
insert into public.levels (id, name, rank, description) values
  ('11111111-1111-4111-8111-000000000001', 'Nuevo en el camino', 1, 'Primeros pasos en la fe.'),
  ('11111111-1111-4111-8111-000000000002', 'Creciendo',          2, 'Fundamentos y disciplinas.'),
  ('11111111-1111-4111-8111-000000000003', 'Discipulando',       3, 'Madurez y servicio.')
on conflict (rank) do nothing;

-- ─── 2. Cuentas de gobierno ────────────────────────────────────────────────

/**
 * Crea una cuenta confirmada con su rol, si no existía ya.
 *
 * Idempotente por correo: repetir la migración no duplica ni pisa la
 * contraseña de una cuenta en uso. Devuelve true si la creó.
 */
create or replace function public.crear_cuenta_inicial(
  correo text,
  nombre text,
  rol public.role,
  clave text
)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  nuevo_id uuid;
begin
  if exists (select 1 from auth.users where email = correo) then
    return false;
  end if;

  nuevo_id := gen_random_uuid();

  -- Mismo conjunto de columnas que usa el seed: GoTrue exige que los campos de
  -- token vayan vacíos, no nulos.
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token,
    email_change_token_new, email_change, email_change_token_current,
    phone_change, phone_change_token, reauthentication_token
  )
  values (
    '00000000-0000-0000-0000-000000000000', nuevo_id,
    'authenticated', 'authenticated', correo,
    crypt(clave, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('display_name', nombre),
    now(), now(), '', '', '', '', '', '', '', ''
  );

  -- El trigger sobre `auth.users` ya insertó el perfil como ESTUDIANTE; aquí se
  -- ajusta al rol que toca.
  update public.profiles set role = rol, display_name = nombre where id = nuevo_id;

  return true;
end;
$$;

comment on function public.crear_cuenta_inicial is
  'Alta idempotente de una cuenta confirmada con rol. Uso: arranque de un entorno.';

do $$
declare
  -- Definido con:  alter database postgres set app.clave_cuentas_iniciales = '…';
  clave text := nullif(current_setting('app.clave_cuentas_iniciales', true), '');
  clave_al_azar boolean := clave is null;
  creadas int := 0;
begin
  if clave_al_azar then
    -- Sin ajuste no se inventa una contraseña conocida: una fija en el
    -- repositorio sería la misma en todos los entornos y para siempre.
    clave := encode(gen_random_bytes(24), 'base64');
  end if;

  if public.crear_cuenta_inicial(
    'admin@elcaminoangosto.test', 'Administración', 'ADMIN', clave
  ) then
    creadas := creadas + 1;
  end if;

  if public.crear_cuenta_inicial(
    'maestro@elcaminoangosto.test', 'Profesor', 'MAESTRO', clave
  ) then
    creadas := creadas + 1;
  end if;

  if creadas > 0 and clave_al_azar then
    raise notice 'Cuentas creadas (%) con contraseña ALEATORIA. Fíjala antes de usarlas:', creadas;
    raise notice '  update auth.users set encrypted_password = crypt(''LA-QUE-QUIERAS'', gen_salt(''bf''))';
    raise notice '   where email in (''admin@elcaminoangosto.test'', ''maestro@elcaminoangosto.test'');';
  end if;
end $$;
