-- Etapa 2, paso 4: asignaciones, carrusel y movimientos de Robox (DISENO §4.3).
--
-- Una asignación dice en qué contrato y planta está un Robox y entre qué
-- fechas. Su carrusel son los tanques del cliente que atiende en rotación, y
-- cada movimiento registra el paso de un tanque a otro. La ubicación actual
-- se calcula de ahí (vista robox_ubicacion): no se captura dos veces.
--
-- PENDIENTE(P4): tentativo. Lo editan quienes editan la flota (Dirección y
-- Técnico); lo ven todos los internos.

create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------------
-- Asignaciones
-- ---------------------------------------------------------------------------

create table public.asignaciones_robox (
  id uuid primary key default gen_random_uuid(),
  robox_id uuid not null references public.robox (id),
  contrato_id uuid not null,
  planta_id uuid not null,
  fecha_inicio date not null,
  -- Vacío = sigue asignado. El día de término ya puede iniciar otra asignación.
  fecha_fin date,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  unique (id, planta_id),
  foreign key (contrato_id, planta_id) references public.contratos (id, planta_id),
  constraint asignaciones_robox_fechas_check check (fecha_fin is null or fecha_fin >= fecha_inicio)
);
comment on table public.asignaciones_robox is
  'Qué Robox está en qué contrato y planta, y entre qué fechas. Sin fecha de fin = asignación activa.';
create index asignaciones_robox_robox_idx on public.asignaciones_robox (robox_id);
create index asignaciones_robox_contrato_idx on public.asignaciones_robox (contrato_id);

-- Un Robox no puede estar en dos lugares a la vez.
alter table public.asignaciones_robox
  add constraint asignaciones_robox_sin_traslape
  exclude using gist (
    robox_id with =,
    daterange(fecha_inicio, fecha_fin, '[)') with &&
  ) where (deleted_at is null);

-- ---------------------------------------------------------------------------
-- Carrusel: tanques que atiende el Robox en esa asignación
-- ---------------------------------------------------------------------------

create table public.carrusel_equipos (
  id uuid primary key default gen_random_uuid(),
  asignacion_id uuid not null,
  planta_id uuid not null,
  equipo_cliente_id uuid not null,
  orden integer not null default 0,
  -- PENDIENTE(P1): la regla del ID de caso (ej. RAS1-08) no está confirmada;
  -- se guarda como texto libre.
  id_caso text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  foreign key (asignacion_id, planta_id) references public.asignaciones_robox (id, planta_id),
  foreign key (equipo_cliente_id, planta_id) references public.equipos_cliente (id, planta_id)
);
comment on table public.carrusel_equipos is
  'Tanques o equipos del cliente que un Robox atiende en rotación durante una asignación, con su orden.';
comment on column public.carrusel_equipos.id_caso is
  'ID de caso que se usa en el formato de servicio, el frasco y el informe (ej. RAS1-08).';
create unique index carrusel_equipos_vigente_key
  on public.carrusel_equipos (asignacion_id, equipo_cliente_id) where deleted_at is null;
create index carrusel_equipos_equipo_idx on public.carrusel_equipos (equipo_cliente_id);

-- ---------------------------------------------------------------------------
-- Movimientos: cada rotación de un tanque a otro
-- ---------------------------------------------------------------------------

create table public.movimientos_robox (
  id uuid primary key default gen_random_uuid(),
  asignacion_id uuid not null,
  planta_id uuid not null,
  fecha date not null,
  -- Vacío en la instalación (primer movimiento).
  equipo_origen_id uuid,
  equipo_destino_id uuid not null,
  movido_por text not null check (movido_por in ('mot', 'cliente')),
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  foreign key (asignacion_id, planta_id) references public.asignaciones_robox (id, planta_id),
  foreign key (equipo_origen_id, planta_id) references public.equipos_cliente (id, planta_id),
  foreign key (equipo_destino_id, planta_id) references public.equipos_cliente (id, planta_id),
  constraint movimientos_robox_destino_check check (equipo_origen_id is distinct from equipo_destino_id)
);
comment on table public.movimientos_robox is
  'Cada vez que un Robox se instala o pasa de un tanque a otro: fecha, origen, destino y quién lo movió.';
