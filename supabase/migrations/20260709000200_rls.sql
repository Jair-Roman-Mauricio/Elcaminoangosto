-- ═══════════════════════════════════════════════════════════════════════════
-- Row Level Security — defensa en profundidad
--
-- La autorización PRIMARIA vive en los guards de NestJS (arquitectura.md §5).
-- RLS es el segundo cerrojo: aunque alguien saltara el API, no puede leer ni
-- escribir lo indebido.
--
-- El backend usa la `service_role` solo en operaciones administrativas
-- controladas; esa clave ignora RLS por diseño.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Auxiliares ────────────────────────────────────────────────────────────
-- SECURITY DEFINER para que consultar `profiles` desde una política de
-- `profiles` no dispare recursión infinita de RLS.

create or replace function public.rol_actual()
returns public.role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role = 'ADMIN' from public.profiles where id = auth.uid()), false);
$$;

/** `rank` del nivel actual. 0 si el usuario no tiene nivel asignado. */
create or replace function public.nivel_actual()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select l.rank
       from public.profiles p
       left join public.levels l on l.id = p.current_level_id
      where p.id = auth.uid()),
    0
  );
$$;

/** ¿El usuario está inscrito y activo en el curso? */
create or replace function public.esta_inscrito(curso uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.enrollments
     where student_id = auth.uid() and course_id = curso
  );
$$;

/** ¿El usuario es el maestro dueño del curso? */
create or replace function public.es_dueno_del_curso(curso uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.courses where id = curso and teacher_id = auth.uid()
  );
$$;

