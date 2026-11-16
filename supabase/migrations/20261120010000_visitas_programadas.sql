-- Etapa 3, paso 6 (primera parte): agenda de visitas (DISENO §4.4:
-- "visitas_programadas: recurrentes por contrato o a solicitud del cliente").
--
-- Una visita a solicitud del cliente es simplemente una orden de servicio
-- programada. Aquí se agregan las visitas recurrentes de un contrato: cada
-- cuánto se visita y cuándo toca la siguiente. Al "programarla" se crea la
-- orden de servicio y la fecha avanza sola al siguiente periodo.
--
-- PENDIENTE(P4): tentativo. Las ven todos los internos; las definen y
-- programan quienes llenan órdenes (Técnico y Dirección).

create table public.visitas_programadas (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null,
  planta_id uuid not null,
  equipo_cliente_id uuid,
  robox_id uuid references public.robox (id),
  -- Técnico que normalmente la atiende. Vacío = quien la programe.
  tecnico_id uuid references public.perfiles (id),
  cada_cantidad integer not null check (cada_cantidad > 0),
  cada_unidad text not null check (cada_unidad in ('dias', 'semanas', 'meses')),
  -- Cuándo toca la siguiente visita. Avanza sola cada vez que se programa.
  proxima_fecha date not null,
  activa boolean not null default true,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  foreign key (contrato_id, planta_id) references public.contratos (id, planta_id),
  foreign key (equipo_cliente_id, planta_id) references public.equipos_cliente (id, planta_id)
);
comment on table public.visitas_programadas is
  'Visita recurrente de un contrato: cada cuánto se visita la planta y cuándo toca la siguiente.';
create index visitas_programadas_contrato_idx on public.visitas_programadas (contrato_id);
create index visitas_programadas_proxima_idx on public.visitas_programadas (proxima_fecha)
  where activa and deleted_at is null;
create index visitas_programadas_equipo_idx on public.visitas_programadas (equipo_cliente_id);
create index visitas_programadas_robox_idx on public.visitas_programadas (robox_id);
create index visitas_programadas_tecnico_idx on public.visitas_programadas (tecnico_id);

create trigger visitas_programadas_set_updated_at before update on public.visitas_programadas
  for each row execute function public.set_updated_at();
create trigger visitas_programadas_set_created_by before insert on public.visitas_programadas
  for each row execute function public.set_created_by();

alter table public.visitas_programadas enable row level security;
revoke all on public.visitas_programadas from anon, authenticated;
grant select, insert, update on public.visitas_programadas to authenticated;
create policy visitas_programadas_select on public.visitas_programadas for select to authenticated
  using ((select public.tiene_permiso('ordenes.ver')));
create policy visitas_programadas_insert on public.visitas_programadas for insert to authenticated
  with check ((select public.tiene_permiso('ordenes.editar')));
create policy visitas_programadas_update on public.visitas_programadas for update to authenticated
  using ((select public.tiene_permiso('ordenes.editar')))
  with check ((select public.tiene_permiso('ordenes.editar')));

-- De qué visita recurrente nació una orden.
alter table public.ordenes_servicio
  add column visita_programada_id uuid references public.visitas_programadas (id);
comment on column public.ordenes_servicio.visita_programada_id is
  'Visita recurrente de la que nació la orden, si no se creó a mano.';
create index ordenes_servicio_visita_idx on public.ordenes_servicio (visita_programada_id);

-- Programa la siguiente visita: crea la orden de servicio para la fecha que
-- toca y avanza la fecha al siguiente periodo, todo o nada. Corre con los
-- permisos de quien la llama (un técnico solo crea órdenes a su nombre).
create function public.programar_visita(p_visita uuid, p_tecnico uuid default null)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v public.visitas_programadas;
  v_cuenta uuid;
  v_orden uuid;
begin
  select * into v from public.visitas_programadas
  where id = p_visita and activa and deleted_at is null
  for update;
  if not found then
    raise exception 'Esa visita recurrente no existe o está pausada.' using errcode = 'P0001';
  end if;
  select cuenta_id into v_cuenta from public.contratos where id = v.contrato_id;

  insert into public.ordenes_servicio (
    tipo, cuenta_id, planta_id, contrato_id, equipo_cliente_id, robox_id,
    tecnico_id, fecha_programada, visita_programada_id
  ) values (
    'visita', v_cuenta, v.planta_id, v.contrato_id, v.equipo_cliente_id, v.robox_id,
    coalesce(p_tecnico, v.tecnico_id, (select auth.uid())), v.proxima_fecha, v.id
  ) returning id into v_orden;

  update public.visitas_programadas
  set proxima_fecha = (proxima_fecha + case cada_unidad
        when 'dias' then make_interval(days => cada_cantidad)
        when 'semanas' then make_interval(weeks => cada_cantidad)
        else make_interval(months => cada_cantidad)
      end)::date
  where id = v.id;

  return v_orden;
end;
$$;
comment on function public.programar_visita(uuid, uuid) is
  'Crea la orden de servicio de una visita recurrente y avanza su próxima fecha. Devuelve el id de la orden.';
revoke execute on function public.programar_visita(uuid, uuid) from public, anon;
grant execute on function public.programar_visita(uuid, uuid) to authenticated;
