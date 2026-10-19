-- Esquema de El Camino Angosto sobre Postgres de Railway.
-- Línea base generada desde el esquema `public` de Supabase, sin RLS, sin
-- roles de Supabase y sin `auth.*`: la autorización vive en los guards del API.

SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;

-- Reemplazo propio de `auth.users`. El id conserva el UUID que tenía en
-- Supabase para que todas las claves foráneas sigan valiendo.
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password_hash text NOT NULL,
  email_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key ON public.users (lower(email));

CREATE TABLE IF NOT EXISTS public.refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS refresh_tokens_user_idx ON public.refresh_tokens (user_id);

-- Tokens de un solo uso: verificar correo y restablecer contraseña.
CREATE TABLE IF NOT EXISTS public.auth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('verify_email', 'reset_password')),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

SET statement_timeout = 0;

SET lock_timeout = 0;

SET idle_in_transaction_session_timeout = 0;

SET client_encoding = 'UTF8';

SET standard_conforming_strings = on;


SET check_function_bodies = false;

SET xmloption = content;

SET client_min_messages = warning;

SET row_security = off;

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA public;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;

CREATE TYPE "public"."alabanza_tono" AS ENUM (
    'vino',
    'marfil',
    'azul'
);

CREATE TYPE "public"."content_kind" AS ENUM (
    'VIDEO',
    'POST',
    'SONG',
    'LECTURA',
    'ORACION'
);

CREATE TYPE "public"."course_status" AS ENUM (
    'DRAFT',
    'SUBMITTED',
    'UNDER_REVIEW',
    'APPROVED',
    'PUBLISHED',
    'REJECTED',
    'ARCHIVED'
);

CREATE TYPE "public"."enrollment_status" AS ENUM (
    'ACTIVE',
    'COMPLETED',
    'DROPPED'
);

CREATE TYPE "public"."estado_publicacion" AS ENUM (
    'VISIBLE',
    'OCULTO'
);

CREATE TYPE "public"."lesson_type" AS ENUM (
    'VIDEO',
    'TEXT',
    'EXAM',
    'IMAGE'
);

CREATE TYPE "public"."level_up_status" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);

CREATE TYPE "public"."media_kind" AS ENUM (
    'AUDIO',
    'VIDEO',
    'IMAGE'
);

CREATE TYPE "public"."media_status" AS ENUM (
    'UPLOADED',
    'PROCESSING',
    'READY',
    'FAILED'
);

CREATE TYPE "public"."mentorship_status" AS ENUM (
    'ACTIVE',
    'ENDED'
);

CREATE TYPE "public"."moderation_status" AS ENUM (
    'APPROVED',
    'PENDING',
    'BLOCKED'
);

CREATE TYPE "public"."post_status" AS ENUM (
    'PUBLISHED',
    'HIDDEN',
    'REPORTED'
);

CREATE TYPE "public"."post_type" AS ENUM (
    'VIDEO',
    'IMAGE'
);

CREATE TYPE "public"."report_status" AS ENUM (
    'PENDING',
    'RESOLVED',
    'DISMISSED'
);

CREATE TYPE "public"."review_decision" AS ENUM (
    'APPROVED',
    'REJECTED'
);

CREATE TYPE "public"."role" AS ENUM (
    'ESTUDIANTE',
    'MAESTRO',
    'ADMIN'
);

CREATE TYPE "public"."tipo_de_lectura" AS ENUM (
    'DEVOCIONAL',
    'ARTICULO'
);

CREATE TYPE "public"."video_status" AS ENUM (
    'PUBLISHED',
    'HIDDEN'
);

CREATE OR REPLACE FUNCTION "public"."refrescar_actividad_del_hilo"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  objetivo uuid := coalesce(new.hilo_id, old.hilo_id);
begin
  update public.hilos h
  set respuestas = (
        select count(*) from public.hilo_respuestas r
        where r.hilo_id = objetivo and r.estado = 'VISIBLE'
      ),
      ultima_actividad = greatest(
        h.created_at,
        coalesce((
          select max(r.created_at) from public.hilo_respuestas r
          where r.hilo_id = objetivo and r.estado = 'VISIBLE'
        ), h.created_at)
      )
  where h.id = objetivo;
  return null;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."tocar_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."validar_respuesta_padre"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  padre public.hilo_respuestas%rowtype;
  antepasado uuid;
  saltos int := 0;
