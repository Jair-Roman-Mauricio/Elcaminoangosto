-- Las redes que acompañan a un artículo.
--
-- Van por lectura y no en un ajuste global porque un artículo puede estar
-- firmado por alguien de fuera, y entonces las redes que valen son las suyas y
-- no las de la casa.
--
-- Un `jsonb` en vez de cuatro columnas: mañana aparece otra red y añadirla no
-- debería costar una migración de esquema.

alter table public.lecturas
  add column redes jsonb not null default '{}'::jsonb;

-- Un objeto, no una lista ni un número: lo que se guarda es «red → dirección».
alter table public.lecturas
  add constraint lecturas_redes_es_objeto check (jsonb_typeof(redes) = 'object');
