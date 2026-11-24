-- Estado "Bloqueado" para los Robox (DISENO §9, D60): la unidad está en el
-- almacén pero apartada para un cliente o un proyecto, así que no debe
-- ofrecerse a otro. Es el que MOT usa en su inventario ("Bloqueado, para X").
-- Para quién está apartado se anota en las notas del Robox.
alter table public.robox drop constraint robox_estado_check;
alter table public.robox add constraint robox_estado_check
  check (estado in ('disponible', 'bloqueado', 'en_cliente', 'en_taller', 'baja'));
comment on column public.robox.estado is
  'disponible: en almacén. bloqueado: en almacén, apartado para un cliente. en_cliente: asignado a un contrato. en_taller: en limpieza o reparación. baja: vendido o fuera de servicio.';

-- Con una asignación activa, el Robox tampoco puede marcarse bloqueado: sigue
-- en cliente hasta que termine la asignación. Sí se puede asignar un Robox
-- bloqueado (es el paso natural: se apartó para ese cliente).
create or replace function public.robox_proteger_asignado()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.estado in ('disponible', 'bloqueado', 'baja') and new.estado is distinct from old.estado
      or new.deleted_at is not null and old.deleted_at is null)
     and exists (
       select 1 from public.asignaciones_robox a
       where a.robox_id = new.id and a.fecha_fin is null and a.deleted_at is null
     ) then
    raise exception 'El Robox está asignado a un contrato; termina primero su asignación.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;
