-- Ajustes a cotizaciones y pipeline con las respuestas del director comercial
-- (12 nov 2026): folio anual, estados aceptada y rechazada, datos del formato
-- real de MOT, cotizador a partir del costo del contenedor y motivos de pérdida.

-- ---------------------------------------------------------------------------
-- Folio anual de cotización: CMOT AAAA-NNN
-- ---------------------------------------------------------------------------

create table public.folios_cotizacion (
  anio integer primary key check (anio between 2020 and 2100),
  ultimo integer not null default 0 check (ultimo >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.folios_cotizacion is
  'Último consecutivo de cotización usado en cada año. El folio se forma como CMOT AAAA-NNN.';

-- Nadie la toca desde la app: solo la función que reparte folios.
alter table public.folios_cotizacion enable row level security;
revoke all on public.folios_cotizacion from anon, authenticated;

create trigger folios_cotizacion_set_updated_at before update on public.folios_cotizacion
  for each row execute function public.set_updated_at();

create function public.siguiente_folio_cotizacion()
returns text
language plpgsql
security definer -- la tabla de consecutivos no es accesible para los usuarios
set search_path = ''
as $$
declare
  v_anio integer := extract(year from (now() at time zone 'America/Mexico_City'))::integer;
  v_numero integer;
begin
  -- El insert con "on conflict" bloquea la fila del año: dos cotizaciones
  -- creadas al mismo tiempo nunca reciben el mismo número.
  insert into public.folios_cotizacion as f (anio, ultimo)
  values (v_anio, 1)
  on conflict (anio) do update set ultimo = f.ultimo + 1
  returning ultimo into v_numero;
  return 'CMOT ' || v_anio || '-' || lpad(v_numero::text, 3, '0');
end;
$$;
revoke execute on function public.siguiente_folio_cotizacion() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Cotizaciones: folio, estados y datos del formato de MOT
-- ---------------------------------------------------------------------------

alter table public.cotizaciones
  add column folio text,
  add column contacto_id uuid references public.contactos (id),
  add column numero_requisicion text,
  add column condiciones_pago text;

comment on column public.cotizaciones.folio is
  'Folio anual (CMOT AAAA-NNN). Las versiones de una misma cotización comparten folio.';
comment on column public.cotizaciones.contacto_id is 'Persona del cliente a quien va dirigida ("Atención").';
comment on column public.cotizaciones.numero_requisicion is 'Número de requisición del cliente, si lo dio.';
comment on column public.cotizaciones.condiciones_pago is 'Ej. "Contado", "30 días".';
comment on column public.cotizaciones.condiciones is
  'Notas para el cliente, una por línea; en el PDF salen numeradas.';

-- Las cotizaciones que ya existían reciben su folio (una por versión 1; las
-- demás versiones heredan el de su oportunidad).
do $$
declare c record;
begin
  for c in
    select distinct on (oportunidad_id) oportunidad_id
    from public.cotizaciones order by oportunidad_id, version
  loop
    update public.cotizaciones set folio = public.siguiente_folio_cotizacion()
    where oportunidad_id = c.oportunidad_id;
  end loop;
end $$;

alter table public.cotizaciones alter column folio set not null;
create unique index cotizaciones_folio_version_key on public.cotizaciones (folio, version)
  where deleted_at is null;
create index cotizaciones_contacto_idx on public.cotizaciones (contacto_id);

-- Al crear: la primera cotización de una oportunidad estrena folio; las
-- versiones siguientes usan el mismo.
create function public.cotizaciones_asignar_folio()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.folio is null then
    select folio into new.folio from public.cotizaciones
    where oportunidad_id = new.oportunidad_id
    order by version limit 1;
    if new.folio is null then
      new.folio := public.siguiente_folio_cotizacion();
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.cotizaciones_asignar_folio() from public, anon, authenticated;

create trigger cotizaciones_asignar_folio before insert on public.cotizaciones
  for each row execute function public.cotizaciones_asignar_folio();

-- Estados: borrador → enviada → aceptada | rechazada.
alter table public.cotizaciones drop constraint cotizaciones_estado_check;
alter table public.cotizaciones add constraint cotizaciones_estado_check
  check (estado in ('borrador', 'enviada', 'aceptada', 'rechazada'));

-- Fuera de borrador solo cambia el estado (y nunca regresa a borrador).
create or replace function public.cotizaciones_proteger_enviada()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.estado <> 'borrador' then
    if to_jsonb(new) - array['estado', 'deleted_at', 'updated_at']
         is distinct from to_jsonb(old) - array['estado', 'deleted_at', 'updated_at'] then
      raise exception 'La cotización ya fue enviada; crea una versión nueva para cambiarla.'
        using errcode = 'P0001';
    end if;
    if new.estado = 'borrador' then
      raise exception 'Una cotización enviada no puede volver a borrador.'
        using errcode = 'P0001';
    end if;
  elsif new.estado in ('aceptada', 'rechazada') then
    raise exception 'Primero hay que marcar la cotización como enviada.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace function public.cotizacion_lineas_proteger_enviada()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_estado text;
begin
  select estado into v_estado from public.cotizaciones
  where id = coalesce(new.cotizacion_id, old.cotizacion_id);
  if v_estado <> 'borrador' then
    raise exception 'La cotización ya fue enviada; crea una versión nueva para cambiarla.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Partidas: número de parte del cliente y cotizador desde el contenedor
-- ---------------------------------------------------------------------------

alter table public.cotizacion_lineas
  add column numero_parte_cliente text,
  add column referencia_costo_contenedor numeric check (referencia_costo_contenedor > 0),
  add column referencia_litros_contenedor numeric check (referencia_litros_contenedor > 0),
  add constraint cotizacion_lineas_contenedor_check
    check ((referencia_costo_contenedor is null) = (referencia_litros_contenedor is null));

comment on column public.cotizacion_lineas.numero_parte_cliente is
  'Número de parte o clave con que el cliente identifica el servicio en su sistema.';
comment on column public.cotizacion_lineas.referencia_costo_contenedor is
  'Lo que paga el cliente por un contenedor de aceite nuevo; con los litros da el precio de referencia.';

-- ---------------------------------------------------------------------------
-- Vigencia por defecto de una cotización
-- ---------------------------------------------------------------------------

insert into public.parametros_negocio (clave, valor, unidad, moneda, descripcion) values
  ('cotizacion_vigencia_dias', 15, 'dias', null,
   'Días de vigencia que se proponen al crear una cotización.');

-- ---------------------------------------------------------------------------
-- Motivos de pérdida
-- ---------------------------------------------------------------------------

create table public.motivos_perdida (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique check (length(btrim(nombre)) > 0),
  orden integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);
comment on table public.motivos_perdida is 'Motivos típicos por los que se pierde una venta.';

create trigger motivos_perdida_set_updated_at before update on public.motivos_perdida
  for each row execute function public.set_updated_at();
create trigger motivos_perdida_set_created_by before insert on public.motivos_perdida
  for each row execute function public.set_created_by();

alter table public.motivos_perdida enable row level security;
revoke all on public.motivos_perdida from anon, authenticated;
grant select, insert, update on public.motivos_perdida to authenticated;
create policy motivos_perdida_select on public.motivos_perdida for select to authenticated
  using ((select public.tiene_permiso('oportunidades.ver')));
create policy motivos_perdida_insert on public.motivos_perdida for insert to authenticated
  with check ((select public.tiene_permiso('oportunidades.editar')));
create policy motivos_perdida_update on public.motivos_perdida for update to authenticated
  using ((select public.tiene_permiso('oportunidades.editar')))
  with check ((select public.tiene_permiso('oportunidades.editar')));

-- Los que dio el director comercial.
insert into public.motivos_perdida (nombre, orden) values
  ('Ya tienen un sistema de filtrado', 10),
  ('No cambian el aceite', 20),
  ('No les interesa cambiar su sistema actual', 30),
  ('No hay aceite suficiente para el servicio', 40),
  ('Temen que afecte al equipo', 50),
  ('No se llegó a quien toma la decisión', 60),
  ('No les interesan proyectos nuevos', 70);

alter table public.oportunidades
  add column motivo_perdida_id uuid references public.motivos_perdida (id);
comment on column public.oportunidades.motivo_perdida_id is 'Motivo de la lista; el detalle va en motivo_perdida.';
comment on column public.oportunidades.motivo_perdida is 'Detalle libre del motivo de la pérdida (opcional si se eligió uno de la lista).';
create index oportunidades_motivo_perdida_idx on public.oportunidades (motivo_perdida_id);

-- Perdida exige un motivo: de la lista, escrito, o ambos.
alter table public.oportunidades drop constraint oportunidades_motivo_perdida_check;
alter table public.oportunidades add constraint oportunidades_motivo_perdida_check
  check (
    etapa <> 'perdida'
    or motivo_perdida_id is not null
    or coalesce(length(btrim(motivo_perdida)), 0) > 0
  );

create or replace function public.oportunidades_al_cambiar_etapa()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.etapa in ('ganada', 'perdida') then
    if tg_op = 'INSERT' or old.etapa is distinct from new.etapa then
      new.fecha_cierre := now();
    end if;
  else
    new.fecha_cierre := null;
  end if;
  if new.etapa <> 'perdida' then
    new.motivo_perdida := null;
    new.motivo_perdida_id := null;
  end if;
  return new;
end;
$$;