begin
  if new.respuesta_padre_id is null then
    return new;
  end if;

  if new.respuesta_padre_id = new.id then
    raise exception 'Una respuesta no puede contestarse a sí misma';
  end if;

  select * into padre
  from public.hilo_respuestas
  where id = new.respuesta_padre_id;

  if not found then
    raise exception 'La respuesta a la que contestas no existe';
  end if;

  if padre.hilo_id <> new.hilo_id then
    raise exception 'La respuesta a la que contestas es de otro hilo';
  end if;

  -- Subir por la cadena de padres. Si se llega a la propia respuesta, la
  -- rama se muerde la cola. El contador es un seguro contra datos ya
  -- corruptos: sin él, un ciclo previo colgaría este bucle.
  antepasado := padre.respuesta_padre_id;
  while antepasado is not null loop
    if antepasado = new.id then
      raise exception 'Esa respuesta ya cuelga de la que intentas contestar';
    end if;
    saltos := saltos + 1;
    if saltos > 200 then
      raise exception 'La cadena de respuestas es demasiado profunda';
    end if;
    select respuesta_padre_id into antepasado
    from public.hilo_respuestas
    where id = antepasado;
  end loop;

  return new;
end;
$$;

SET default_tablespace = '';

SET default_table_access_method = "heap";

CREATE TABLE IF NOT EXISTS "public"."albums" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "artist_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "cover_asset_id" "uuid",
    "released_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "number" "text",
    "description" "text",
    "cover_image_url" "text",
    "tone" "public"."alabanza_tono" DEFAULT 'vino'::"public"."alabanza_tono" NOT NULL,
    "disc_color" "text"
);

COMMENT ON COLUMN "public"."albums"."tone" IS 'Identidad visual del álbum en la pantalla de Alabanza';

CREATE TABLE IF NOT EXISTS "public"."artists" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "bio" "text",
    "avatar_asset_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."coleccion_album_canciones" (
    "album_id" "uuid" NOT NULL,
    "song_id" "uuid" NOT NULL,
    "orden" integer DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."coleccion_albumes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "coleccion_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "portada_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "coleccion_albumes_nombre_check" CHECK ((("length"("btrim"("nombre")) >= 1) AND ("length"("btrim"("nombre")) <= 80)))
);

CREATE TABLE IF NOT EXISTS "public"."coleccion_favoritos" (
    "coleccion_id" "uuid" NOT NULL,
    "song_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."colecciones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "codigo_huella" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."consejeros" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "presentacion" "text",
    "rol" "text",
    "foto_asset_id" "uuid",
    "contactos" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "atiende_urgencias" boolean DEFAULT false NOT NULL,
    "orden" integer DEFAULT 0 NOT NULL,
    "estado" "public"."estado_publicacion" DEFAULT 'VISIBLE'::"public"."estado_publicacion" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "consejeros_contactos_es_objeto" CHECK (("jsonb_typeof"("contactos") = 'object'::"text")),
    CONSTRAINT "consejeros_nombre_check" CHECK ((("length"("btrim"("nombre")) >= 2) AND ("length"("btrim"("nombre")) <= 120))),
    CONSTRAINT "consejeros_presentacion_check" CHECK ((("presentacion" IS NULL) OR ("length"("btrim"("presentacion")) <= 400))),
    CONSTRAINT "consejeros_rol_check" CHECK ((("rol" IS NULL) OR ("length"("btrim"("rol")) <= 120)))
);

CREATE TABLE IF NOT EXISTS "public"."content_views" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "kind" "public"."content_kind" NOT NULL,
    "content_id" "uuid" NOT NULL,
    "viewer_id" "uuid",
    "session_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."hilo_respuestas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "hilo_id" "uuid" NOT NULL,
    "cuerpo" "text" NOT NULL,
    "autor_huella" "text" NOT NULL,
    "estado" "public"."estado_publicacion" DEFAULT 'VISIBLE'::"public"."estado_publicacion" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "respuesta_padre_id" "uuid",
    CONSTRAINT "hilo_respuestas_cuerpo_check" CHECK ((("length"("btrim"("cuerpo")) >= 2) AND ("length"("btrim"("cuerpo")) <= 5000)))
);

COMMENT ON COLUMN "public"."hilo_respuestas"."respuesta_padre_id" IS 'Respuesta a la que contesta esta. Nula si contesta al hilo. Profundidad libre; el trigger hilo_respuestas_padre_valido impide ciclos y padres de otro hilo.';

