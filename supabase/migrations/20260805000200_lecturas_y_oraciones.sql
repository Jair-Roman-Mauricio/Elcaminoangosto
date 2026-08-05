-- Tres secciones nuevas: Devocionales, Revista y Oraciones guiadas.
--
-- Un DEVOCIONAL es una lectura: una historia con su cierre, firmada por quien
-- la escribe. Se lee como una revista —portada, entradilla, cuerpo— y por eso
-- guarda su texto en párrafos y no en un solo bloque: la pantalla necesita
-- saber dónde respira.
--
-- Una ORACIÓN GUIADA es una voz acompañada de su texto. El texto se ilumina al
-- ritmo de la locución, así que se guarda por LÍNEAS y, si se conocen, con el
-- segundo en que empieza cada una. Cuando no se conocen, la interfaz las
-- reparte por longitud, que para una narración pausada cae bastante cerca.

-- Un devocional y un artículo de revista son la MISMA pieza: portada, título,
-- cuerpo y firma. Lo que cambia es la sección donde vive y el tono con que se
-- lee. Van en una tabla con su tipo, no en dos idénticas: dos tablas gemelas se
-- desincronizan en cuanto una gana un campo.
create type public.tipo_de_lectura as enum ('DEVOCIONAL', 'ARTICULO');

create table public.lecturas (
  id uuid primary key default gen_random_uuid(),
  tipo public.tipo_de_lectura not null,
  titulo text not null check (length(btrim(titulo)) between 3 and 160),
  /** Frase de entrada: lo que se lee bajo el título en la portada. */
  entradilla text check (length(btrim(entradilla)) <= 400),
  /** Cuerpo en párrafos, en orden. Se guarda ya partido para no adivinar. */
  parrafos text[] not null check (cardinality(parrafos) between 1 and 60),
  /** Sección dentro de la revista: «Testimonio», «Familia»… Opcional. */
  seccion text check (length(btrim(seccion)) <= 80),
  /** Quién lo firma. Es una lectura de autor, no un texto anónimo. */
  autor text not null check (length(btrim(autor)) between 2 and 120),
  referencia text check (length(btrim(referencia)) <= 120),
  portada_asset_id uuid references public.media_assets(id) on delete set null,
  estado public.estado_publicacion not null default 'VISIBLE',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.oraciones_guiadas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (length(btrim(titulo)) between 3 and 160),
  /** Ansiedad, gratitud, perdón… lo que se viene a buscar. */
  tema text check (length(btrim(tema)) <= 80),
  /** Líneas que se iluminan una a una, en orden. */
  lineas text[] not null check (cardinality(lineas) between 1 and 200),
  /**
   * Segundo en que empieza cada línea, si se conoce.
   *
   * Nulo o de longitud distinta a `lineas` significa «repártelas tú»: la
   * interfaz lo hace por longitud del texto. Tener el hueco preparado permite
   * afinar una oración concreta sin cambiar el esquema.
   */
  marcas double precision[],
  audio_asset_id uuid not null references public.media_assets(id) on delete restrict,
  estado public.estado_publicacion not null default 'VISIBLE',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lecturas_por_tipo_y_fecha on public.lecturas (tipo, published_at desc nulls last)
  where estado = 'VISIBLE';
create index oraciones_por_fecha on public.oraciones_guiadas (published_at desc nulls last)
  where estado = 'VISIBLE';

create trigger lecturas_tocar_updated_at
  before update on public.lecturas
  for each row execute function public.tocar_updated_at();

create trigger oraciones_guiadas_tocar_updated_at
  before update on public.oraciones_guiadas
  for each row execute function public.tocar_updated_at();

-- ─── RLS ───────────────────────────────────────────────────────────────────
-- Leer, cualquiera: el contenido es abierto. Escribir, solo el admin, y solo
-- por el API. Sin política de escritura nadie inserta aunque llegue directo a
-- PostgREST.
alter table public.lecturas enable row level security;
alter table public.oraciones_guiadas enable row level security;

create policy lecturas_leer on public.lecturas
  for select to anon, authenticated
  using (estado = 'VISIBLE' or public.es_admin());

create policy lecturas_admin on public.lecturas
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

create policy oraciones_leer on public.oraciones_guiadas
  for select to anon, authenticated
  using (estado = 'VISIBLE' or public.es_admin());

create policy oraciones_admin on public.oraciones_guiadas
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

grant select on public.lecturas to anon, authenticated;
grant select on public.oraciones_guiadas to anon, authenticated;

-- ─── Conversación bajo un artículo ─────────────────────────────────────────
-- Solo los artículos de revista admiten comentarios: un devocional se lee y se
-- guarda, un artículo se discute. Mismo anonimato que la comunidad y los
-- videos: huella sha256 de un identificador aleatorio del navegador, alias
-- calculado al leer, ni IP ni huella de dispositivo.
create table public.lectura_comentarios (
  id uuid primary key default gen_random_uuid(),
  lectura_id uuid not null references public.lecturas(id) on delete cascade,
  cuerpo text not null check (length(btrim(cuerpo)) between 1 and 1000),
  autor_huella text not null,
  estado public.estado_publicacion not null default 'VISIBLE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lectura_comentarios_por_lectura
  on public.lectura_comentarios (lectura_id, created_at desc);
create index lectura_comentarios_por_autor
  on public.lectura_comentarios (autor_huella, created_at desc);

create trigger lectura_comentarios_tocar_updated_at
  before update on public.lectura_comentarios
  for each row execute function public.tocar_updated_at();

alter table public.lectura_comentarios enable row level security;

create policy lectura_comentarios_leer on public.lectura_comentarios
  for select to anon, authenticated
  using (estado = 'VISIBLE' or public.es_admin());

create policy lectura_comentarios_admin on public.lectura_comentarios
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

grant select on public.lectura_comentarios to anon, authenticated;
