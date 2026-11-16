-- Etapa 3, paso 5 (segunda parte): qué filtro tiene cada Robox, desde cuándo,
-- y cuándo toca cambiarlo (DISENO §4.4: "hoy se hace a los 6 meses o antes si
-- el laboratorio lo indica").
--
-- PENDIENTE(P4): tentativo. Lo editan quienes editan la flota (Dirección y
-- Técnico); lo ven todos los internos.

-- Qué partes del catálogo son filtros a los que se da seguimiento.
alter table public.partes add column es_filtro boolean not null default false;
comment on column public.partes.es_filtro is
  'Verdadero si es un filtro al que se le da seguimiento en cada Robox (cuándo se instaló y cuándo toca cambiarlo).';
update public.partes set es_filtro = true
where nombre in ('Filtro SKF500/HY (Core)', 'Filtro SKF500/DST', 'Filtro sinterizado');

-- Cada cuánto se cambia un filtro. Es política de MOT: se edita en Parámetros.
insert into public.parametros_negocio (clave, valor, unidad, moneda, descripcion) values
  ('filtro_cambio_meses', 6, 'meses', null,
   'Meses que dura un filtro instalado en un Robox antes de que toque cambiarlo.');

-- El técnico no ve los parámetros (incluyen precios), pero sí necesita este
-- para saber cuándo toca el cambio.
create function public.filtro_cambio_meses()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case when (select public.tiene_permiso('flota.ver')) then (
    select valor::integer from public.parametros_negocio where clave = 'filtro_cambio_meses'
  ) end;
$$;
comment on function public.filtro_cambio_meses() is
  'Meses de duración de un filtro, para quien ve la flota.';
revoke execute on function public.filtro_cambio_meses() from public, anon;
grant execute on function public.filtro_cambio_meses() to authenticated;

-- ---------------------------------------------------------------------------
-- Filtros instalados
-- ---------------------------------------------------------------------------
create table public.filtros_instalados (
  id uuid primary key default gen_random_uuid(),
  robox_id uuid not null references public.robox (id),
  parte_id uuid not null references public.partes (id),
  fecha_instalacion date not null,
  -- Vacío = sigue instalado.
  fecha_retiro date,
  -- Orden de servicio en la que se instaló, si el sistema lo registró al cerrarla.
  orden_id uuid references public.ordenes_servicio (id),
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  constraint filtros_instalados_fechas_check
    check (fecha_retiro is null or fecha_retiro >= fecha_instalacion)
);
comment on table public.filtros_instalados is
  'Qué filtro tiene cada Robox, desde cuándo y cuándo se retiró. Sin fecha de retiro = instalado.';
create index filtros_instalados_robox_idx on public.filtros_instalados (robox_id);
create index filtros_instalados_parte_idx on public.filtros_instalados (parte_id);
create index filtros_instalados_orden_idx on public.filtros_instalados (orden_id);
-- Un Robox no tiene dos filtros iguales instalados a la vez.
create unique index filtros_instalados_activo_key on public.filtros_instalados (robox_id, parte_id)
  where fecha_retiro is null and deleted_at is null;

-- Solo se da seguimiento a las partes marcadas como filtro.
create function public.filtros_instalados_validar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.partes p where p.id = new.parte_id and p.es_filtro) then
    raise exception 'Esa parte no está marcada como filtro en el catálogo.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger filtros_instalados_validar before insert or update of parte_id on public.filtros_instalados
  for each row execute function public.filtros_instalados_validar();

create trigger filtros_instalados_set_updated_at before update on public.filtros_instalados
  for each row execute function public.set_updated_at();
create trigger filtros_instalados_set_created_by before insert on public.filtros_instalados
  for each row execute function public.set_created_by();

alter table public.filtros_instalados enable row level security;
revoke all on public.filtros_instalados from anon, authenticated;
grant select, insert, update on public.filtros_instalados to authenticated;
create policy filtros_instalados_select on public.filtros_instalados for select to authenticated
  using ((select public.tiene_permiso('flota.ver')));
create policy filtros_instalados_insert on public.filtros_instalados for insert to authenticated
  with check ((select public.tiene_permiso('flota.editar')));
create policy filtros_instalados_update on public.filtros_instalados for update to authenticated
  using ((select public.tiene_permiso('flota.editar')))
  with check ((select public.tiene_permiso('flota.editar')));

-- Al cerrar una orden que usó un filtro en un Robox, el sistema anota el
-- cambio: retira el filtro igual que estaba instalado y registra el nuevo.
create function public.ordenes_servicio_registrar_filtros()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fecha date := coalesce(new.fecha_real, (now() at time zone 'America/Mexico_City')::date);
begin
  if new.estado = 'cerrada' and old.estado <> 'cerrada' and new.robox_id is not null then
    update public.filtros_instalados f
    set fecha_retiro = greatest(v_fecha, f.fecha_instalacion)
    where f.robox_id = new.robox_id
      and f.fecha_retiro is null and f.deleted_at is null
      and f.parte_id in (
        select p.parte_id from public.os_partes p
        join public.partes pa on pa.id = p.parte_id and pa.es_filtro
        where p.orden_id = new.id
      );
    insert into public.filtros_instalados (robox_id, parte_id, fecha_instalacion, orden_id, created_by)
    select new.robox_id, p.parte_id, v_fecha, new.id, (select auth.uid())
    from public.os_partes p
    join public.partes pa on pa.id = p.parte_id and pa.es_filtro
    where p.orden_id = new.id;
  end if;
  return new;
end;
$$;
create trigger ordenes_servicio_registrar_filtros after update on public.ordenes_servicio
  for each row execute function public.ordenes_servicio_registrar_filtros();