CREATE TABLE IF NOT EXISTS "public"."hilos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "titulo" "text" NOT NULL,
    "cuerpo" "text" NOT NULL,
    "autor_huella" "text" NOT NULL,
    "estado" "public"."estado_publicacion" DEFAULT 'VISIBLE'::"public"."estado_publicacion" NOT NULL,
    "respuestas" integer DEFAULT 0 NOT NULL,
    "ultima_actividad" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "hilos_cuerpo_check" CHECK ((("length"("btrim"("cuerpo")) >= 10) AND ("length"("btrim"("cuerpo")) <= 5000))),
    CONSTRAINT "hilos_titulo_check" CHECK ((("length"("btrim"("titulo")) >= 5) AND ("length"("btrim"("titulo")) <= 140)))
);

CREATE TABLE IF NOT EXISTS "public"."lectura_comentarios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lectura_id" "uuid" NOT NULL,
    "cuerpo" "text" NOT NULL,
    "autor_huella" "text" NOT NULL,
    "estado" "public"."estado_publicacion" DEFAULT 'VISIBLE'::"public"."estado_publicacion" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "lectura_comentarios_cuerpo_check" CHECK ((("length"("btrim"("cuerpo")) >= 1) AND ("length"("btrim"("cuerpo")) <= 1000)))
);

CREATE TABLE IF NOT EXISTS "public"."lecturas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tipo" "public"."tipo_de_lectura" NOT NULL,
    "titulo" "text" NOT NULL,
    "entradilla" "text",
    "seccion" "text",
    "autor" "text" NOT NULL,
    "referencia" "text",
    "portada_asset_id" "uuid",
    "estado" "public"."estado_publicacion" DEFAULT 'VISIBLE'::"public"."estado_publicacion" NOT NULL,
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cuerpo" "text" NOT NULL,
    "redes" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "ilustracion_asset_id" "uuid",
    "fondo" "text",
    CONSTRAINT "lecturas_autor_check" CHECK ((("length"("btrim"("autor")) >= 2) AND ("length"("btrim"("autor")) <= 120))),
    CONSTRAINT "lecturas_cuerpo_no_vacio" CHECK (("length"("btrim"("cuerpo")) > 0)),
    CONSTRAINT "lecturas_entradilla_check" CHECK (("length"("btrim"("entradilla")) <= 400)),
    CONSTRAINT "lecturas_fondo_conocido" CHECK ((("fondo" IS NULL) OR ("fondo" = ANY (ARRAY['brasas'::"text", 'vitral'::"text", 'ondas'::"text", 'polvo'::"text"])))),
    CONSTRAINT "lecturas_redes_es_objeto" CHECK (("jsonb_typeof"("redes") = 'object'::"text")),
    CONSTRAINT "lecturas_referencia_check" CHECK (("length"("btrim"("referencia")) <= 120)),
    CONSTRAINT "lecturas_seccion_check" CHECK (("length"("btrim"("seccion")) <= 80)),
    CONSTRAINT "lecturas_titulo_check" CHECK ((("length"("btrim"("titulo")) >= 3) AND ("length"("btrim"("titulo")) <= 160)))
);

CREATE TABLE IF NOT EXISTS "public"."media_assets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "bucket" "text" NOT NULL,
    "path" "text" NOT NULL,
    "kind" "public"."media_kind" NOT NULL,
    "status" "public"."media_status" DEFAULT 'UPLOADED'::"public"."media_status" NOT NULL,
    "hls_path" "text",
    "poster_path" "text",
    "duration_seconds" integer,
    "bytes" bigint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."oraciones_guiadas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "titulo" "text" NOT NULL,
    "tema" "text",
    "lineas" "text"[] NOT NULL,
    "marcas" double precision[],
    "audio_asset_id" "uuid" NOT NULL,
    "estado" "public"."estado_publicacion" DEFAULT 'VISIBLE'::"public"."estado_publicacion" NOT NULL,
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "imagen_asset_id" "uuid",
    "fondo_asset_id" "uuid",
    CONSTRAINT "oraciones_guiadas_lineas_check" CHECK ((("cardinality"("lineas") >= 1) AND ("cardinality"("lineas") <= 200))),
    CONSTRAINT "oraciones_guiadas_tema_check" CHECK (("length"("btrim"("tema")) <= 80)),
    CONSTRAINT "oraciones_guiadas_titulo_check" CHECK ((("length"("btrim"("titulo")) >= 3) AND ("length"("btrim"("titulo")) <= 160)))
);

