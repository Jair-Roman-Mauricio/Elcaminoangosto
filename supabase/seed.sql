-- ═══════════════════════════════════════════════════════════════════════════
-- Seed mínimo de desarrollo — El Camino Angosto
--
-- Se aplica con `supabase db reset` en local. NUNCA en producción.
-- Contraseña de todos los usuarios: `camino123`
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Niveles 1..3 ──────────────────────────────────────────────────────────
insert into public.levels (id, name, rank, description) values
  ('11111111-1111-4111-8111-000000000001', 'Nuevo en el camino', 1, 'Primeros pasos en la fe.'),
  ('11111111-1111-4111-8111-000000000002', 'Creciendo',          2, 'Fundamentos y disciplinas.'),
  ('11111111-1111-4111-8111-000000000003', 'Discipulando',       3, 'Madurez y servicio.')
on conflict (rank) do nothing;

-- ─── Usuarios ──────────────────────────────────────────────────────────────
-- Se insertan en `auth.users`; el trigger `crear_perfil_al_registrarse`
-- genera la fila de `profiles` con rol ESTUDIANTE. Después ajustamos roles.
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
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-000000000001',
   'authenticated', 'authenticated', 'admin@elcaminoangosto.test',
   crypt('camino123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Ana Admin"}',
   now(), now(), '', '', '', '', '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-000000000002',
   'authenticated', 'authenticated', 'maestro@elcaminoangosto.test',
   crypt('camino123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Marcos Maestro"}',
   now(), now(), '', '', '', '', '', '', '', ''),

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
  '22222222-2222-4222-8222-000000000001',
  '22222222-2222-4222-8222-000000000002',
  '22222222-2222-4222-8222-000000000003',
  '22222222-2222-4222-8222-000000000004'
)
on conflict do nothing;

-- ─── Roles y niveles ───────────────────────────────────────────────────────
update public.profiles set role = 'ADMIN'
  where id = '22222222-2222-4222-8222-000000000001';

update public.profiles set role = 'MAESTRO'
  where id = '22222222-2222-4222-8222-000000000002';

-- Ester va por el nivel 2; Esteban acaba de empezar (nivel 1).
update public.profiles set current_level_id = '11111111-1111-4111-8111-000000000002'
  where id = '22222222-2222-4222-8222-000000000003';

update public.profiles set current_level_id = '11111111-1111-4111-8111-000000000001'
  where id = '22222222-2222-4222-8222-000000000004';

-- ─── Mentoría ──────────────────────────────────────────────────────────────
insert into public.mentorships (mentor_id, student_id) values
  ('22222222-2222-4222-8222-000000000002', '22222222-2222-4222-8222-000000000003'),
  ('22222222-2222-4222-8222-000000000002', '22222222-2222-4222-8222-000000000004')
on conflict do nothing;

-- ─── Curso publicado de ejemplo ────────────────────────────────────────────
-- Nivel requerido 1 → ambos estudiantes lo ven.
insert into public.courses (
  id, teacher_id, title, slug, description,
  required_level_id, is_free, status, planned_modules, published_at
) values (
  '33333333-3333-4333-8333-000000000001',
  '22222222-2222-4222-8222-000000000002',
  'La puerta angosta',
  'la-puerta-angosta',
  'Un recorrido por Mateo 7 y lo que significa entrar por la puerta angosta.',
  '11111111-1111-4111-8111-000000000001',
  true, 'PUBLISHED', 2, now()
)
on conflict (id) do nothing;

insert into public.course_modules (id, course_id, title, order_index) values
  ('44444444-4444-4444-8444-000000000001', '33333333-3333-4333-8333-000000000001', 'El llamado', 0),
  ('44444444-4444-4444-8444-000000000002', '33333333-3333-4333-8333-000000000001', 'El costo',   1)
on conflict (id) do nothing;

-- Solo lecciones de texto: una lección VIDEO exigiría un `media_assets` real
-- (restricción `lessons_contenido_coherente`).
insert into public.lessons (module_id, title, type, content, order_index) values
  ('44444444-4444-4444-8444-000000000001', 'Entrad por la puerta angosta', 'TEXT',
   'Mateo 7:13–14. Angosta es la puerta, y angosto el camino que lleva a la vida.', 0),
  ('44444444-4444-4444-8444-000000000001', '¿Por qué son pocos los que la hallan?', 'TEXT',
   'Reflexión sobre la exclusividad del camino y la gracia que lo hace posible.', 1),
  ('44444444-4444-4444-8444-000000000002', 'Contad el costo', 'TEXT',
   'Lucas 14:28. Nadie edifica una torre sin sentarse primero a calcular los gastos.', 0)
on conflict do nothing;

-- Ester ya está inscrita.
insert into public.enrollments (student_id, course_id) values
  ('22222222-2222-4222-8222-000000000003', '33333333-3333-4333-8333-000000000001')
on conflict do nothing;
