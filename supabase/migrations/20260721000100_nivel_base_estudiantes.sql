-- Todo estudiante comienza su recorrido en el nivel de rank 1.
-- Solo completamos perfiles sin nivel para no rebajar avances existentes.
update public.profiles as p
set current_level_id = nivel_base.id,
    updated_at = now()
from (
  select id
  from public.levels
  where rank = 1
  limit 1
) as nivel_base
where p.role = 'ESTUDIANTE'
  and p.current_level_id is null;

-- Los perfiles nuevos reciben el nivel base durante el aprovisionamiento.
create or replace function public.crear_perfil_al_registrarse()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role, current_level_id)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(new.email, '@', 1)
    ),
    'ESTUDIANTE',
    (select id from public.levels where rank = 1 limit 1)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- La regla también se mantiene si un perfil existente cambia al rol alumno o
-- si alguna integración intenta guardar ese rol sin nivel explícito.
create or replace function public.asegurar_nivel_base_estudiante()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.role = 'ESTUDIANTE' and new.current_level_id is null then
    select id
      into new.current_level_id
      from public.levels
     where rank = 1
     order by id
     limit 1;

    if new.current_level_id is null then
      raise exception 'No existe un nivel base con rank 1';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists asegurar_nivel_base_estudiante on public.profiles;
create trigger asegurar_nivel_base_estudiante
before insert or update of role, current_level_id on public.profiles
for each row
execute function public.asegurar_nivel_base_estudiante();