CREATE TABLE IF NOT EXISTS "public"."posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "author_id" "uuid" NOT NULL,
    "type" "public"."post_type" NOT NULL,
    "media_asset_id" "uuid" NOT NULL,
    "caption" "text",
    "status" "public"."post_status" DEFAULT 'PUBLISHED'::"public"."post_status" NOT NULL,
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "title" "text",
    "manifesto" "text",
    "story" "text",
    "origin" "text",
    "reference" "text",
    "audio_asset_id" "uuid",
    CONSTRAINT "posts_caption_check" CHECK ((("caption" IS NULL) OR ("char_length"("caption") <= 500)))
);

COMMENT ON COLUMN "public"."posts"."manifesto" IS 'Frase destacada de la tarjeta';

COMMENT ON COLUMN "public"."posts"."story" IS 'Relato; párrafos separados por línea en blanco';

COMMENT ON COLUMN "public"."posts"."reference" IS 'Referencia bíblica (p. ej. Mateo 7:13–14)';

CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "role" "public"."role" DEFAULT 'ESTUDIANTE'::"public"."role" NOT NULL,
    "display_name" "text" NOT NULL,
    "avatar_url" "text",
    "bio" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profiles_bio_check" CHECK ((("bio" IS NULL) OR ("char_length"("bio") <= 500))),
    CONSTRAINT "profiles_display_name_check" CHECK ((("char_length"("display_name") >= 1) AND ("char_length"("display_name") <= 60)))
);

CREATE TABLE IF NOT EXISTS "public"."site_visits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "section" "text" NOT NULL,
    "viewer_id" "uuid",
    "session_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."song_plays" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "song_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "played_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."songs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "album_id" "uuid",
    "artist_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "audio_asset_id" "uuid",
    "duration_seconds" integer,
    "is_published" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "track_number" integer,
    "subtitle" "text",
    "tone" "public"."alabanza_tono" DEFAULT 'vino'::"public"."alabanza_tono" NOT NULL,
    "background_url" "text",
    "background_type" "text",
    "background_asset_id" "uuid",
    "subtitles_srt" "text",
    CONSTRAINT "songs_background_type_check" CHECK ((("background_type" IS NULL) OR ("background_type" = ANY (ARRAY['imagen'::"text", 'video'::"text"]))))
);

COMMENT ON COLUMN "public"."songs"."background_url" IS 'Fondo de imagen: URL pública';

COMMENT ON COLUMN "public"."songs"."background_type" IS 'imagen | video: qué se ve al reproducir';

COMMENT ON COLUMN "public"."songs"."background_asset_id" IS 'Fondo de video: medio privado';

COMMENT ON COLUMN "public"."songs"."subtitles_srt" IS 'Contenido del .srt con la letra';

CREATE TABLE IF NOT EXISTS "public"."video_comentarios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "video_id" "uuid" NOT NULL,
    "cuerpo" "text" NOT NULL,
    "autor_huella" "text" NOT NULL,
    "estado" "public"."estado_publicacion" DEFAULT 'VISIBLE'::"public"."estado_publicacion" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "video_comentarios_cuerpo_check" CHECK ((("length"("btrim"("cuerpo")) >= 1) AND ("length"("btrim"("cuerpo")) <= 320)))
);

CREATE TABLE IF NOT EXISTS "public"."videos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "series" "text",
    "description" "text",
    "reference" "text",
    "media_asset_id" "uuid" NOT NULL,
    "status" "public"."video_status" DEFAULT 'PUBLISHED'::"public"."video_status" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "videos_title_check" CHECK (("char_length"("btrim"("title")) >= 2))
);

ALTER TABLE ONLY "public"."albums"
    ADD CONSTRAINT "albums_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."artists"
    ADD CONSTRAINT "artists_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."coleccion_album_canciones"
    ADD CONSTRAINT "coleccion_album_canciones_pkey" PRIMARY KEY ("album_id", "song_id");

ALTER TABLE ONLY "public"."coleccion_albumes"
    ADD CONSTRAINT "coleccion_albumes_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."coleccion_favoritos"
    ADD CONSTRAINT "coleccion_favoritos_pkey" PRIMARY KEY ("coleccion_id", "song_id");

