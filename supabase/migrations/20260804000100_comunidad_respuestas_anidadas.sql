-- Comunidad: responder a una respuesta, no solo al hilo.
--
-- Hasta ahora todas las respuestas colgaban del hilo y se leían como una lista
-- plana: quien contestaba a alguien en concreto tenía que nombrarlo dentro del
-- texto. Con el padre explícito, la interfaz puede sangrar la contestación y la
-- conversación se entiende sin leerla entera.
--
-- UN SOLO NIVEL, a propósito. Una cadena sin fondo obliga a sangrar sin límite
-- y en un móvil la cuarta respuesta acaba en una columna de tres palabras. Con
-- un nivel se distingue «esto contesta a aquello», que es lo que hacía falta;
-- lo demás es hilo nuevo.

alter table public.hilo_respuestas
  add column respuesta_padre_id uuid references public.hilo_respuestas(id) on delete cascade;

comment on column public.hilo_respuestas.respuesta_padre_id is
  'Respuesta a la que contesta esta. Nula si contesta al hilo. Un solo nivel: lo garantiza el trigger hilo_respuestas_un_solo_nivel.';

-- Traer las hijas de una respuesta, y el índice del padre para el borrado en
-- cascada, que sin él recorre la tabla entera.
create index hilo_respuestas_por_padre
  on public.hilo_respuestas (respuesta_padre_id, created_at)
  where respuesta_padre_id is not null;

/**
 * Reglas del anidamiento. Van en la base y no solo en el servicio porque son
 * invariantes del dato: una respuesta que contesta a otra de otro hilo, o una
 * cadena de tres niveles, dejan la conversación imposible de dibujar.
 */
create or replace function public.exigir_un_solo_nivel_de_respuesta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  padre public.hilo_respuestas%rowtype;
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

  if padre.respuesta_padre_id is not null then
    raise exception 'La conversación admite un solo nivel de respuestas';
  end if;

  return new;
end;
$$;

create trigger hilo_respuestas_un_solo_nivel
  before insert or update of respuesta_padre_id, hilo_id on public.hilo_respuestas
  for each row execute function public.exigir_un_solo_nivel_de_respuesta();
