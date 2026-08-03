-- ═══════════════════════════════════════════════════════════════════════════
-- Seed mínimo de desarrollo — El Camino Angosto
--
-- Se aplica con `supabase db reset` en local. NUNCA en producción.
-- Contraseña de todos los usuarios: `camino123`
-- Solo quedan cuentas: el contenido se publica desde el panel de admin.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Usuarios ──────────────────────────────────────────────────────────────
-- El ADMIN y el MAESTRO los crea la migración `20260802000100`, porque deben
-- existir en TODO entorno y no solo aquí. El seed no los repite —chocaría con
-- el índice único de correo— y se limita a ponerles la clave de desarrollo.
-- Sus id los decide la migración, así que abajo se buscan por correo.
update auth.users
set encrypted_password = crypt('camino123', gen_salt('bf'))
where email in ('admin@elcaminoangosto.test', 'maestro@elcaminoangosto.test');

-- Los estudiantes de ejemplo sí son datos de prueba y viven solo aquí.
-- Se insertan en `auth.users`; el trigger `crear_perfil_al_registrarse`
-- genera la fila de `profiles` con rol ESTUDIANTE.
-- Los campos de token van a '' y NO a NULL: GoTrue los escanea a `string` en Go
-- y un NULL revienta el login con
-- `converting NULL to string is unsupported` → 500 "Database error querying schema".
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token,
  email_change_token_new, email_change, email_change_token_current,
  phone_change, phone_change_token, reauthentication_token
)
values
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-000000000003',
   'authenticated', 'authenticated', 'ester@elcaminoangosto.test',
   crypt('camino123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Ester Estudiante"}',
   now(), now(), '', '', '', '', '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-000000000004',
   'authenticated', 'authenticated', 'esteban@elcaminoangosto.test',
   crypt('camino123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Esteban Estudiante"}',
   now(), now(), '', '', '', '', '', '', '', '')
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
select id, id, id::text,
       json_build_object('sub', id::text, 'email', email)::jsonb,
       'email', now(), now()
from auth.users
where id in (
  '22222222-2222-4222-8222-000000000003',
  '22222222-2222-4222-8222-000000000004'
)
on conflict do nothing;

-- El discipulado (cursos, lecciones, inscripciones), la mentoría y los niveles
-- se eliminaron del producto; con ellos se fueron sus datos de ejemplo.