ALTER TABLE ONLY "public"."colecciones"
    ADD CONSTRAINT "colecciones_codigo_huella_key" UNIQUE ("codigo_huella");

ALTER TABLE ONLY "public"."colecciones"
    ADD CONSTRAINT "colecciones_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."consejeros"
    ADD CONSTRAINT "consejeros_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."content_views"
    ADD CONSTRAINT "content_views_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."hilo_respuestas"
    ADD CONSTRAINT "hilo_respuestas_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."hilos"
    ADD CONSTRAINT "hilos_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."lectura_comentarios"
    ADD CONSTRAINT "lectura_comentarios_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."lecturas"
    ADD CONSTRAINT "lecturas_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."media_assets"
    ADD CONSTRAINT "media_assets_bucket_path_uq" UNIQUE ("bucket", "path");

ALTER TABLE ONLY "public"."media_assets"
    ADD CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."oraciones_guiadas"
    ADD CONSTRAINT "oraciones_guiadas_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."site_visits"
    ADD CONSTRAINT "site_visits_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."song_plays"
    ADD CONSTRAINT "song_plays_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."songs"
    ADD CONSTRAINT "songs_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."video_comentarios"
    ADD CONSTRAINT "video_comentarios_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."videos"
    ADD CONSTRAINT "videos_pkey" PRIMARY KEY ("id");

CREATE INDEX "coleccion_albumes_por_coleccion" ON "public"."coleccion_albumes" USING "btree" ("coleccion_id");

CREATE INDEX "consejeros_orden_idx" ON "public"."consejeros" USING "btree" ("atiende_urgencias" DESC, "orden", "created_at");

CREATE INDEX "content_views_contenido_idx" ON "public"."content_views" USING "btree" ("kind", "content_id");

CREATE INDEX "content_views_kind_fecha_idx" ON "public"."content_views" USING "btree" ("kind", "created_at" DESC);

CREATE INDEX "hilo_respuestas_por_autor" ON "public"."hilo_respuestas" USING "btree" ("autor_huella", "created_at" DESC);

CREATE INDEX "hilo_respuestas_por_hilo" ON "public"."hilo_respuestas" USING "btree" ("hilo_id", "created_at");

CREATE INDEX "hilo_respuestas_por_padre" ON "public"."hilo_respuestas" USING "btree" ("respuesta_padre_id", "created_at") WHERE ("respuesta_padre_id" IS NOT NULL);

CREATE INDEX "hilos_por_actividad" ON "public"."hilos" USING "btree" ("ultima_actividad" DESC) WHERE ("estado" = 'VISIBLE'::"public"."estado_publicacion");

CREATE INDEX "hilos_por_autor" ON "public"."hilos" USING "btree" ("autor_huella", "created_at" DESC);

CREATE INDEX "lectura_comentarios_por_autor" ON "public"."lectura_comentarios" USING "btree" ("autor_huella", "created_at" DESC);

CREATE INDEX "lectura_comentarios_por_lectura" ON "public"."lectura_comentarios" USING "btree" ("lectura_id", "created_at" DESC);

CREATE INDEX "lecturas_por_tipo_y_fecha" ON "public"."lecturas" USING "btree" ("tipo", "published_at" DESC NULLS LAST) WHERE ("estado" = 'VISIBLE'::"public"."estado_publicacion");

CREATE INDEX "media_assets_owner_idx" ON "public"."media_assets" USING "btree" ("owner_id");

CREATE INDEX "media_assets_status_idx" ON "public"."media_assets" USING "btree" ("status");

CREATE INDEX "oraciones_por_fecha" ON "public"."oraciones_guiadas" USING "btree" ("published_at" DESC NULLS LAST) WHERE ("estado" = 'VISIBLE'::"public"."estado_publicacion");

CREATE INDEX "posts_author_idx" ON "public"."posts" USING "btree" ("author_id");

CREATE INDEX "posts_feed_idx" ON "public"."posts" USING "btree" ("status", "published_at" DESC);

CREATE INDEX "profiles_role_idx" ON "public"."profiles" USING "btree" ("role");

CREATE INDEX "profiles_role_name_idx" ON "public"."profiles" USING "btree" ("role", "display_name", "id");

CREATE INDEX "site_visits_fecha_idx" ON "public"."site_visits" USING "btree" ("created_at" DESC);

CREATE INDEX "site_visits_seccion_idx" ON "public"."site_visits" USING "btree" ("section", "created_at" DESC);