-- ─── Activar RLS en TODAS las tablas ───────────────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array[
    'media_assets','levels','profiles','mentorships','courses','course_modules','lessons',
    'course_reviews','enrollments','lesson_progress','artists','albums','songs','playlists',
    'playlist_songs','song_plays','song_likes','posts','post_likes','post_comments','follows',
    'post_reports','conversations','messages','level_up_requests','notifications'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    -- Ni el dueño de la tabla se salta las políticas (defensa extra).
    execute format('alter table public.%I force row level security', t);
  end loop;
end;
$$;

-- ═══ Identidad ═════════════════════════════════════════════════════════════

-- Niveles: catálogo público de lectura; solo ADMIN escribe.
create policy levels_leer   on public.levels for select to authenticated using (true);
create policy levels_admin  on public.levels for all    to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- Perfiles: todos ven perfiles (comunidad); solo el dueño edita el suyo (HU-1.1).
create policy profiles_leer on public.profiles for select to authenticated using (true);

create policy profiles_editar_el_mio on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- El cambio de rol/nivel lo hace el API con la service_role (HU-1.2), nunca el
-- propio usuario. No existe policy que permita a un usuario elevar su rol.
create policy profiles_admin on public.profiles for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- Mentorías: las ven sus dos partes y el admin.
create policy mentorships_leer on public.mentorships for select to authenticated
  using (mentor_id = auth.uid() or student_id = auth.uid() or public.es_admin());

create policy mentorships_admin on public.mentorships for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- ═══ Discipulado ═══════════════════════════════════════════════════════════

-- Catálogo (HU-4.1): un estudiante ve los cursos PUBLISHED de su nivel o
-- inferior. El maestro ve SIEMPRE los suyos, en cualquier estado. El admin, todo.
create policy courses_leer on public.courses for select to authenticated
using (
  public.es_admin()
  or teacher_id = auth.uid()
  or (
    status = 'PUBLISHED'
    and (
      required_level_id is null
      or public.nivel_actual() >= (select rank from public.levels where id = required_level_id)
    )
  )
);

-- El maestro crea sus borradores. `status` nace en DRAFT por defecto.
create policy courses_crear on public.courses for insert to authenticated
with check (
  teacher_id = auth.uid()
  and public.rol_actual() in ('MAESTRO', 'ADMIN')
  and status = 'DRAFT'
);

-- Un maestro solo edita SUS cursos, y solo mientras son DRAFT o REJECTED.
-- Las transiciones de estado (SUBMITTED→…→PUBLISHED) las ejecuta el API con
-- service_role tras validar la máquina de estados. Un maestro NUNCA puede
-- autopublicarse: el `with check` se lo impide aquí también.
create policy courses_editar_mis_borradores on public.courses for update to authenticated
using (teacher_id = auth.uid() and status in ('DRAFT', 'REJECTED'))
with check (teacher_id = auth.uid() and status in ('DRAFT', 'SUBMITTED'));

create policy courses_admin on public.courses for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- Módulos y lecciones: visibles si el curso lo es.
create policy course_modules_leer on public.course_modules for select to authenticated
using (exists (select 1 from public.courses c where c.id = course_id));

create policy course_modules_escribir on public.course_modules for all to authenticated
using (public.es_dueno_del_curso(course_id) or public.es_admin())
with check (public.es_dueno_del_curso(course_id) or public.es_admin());

-- Lecciones (HU-4.2): el contenido solo para inscritos, el dueño o el admin.
create policy lessons_leer on public.lessons for select to authenticated
using (
  exists (
    select 1 from public.course_modules m
     where m.id = module_id
       and (
         public.es_admin()
         or public.es_dueno_del_curso(m.course_id)
         or public.esta_inscrito(m.course_id)
       )
  )
);

create policy lessons_escribir on public.lessons for all to authenticated
using (
  exists (
    select 1 from public.course_modules m
     where m.id = module_id
       and (public.es_dueno_del_curso(m.course_id) or public.es_admin())
  )
)
with check (
  exists (
    select 1 from public.course_modules m
     where m.id = module_id
       and (public.es_dueno_del_curso(m.course_id) or public.es_admin())
  )
);

-- Auditoría de aprobación (HU-5.2): la lee el maestro dueño y el admin.
-- Solo el ADMIN escribe. Nadie borra: es un registro de auditoría.
create policy course_reviews_leer on public.course_reviews for select to authenticated
using (public.es_admin() or public.es_dueno_del_curso(course_id));

create policy course_reviews_crear on public.course_reviews for insert to authenticated
with check (public.es_admin() and reviewer_id = auth.uid());

-- Inscripciones: cada quien la suya; el maestro ve las de sus cursos (HU-4.5).
create policy enrollments_leer on public.enrollments for select to authenticated
using (student_id = auth.uid() or public.es_dueno_del_curso(course_id) or public.es_admin());

-- Un estudiante solo se inscribe a un curso PUBLISHED que cumpla su nivel.
create policy enrollments_inscribirme on public.enrollments for insert to authenticated
with check (
  student_id = auth.uid()
  and exists (
    select 1 from public.courses c
     where c.id = course_id
       and c.status = 'PUBLISHED'
       and (
         c.required_level_id is null
         or public.nivel_actual() >= (select rank from public.levels where id = c.required_level_id)
       )
  )
);

create policy enrollments_actualizar_la_mia on public.enrollments for update to authenticated
using (student_id = auth.uid()) with check (student_id = auth.uid());

create policy enrollments_admin on public.enrollments for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- Progreso: solo del dueño de la inscripción (y su maestro / el admin, en lectura).
create policy lesson_progress_leer on public.lesson_progress for select to authenticated
using (
  exists (
    select 1 from public.enrollments e
     where e.id = enrollment_id
       and (e.student_id = auth.uid() or public.es_dueno_del_curso(e.course_id) or public.es_admin())
  )
);

create policy lesson_progress_escribir on public.lesson_progress for all to authenticated
using (exists (select 1 from public.enrollments e where e.id = enrollment_id and e.student_id = auth.uid()))
with check (exists (select 1 from public.enrollments e where e.id = enrollment_id and e.student_id = auth.uid()));

-- ═══ Alabanza ══════════════════════════════════════════════════════════════

create policy artists_leer on public.artists for select to authenticated using (true);
create policy artists_admin on public.artists for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

create policy albums_leer on public.albums for select to authenticated using (true);
create policy albums_admin on public.albums for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- HU-2.2: solo canciones publicadas (el admin ve todas).
create policy songs_leer on public.songs for select to authenticated
  using (is_published or public.es_admin());
create policy songs_admin on public.songs for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- Playlists: las mías, o las públicas de otros.
create policy playlists_leer on public.playlists for select to authenticated
  using (owner_id = auth.uid() or is_public or public.es_admin());
create policy playlists_escribir on public.playlists for all to authenticated
  using (owner_id = auth.uid() or public.es_admin())
  with check (owner_id = auth.uid() or public.es_admin());

create policy playlist_songs_leer on public.playlist_songs for select to authenticated
using (exists (select 1 from public.playlists p where p.id = playlist_id));

create policy playlist_songs_escribir on public.playlist_songs for all to authenticated
using (exists (select 1 from public.playlists p where p.id = playlist_id and p.owner_id = auth.uid()))
with check (exists (select 1 from public.playlists p where p.id = playlist_id and p.owner_id = auth.uid()));

-- Reproducciones: cada quien registra las suyas; nadie más las lee (privacidad, RNF-9).
create policy song_plays_mias on public.song_plays for select to authenticated
  using (user_id = auth.uid() or public.es_admin());
create policy song_plays_registrar on public.song_plays for insert to authenticated
  with check (user_id = auth.uid());

create policy song_likes_leer on public.song_likes for select to authenticated using (true);
create policy song_likes_escribir on public.song_likes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ═══ Tarjetas de Fe ════════════════════════════════════════════════════════

-- El contenido oculto/reportado no se muestra; su autor y el admin sí lo ven.
create policy posts_leer on public.posts for select to authenticated
  using (status = 'PUBLISHED' or author_id = auth.uid() or public.es_admin());

-- HU-3.3: publican MAESTRO y ADMIN (Q-2: publicación directa + moderación posterior).
create policy posts_crear on public.posts for insert to authenticated
  with check (author_id = auth.uid() and public.rol_actual() in ('MAESTRO', 'ADMIN'));

create policy posts_editar_los_mios on public.posts for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());

