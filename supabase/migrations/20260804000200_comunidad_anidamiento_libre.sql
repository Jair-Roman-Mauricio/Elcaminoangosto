-- Comunidad: se contesta también a una contestación.
--
-- La migración anterior topó la conversación en un nivel para que la interfaz
-- no tuviera que sangrar sin fondo. En uso quedó corto: quien recibe una
-- contestación no podía responderla, y la conversación se cortaba justo donde
-- empezaba. El responsable humano decidió abrirla (ADR-014).
--
-- El anidamiento pasa a ser libre en el dato; el tope se muda a la interfaz,
-- que deja de sangrar a partir de cierta profundidad y se apoya en el «en
-- respuesta a» para seguir diciendo de quién cuelga cada mensaje.
--
-- Lo que sí sigue prohibido es un ciclo: una respuesta que sea, subiendo por
-- los padres, antepasada de sí misma. Dibujarla sería imposible y recorrerla,
-- infinito.

drop trigger if exists hilo_respuestas_un_solo_nivel on public.hilo_respuestas;
drop function if exists public.exigir_un_solo_nivel_de_respuesta();

create or replace function public.validar_respuesta_padre()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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

create trigger hilo_respuestas_padre_valido
  before insert or update of respuesta_padre_id, hilo_id on public.hilo_respuestas
  for each row execute function public.validar_respuesta_padre();

comment on column public.hilo_respuestas.respuesta_padre_id is
  'Respuesta a la que contesta esta. Nula si contesta al hilo. Profundidad libre; el trigger hilo_respuestas_padre_valido impide ciclos y padres de otro hilo.';