CREATE INDEX "site_visits_sesion_idx" ON "public"."site_visits" USING "btree" ("session_id", "created_at" DESC);

CREATE INDEX "song_plays_song_idx" ON "public"."song_plays" USING "btree" ("song_id", "played_at" DESC);

CREATE INDEX "songs_album_track_idx" ON "public"."songs" USING "btree" ("album_id", "track_number");

CREATE INDEX "songs_artist_idx" ON "public"."songs" USING "btree" ("artist_id");

CREATE INDEX "songs_published_idx" ON "public"."songs" USING "btree" ("is_published");

CREATE INDEX "video_comentarios_por_autor" ON "public"."video_comentarios" USING "btree" ("autor_huella", "created_at" DESC);

CREATE INDEX "video_comentarios_por_video" ON "public"."video_comentarios" USING "btree" ("video_id", "created_at" DESC);

CREATE INDEX "videos_status_published_idx" ON "public"."videos" USING "btree" ("status", "published_at" DESC);

CREATE OR REPLACE TRIGGER "albums_tocar_updated_at" BEFORE UPDATE ON "public"."albums" FOR EACH ROW EXECUTE FUNCTION "public"."tocar_updated_at"();

CREATE OR REPLACE TRIGGER "artists_tocar_updated_at" BEFORE UPDATE ON "public"."artists" FOR EACH ROW EXECUTE FUNCTION "public"."tocar_updated_at"();

CREATE OR REPLACE TRIGGER "coleccion_albumes_tocar_updated_at" BEFORE UPDATE ON "public"."coleccion_albumes" FOR EACH ROW EXECUTE FUNCTION "public"."tocar_updated_at"();

CREATE OR REPLACE TRIGGER "colecciones_tocar_updated_at" BEFORE UPDATE ON "public"."colecciones" FOR EACH ROW EXECUTE FUNCTION "public"."tocar_updated_at"();

CREATE OR REPLACE TRIGGER "consejeros_tocar_updated_at" BEFORE UPDATE ON "public"."consejeros" FOR EACH ROW EXECUTE FUNCTION "public"."tocar_updated_at"();

CREATE OR REPLACE TRIGGER "hilo_respuestas_padre_valido" BEFORE INSERT OR UPDATE OF "respuesta_padre_id", "hilo_id" ON "public"."hilo_respuestas" FOR EACH ROW EXECUTE FUNCTION "public"."validar_respuesta_padre"();

CREATE OR REPLACE TRIGGER "hilo_respuestas_refrescan_el_hilo" AFTER INSERT OR DELETE OR UPDATE ON "public"."hilo_respuestas" FOR EACH ROW EXECUTE FUNCTION "public"."refrescar_actividad_del_hilo"();

CREATE OR REPLACE TRIGGER "hilo_respuestas_tocar_updated_at" BEFORE UPDATE ON "public"."hilo_respuestas" FOR EACH ROW EXECUTE FUNCTION "public"."tocar_updated_at"();

CREATE OR REPLACE TRIGGER "hilos_tocar_updated_at" BEFORE UPDATE ON "public"."hilos" FOR EACH ROW EXECUTE FUNCTION "public"."tocar_updated_at"();

CREATE OR REPLACE TRIGGER "lectura_comentarios_tocar_updated_at" BEFORE UPDATE ON "public"."lectura_comentarios" FOR EACH ROW EXECUTE FUNCTION "public"."tocar_updated_at"();

CREATE OR REPLACE TRIGGER "lecturas_tocar_updated_at" BEFORE UPDATE ON "public"."lecturas" FOR EACH ROW EXECUTE FUNCTION "public"."tocar_updated_at"();

CREATE OR REPLACE TRIGGER "media_assets_tocar_updated_at" BEFORE UPDATE ON "public"."media_assets" FOR EACH ROW EXECUTE FUNCTION "public"."tocar_updated_at"();

CREATE OR REPLACE TRIGGER "oraciones_guiadas_tocar_updated_at" BEFORE UPDATE ON "public"."oraciones_guiadas" FOR EACH ROW EXECUTE FUNCTION "public"."tocar_updated_at"();

CREATE OR REPLACE TRIGGER "posts_tocar_updated_at" BEFORE UPDATE ON "public"."posts" FOR EACH ROW EXECUTE FUNCTION "public"."tocar_updated_at"();

