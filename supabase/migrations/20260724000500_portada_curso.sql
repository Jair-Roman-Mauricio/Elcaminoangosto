-- Imagen de portada del curso (URL pública en bucket `thumbnails`, permanente).
alter table public.courses
  add column if not exists cover_image_url text;

grant update (cover_image_url) on public.courses to authenticated;