create index movimientos_robox_asignacion_idx on public.movimientos_robox (asignacion_id, fecha, created_at);
create index movimientos_robox_destino_idx on public.movimientos_robox (equipo_destino_id);
create index movimientos_robox_origen_idx on public.movimientos_robox (equipo_origen_id);

-- ---------------------------------------------------------------------------
-- El estado del Robox sigue a su asignación
-- ---------------------------------------------------------------------------

-- No se asigna un Robox dado de baja o eliminado.
create function public.asignaciones_robox_validar()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_estado text;
  v_borrado timestamptz;
begin
  select estado, deleted_at into v_estado, v_borrado from public.robox where id = new.robox_id;
  if v_borrado is not null or v_estado = 'baja' then
    raise exception 'Ese Robox está dado de baja; no se puede asignar.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger asignaciones_robox_validar before insert on public.asignaciones_robox
  for each row execute function public.asignaciones_robox_validar();

-- Al asignarlo queda "en cliente"; al terminar la asignación vuelve a "disponible".
create function public.asignaciones_robox_sincronizar_estado()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_activa boolean := new.fecha_fin is null and new.deleted_at is null;
  v_antes boolean := tg_op = 'UPDATE' and old.fecha_fin is null and old.deleted_at is null;
begin
  if v_activa and not v_antes then
    update public.robox set estado = 'en_cliente'
    where id = new.robox_id and estado <> 'en_cliente';
  elsif v_antes and not v_activa then
    update public.robox set estado = 'disponible'
    where id = new.robox_id and estado = 'en_cliente';
  end if;
  return new;
end;
$$;
create trigger asignaciones_robox_sincronizar_estado after insert or update on public.asignaciones_robox
  for each row execute function public.asignaciones_robox_sincronizar_estado();

-- Con una asignación activa, el Robox no puede marcarse disponible ni de baja.
create function public.robox_proteger_asignado()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.estado in ('disponible', 'baja') and new.estado is distinct from old.estado
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
create trigger robox_proteger_asignado before update on public.robox
  for each row execute function public.robox_proteger_asignado();

-- ---------------------------------------------------------------------------
-- Ubicación actual (calculada)
-- ---------------------------------------------------------------------------

create view public.robox_ubicacion
with (security_invoker = true) as
select
  a.robox_id,
  a.id as asignacion_id,
  a.contrato_id,
  a.planta_id,
  c.cuenta_id,
  a.fecha_inicio,
  -- El tanque actual es el destino del último movimiento; si no hay
  -- movimientos y el carrusel tiene un solo tanque, es ese.
  coalesce(
    (select m.equipo_destino_id from public.movimientos_robox m
     where m.asignacion_id = a.id and m.deleted_at is null
     order by m.fecha desc, m.created_at desc limit 1),
    (select min(k.equipo_cliente_id::text)::uuid from public.carrusel_equipos k
     where k.asignacion_id = a.id and k.deleted_at is null
     having count(*) = 1)
  ) as equipo_cliente_id
from public.asignaciones_robox a
join public.contratos c on c.id = a.contrato_id
where a.fecha_fin is null and a.deleted_at is null;
comment on view public.robox_ubicacion is
  'Dónde está cada Robox asignado: contrato, planta y tanque actual. Respeta RLS de quien consulta.';

-- Triggers estándar ---------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['asignaciones_robox', 'carrusel_equipos', 'movimientos_robox'] loop
    execute format(
      'create trigger %1$s_set_updated_at before update on public.%1$I
         for each row execute function public.set_updated_at()', t);
    execute format(
      'create trigger %1$s_set_created_by before insert on public.%1$I
         for each row execute function public.set_created_by()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format(
      'create policy %1$s_select on public.%1$I for select to authenticated
         using ((select public.tiene_permiso(''flota.ver'')))', t);
    execute format(
      'create policy %1$s_insert on public.%1$I for insert to authenticated
         with check ((select public.tiene_permiso(''flota.editar'')))', t);
    execute format(
      'create policy %1$s_update on public.%1$I for update to authenticated
         using ((select public.tiene_permiso(''flota.editar'')))
         with check ((select public.tiene_permiso(''flota.editar'')))', t);
  end loop;
end $$;

revoke all on public.robox_ubicacion from anon, authenticated;
grant select on public.robox_ubicacion to authenticated;