CREATE OR REPLACE TRIGGER "profiles_tocar_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."tocar_updated_at"();

CREATE OR REPLACE TRIGGER "songs_tocar_updated_at" BEFORE UPDATE ON "public"."songs" FOR EACH ROW EXECUTE FUNCTION "public"."tocar_updated_at"();

CREATE OR REPLACE TRIGGER "video_comentarios_tocar_updated_at" BEFORE UPDATE ON "public"."video_comentarios" FOR EACH ROW EXECUTE FUNCTION "public"."tocar_updated_at"();

CREATE OR REPLACE TRIGGER "videos_tocar_updated_at" BEFORE UPDATE ON "public"."videos" FOR EACH ROW EXECUTE FUNCTION "public"."tocar_updated_at"();

ALTER TABLE ONLY "public"."albums"
    ADD CONSTRAINT "albums_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."albums"
    ADD CONSTRAINT "albums_cover_asset_id_fkey" FOREIGN KEY ("cover_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."artists"
    ADD CONSTRAINT "artists_avatar_asset_id_fkey" FOREIGN KEY ("avatar_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."coleccion_album_canciones"
    ADD CONSTRAINT "coleccion_album_canciones_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "public"."coleccion_albumes"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."coleccion_album_canciones"
    ADD CONSTRAINT "coleccion_album_canciones_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."coleccion_albumes"
    ADD CONSTRAINT "coleccion_albumes_coleccion_id_fkey" FOREIGN KEY ("coleccion_id") REFERENCES "public"."colecciones"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."coleccion_favoritos"
    ADD CONSTRAINT "coleccion_favoritos_coleccion_id_fkey" FOREIGN KEY ("coleccion_id") REFERENCES "public"."colecciones"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."coleccion_favoritos"
    ADD CONSTRAINT "coleccion_favoritos_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."consejeros"
    ADD CONSTRAINT "consejeros_foto_asset_id_fkey" FOREIGN KEY ("foto_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."content_views"
    ADD CONSTRAINT "content_views_viewer_id_fkey" FOREIGN KEY ("viewer_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."hilo_respuestas"
    ADD CONSTRAINT "hilo_respuestas_hilo_id_fkey" FOREIGN KEY ("hilo_id") REFERENCES "public"."hilos"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."hilo_respuestas"
    ADD CONSTRAINT "hilo_respuestas_respuesta_padre_id_fkey" FOREIGN KEY ("respuesta_padre_id") REFERENCES "public"."hilo_respuestas"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."lectura_comentarios"
    ADD CONSTRAINT "lectura_comentarios_lectura_id_fkey" FOREIGN KEY ("lectura_id") REFERENCES "public"."lecturas"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."lecturas"
    ADD CONSTRAINT "lecturas_ilustracion_asset_id_fkey" FOREIGN KEY ("ilustracion_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."lecturas"
    ADD CONSTRAINT "lecturas_portada_asset_id_fkey" FOREIGN KEY ("portada_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."media_assets"
    ADD CONSTRAINT "media_assets_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."oraciones_guiadas"
    ADD CONSTRAINT "oraciones_guiadas_audio_asset_id_fkey" FOREIGN KEY ("audio_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."oraciones_guiadas"
    ADD CONSTRAINT "oraciones_guiadas_fondo_asset_id_fkey" FOREIGN KEY ("fondo_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."oraciones_guiadas"
    ADD CONSTRAINT "oraciones_guiadas_imagen_asset_id_fkey" FOREIGN KEY ("imagen_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_audio_asset_id_fkey" FOREIGN KEY ("audio_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "public"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."site_visits"
    ADD CONSTRAINT "site_visits_viewer_id_fkey" FOREIGN KEY ("viewer_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."song_plays"
    ADD CONSTRAINT "song_plays_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."song_plays"
    ADD CONSTRAINT "song_plays_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."songs"
    ADD CONSTRAINT "songs_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."songs"
    ADD CONSTRAINT "songs_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."songs"
    ADD CONSTRAINT "songs_audio_asset_id_fkey" FOREIGN KEY ("audio_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."songs"
    ADD CONSTRAINT "songs_background_asset_id_fkey" FOREIGN KEY ("background_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."video_comentarios"
    ADD CONSTRAINT "video_comentarios_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."videos"
    ADD CONSTRAINT "videos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."videos"
    ADD CONSTRAINT "videos_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE RESTRICT;
