-- ═══════════════════════════════════════════════════════════════════════════
-- Buckets de Supabase Storage (arquitectura.md §3.4)
--
-- Los privados NUNCA se leen directamente: el API emite una URL firmada de
-- corta vida (~60 min) tras validar rol/propiedad/nivel/inscripción (HU-8.3).
-- ═══════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars',      'avatars',      true,   5 * 1024 * 1024,   array['image/jpeg','image/png','image/webp']),
  ('thumbnails',   'thumbnails',   true,   5 * 1024 * 1024,   array['image/jpeg','image/png','image/webp']),
  ('music',        'music',        false, 100 * 1024 * 1024,  array['audio/mpeg','audio/mp4','audio/aac','audio/wav','application/vnd.apple.mpegurl']),
  ('feed-media',   'feed-media',   false, 500 * 1024 * 1024,  array['video/mp4','video/quicktime','image/jpeg','image/png','image/webp','application/vnd.apple.mpegurl','video/mp2t']),
  ('course-media', 'course-media', false, 500 * 1024 * 1024,  array['video/mp4','video/quicktime','application/pdf','application/vnd.apple.mpegurl','video/mp2t'])
on conflict (id) do nothing;

-- ─── avatars (público) ─────────────────────────────────────────────────────
-- Convención de ruta: `<user_id>/<archivo>`. Cada quien escribe en su carpeta.
create policy "avatars_lectura_publica"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars_subir_el_mio"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_actualizar_el_mio"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_borrar_el_mio"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ─── thumbnails (público) ──────────────────────────────────────────────────
create policy "thumbnails_lectura_publica"
  on storage.objects for select
  using (bucket_id = 'thumbnails');

create policy "thumbnails_escribir_maestro_admin"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'thumbnails'
    and public.rol_actual() in ('MAESTRO', 'ADMIN')
  );

-- ─── music (privado) ───────────────────────────────────────────────────────
-- Solo el ADMIN sube música (HU-2.4). La lectura va por URL firmada.
create policy "music_admin"
  on storage.objects for all to authenticated
  using (bucket_id = 'music' and public.es_admin())
  with check (bucket_id = 'music' and public.es_admin());

-- ─── feed-media (privado) ──────────────────────────────────────────────────
-- Ruta: `<user_id>/<asset_id>/…`
create policy "feed_media_subir_maestro_admin"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'feed-media'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.rol_actual() in ('MAESTRO', 'ADMIN')
  );

create policy "feed_media_gestionar_lo_mio"
  on storage.objects for all to authenticated
  using (
    bucket_id = 'feed-media'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.es_admin())
  )
  with check (
    bucket_id = 'feed-media'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.es_admin())
  );

-- ─── course-media (privado) ────────────────────────────────────────────────
-- Gated por inscripción/nivel. La comprobación fina ocurre en el API al firmar
-- la URL; aquí solo se garantiza que nadie ajeno escriba.
create policy "course_media_gestionar_lo_mio"
  on storage.objects for all to authenticated
  using (
    bucket_id = 'course-media'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.es_admin())
  )
  with check (
    bucket_id = 'course-media'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.es_admin())
    and public.rol_actual() in ('MAESTRO', 'ADMIN')
  );