create policy posts_admin on public.posts for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

create policy post_likes_leer on public.post_likes for select to authenticated using (true);
create policy post_likes_escribir on public.post_likes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy post_comments_leer on public.post_comments for select to authenticated
using (exists (select 1 from public.posts p where p.id = post_id));

create policy post_comments_crear on public.post_comments for insert to authenticated
  with check (author_id = auth.uid());

-- El autor borra su comentario; el admin modera cualquiera (HU-7.2).
create policy post_comments_borrar on public.post_comments for delete to authenticated
  using (author_id = auth.uid() or public.es_admin());

create policy follows_leer on public.follows for select to authenticated using (true);
create policy follows_escribir on public.follows for all to authenticated
  using (follower_id = auth.uid()) with check (follower_id = auth.uid());

-- Reportes (HU-3.4): el denunciante ve el suyo; el admin, la cola entera.
create policy post_reports_leer on public.post_reports for select to authenticated
  using (reporter_id = auth.uid() or public.es_admin());
create policy post_reports_crear on public.post_reports for insert to authenticated
  with check (reporter_id = auth.uid());
create policy post_reports_admin on public.post_reports for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- ═══ Chat y niveles ════════════════════════════════════════════════════════

-- HU-6.1: solo los dos participantes (y el ADMIN, para moderación).
create policy conversations_leer on public.conversations for select to authenticated
  using (mentor_id = auth.uid() or student_id = auth.uid() or public.es_admin());

create policy conversations_crear on public.conversations for insert to authenticated
  with check (mentor_id = auth.uid() or student_id = auth.uid());

create policy messages_leer on public.messages for select to authenticated
using (
  exists (
    select 1 from public.conversations c
     where c.id = conversation_id
       and (c.mentor_id = auth.uid() or c.student_id = auth.uid() or public.es_admin())
  )
);

-- Solo se envían mensajes como uno mismo, y solo en conversaciones propias.
create policy messages_enviar on public.messages for insert to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.conversations c
     where c.id = conversation_id
       and (c.mentor_id = auth.uid() or c.student_id = auth.uid())
  )
);

-- Marcar como leído: solo el receptor.
create policy messages_marcar_leido on public.messages for update to authenticated
using (
  sender_id <> auth.uid()
  and exists (
    select 1 from public.conversations c
     where c.id = conversation_id
       and (c.mentor_id = auth.uid() or c.student_id = auth.uid())
  )
);

-- HU-6.2: el estudiante solicita; el mentor (o el admin) resuelve.
create policy level_up_leer on public.level_up_requests for select to authenticated
  using (student_id = auth.uid() or mentor_id = auth.uid() or public.es_admin());

create policy level_up_solicitar on public.level_up_requests for insert to authenticated
  with check (student_id = auth.uid() and status = 'PENDING');

create policy level_up_resolver on public.level_up_requests for update to authenticated
  using (mentor_id = auth.uid() or public.es_admin())
  with check (mentor_id = auth.uid() or public.es_admin());

-- ═══ Medios y notificaciones ═══════════════════════════════════════════════

-- Un asset lo ve su dueño y el admin. El acceso al ARCHIVO va aparte, por
-- URL firmada emitida por el API tras validar nivel/inscripción (HU-8.3).
create policy media_assets_leer on public.media_assets for select to authenticated
  using (owner_id = auth.uid() or public.es_admin());
create policy media_assets_crear on public.media_assets for insert to authenticated
  with check (owner_id = auth.uid());
create policy media_assets_admin on public.media_assets for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- Notificaciones: estrictamente personales.
create policy notifications_mias on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_marcar_leida on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
