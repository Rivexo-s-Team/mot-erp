-- Etapa 3, paso 1: órdenes de servicio, lo básico (DISENO §4.4).
--
-- La orden es la versión digital del formato "Servicio RecondOil Box". Aquí
-- va el encabezado: a quién se visita, con qué Robox, quién va y cuándo. Las
-- lecturas, actividades, fallas, partes, fotos y firmas llegan en los pasos
-- siguientes.
--
-- PENDIENTE(P4): accesos tentativos. Todos los internos consultan; Técnico y
-- Dirección crean y llenan; el técnico solo edita las suyas; Dirección, todas.

create table public.ordenes_servicio (
  id uuid primary key default gen_random_uuid(),
  -- Se genera solo: AAMMDD + iniciales del técnico (ej. "261102 DV").
  folio text not null unique,
  tipo text not null check (tipo in ('visita', 'taller')),
  estado text not null default 'programada'
    check (estado in ('programada', 'en_curso', 'cerrada', 'cancelada')),
  -- Una visita es a una planta; un servicio de taller puede no tener cliente.
  cuenta_id uuid references public.cuentas (id),
  planta_id uuid,
  contrato_id uuid,
  equipo_cliente_id uuid,
  robox_id uuid references public.robox (id),
  tecnico_id uuid not null references public.perfiles (id),
  acompanante_id uuid references public.perfiles (id),
  fecha_programada date not null,
  fecha_real date,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  foreign key (planta_id, cuenta_id) references public.plantas (id, cuenta_id),
  foreign key (contrato_id, planta_id) references public.contratos (id, planta_id),
  foreign key (equipo_cliente_id, planta_id) references public.equipos_cliente (id, planta_id),
  constraint ordenes_servicio_visita_check
    check (tipo <> 'visita' or (cuenta_id is not null and planta_id is not null)),
  constraint ordenes_servicio_planta_check
    check (planta_id is not null or (contrato_id is null and equipo_cliente_id is null)),
  constraint ordenes_servicio_acompanante_check check (acompanante_id is distinct from tecnico_id)
);
comment on table public.ordenes_servicio is
  'Orden de servicio (formato "Servicio RecondOil Box"): visita a una planta o trabajo en taller.';
comment on column public.ordenes_servicio.fecha_real is 'Día en que se hizo el servicio. Se llena al iniciar la orden.';
create index ordenes_servicio_tecnico_idx on public.ordenes_servicio (tecnico_id, fecha_programada)
  where deleted_at is null;
create index ordenes_servicio_estado_idx on public.ordenes_servicio (estado) where deleted_at is null;
create index ordenes_servicio_cuenta_idx on public.ordenes_servicio (cuenta_id);
create index ordenes_servicio_planta_idx on public.ordenes_servicio (planta_id);
create index ordenes_servicio_contrato_idx on public.ordenes_servicio (contrato_id);
create index ordenes_servicio_equipo_idx on public.ordenes_servicio (equipo_cliente_id);
create index ordenes_servicio_robox_idx on public.ordenes_servicio (robox_id);
create index ordenes_servicio_acompanante_idx on public.ordenes_servicio (acompanante_id);

-- Folio: fecha programada + iniciales del técnico; si ese técnico ya tiene una
-- orden ese día, se agrega un consecutivo ("261102 DV 2").
create function public.ordenes_servicio_asignar_folio()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nombre text;
  v_base text;
  v_folio text;
  v_n integer := 1;
begin
  select nombre into v_nombre from public.perfiles where id = new.tecnico_id;
  v_base := to_char(new.fecha_programada, 'YYMMDD') || ' ' || upper(
    left(split_part(btrim(coalesce(v_nombre, '?')), ' ', 1), 1)
    || left(split_part(btrim(coalesce(v_nombre, '?')), ' ', 2), 1)
  );
  -- Evita que dos altas simultáneas tomen el mismo folio.
  perform pg_advisory_xact_lock(hashtext(v_base));
  v_folio := v_base;
  while exists (select 1 from public.ordenes_servicio where folio = v_folio) loop
    v_n := v_n + 1;
    v_folio := v_base || ' ' || v_n;
  end loop;
  new.folio := v_folio;
  return new;
end;
$$;
create trigger ordenes_servicio_asignar_folio before insert on public.ordenes_servicio
  for each row execute function public.ordenes_servicio_asignar_folio();

-- Una orden cerrada ya no cambia, y el folio nunca cambia.
create function public.ordenes_servicio_proteger()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.estado = 'cerrada' then
    raise exception 'La orden ya está cerrada y no se puede cambiar.' using errcode = 'P0001';
  end if;
  new.folio := old.folio;
  return new;
end;
$$;
create trigger ordenes_servicio_proteger before update on public.ordenes_servicio
  for each row execute function public.ordenes_servicio_proteger();

create trigger ordenes_servicio_set_updated_at before update on public.ordenes_servicio
  for each row execute function public.set_updated_at();
create trigger ordenes_servicio_set_created_by before insert on public.ordenes_servicio
  for each row execute function public.set_created_by();

-- ---------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------
insert into public.permisos (clave, descripcion) values
  ('ordenes.ver', 'Consultar las órdenes de servicio.'),
  ('ordenes.editar', 'Crear órdenes de servicio y llenar las propias.'),
  ('ordenes.administrar', 'Editar cualquier orden de servicio y asignarla a otro técnico.');

insert into public.rol_permisos (rol_id, permiso_id)
select r.id, p.id
from (values
  ('direccion', 'ordenes.ver'), ('comercial', 'ordenes.ver'), ('tecnico', 'ordenes.ver'),
  ('laboratorio', 'ordenes.ver'), ('administracion', 'ordenes.ver'),
  ('direccion', 'ordenes.editar'), ('tecnico', 'ordenes.editar'),
  ('direccion', 'ordenes.administrar')
) as m (rol, permiso)
join public.roles r on r.clave = m.rol
join public.permisos p on p.clave = m.permiso;

-- Nombres de los usuarios internos para mostrarlos en las órdenes y elegir
-- técnico, sin abrir la tabla de perfiles (que guarda correo y rol).
create function public.directorio_tecnicos()
returns table (id uuid, nombre text, asignable boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    pf.id,
    pf.nombre,
    pf.activo and exists (
      select 1
      from public.rol_permisos rp
      join public.permisos pe on pe.id = rp.permiso_id
      where rp.rol_id = pf.rol_id and pe.clave = 'ordenes.editar'
    ) as asignable
  from public.perfiles pf
  join public.roles r on r.id = pf.rol_id
  where r.es_interno
    and (select public.tiene_permiso('ordenes.ver'));
$$;
comment on function public.directorio_tecnicos() is
  'Id y nombre de los usuarios internos; asignable = puede llevar una orden de servicio. Solo responde a quien ve las órdenes.';
revoke execute on function public.directorio_tecnicos() from public, anon;
grant execute on function public.directorio_tecnicos() to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.ordenes_servicio enable row level security;
revoke all on public.ordenes_servicio from anon, authenticated;
grant select, insert, update on public.ordenes_servicio to authenticated;

create policy ordenes_servicio_select on public.ordenes_servicio for select to authenticated
  using ((select public.tiene_permiso('ordenes.ver')));

-- Un técnico crea órdenes a su nombre; Dirección, a nombre de cualquiera.
create policy ordenes_servicio_insert on public.ordenes_servicio for insert to authenticated
  with check (
    (select public.tiene_permiso('ordenes.editar'))
    and (tecnico_id = (select auth.uid()) or (select public.tiene_permiso('ordenes.administrar')))
  );

-- Un técnico edita las órdenes donde va como responsable o acompañante.
create policy ordenes_servicio_update on public.ordenes_servicio for update to authenticated
  using (
    (select public.tiene_permiso('ordenes.editar'))
    and (
      tecnico_id = (select auth.uid())
      or acompanante_id = (select auth.uid())
      or (select public.tiene_permiso('ordenes.administrar'))
    )
  )
  with check (
    (select public.tiene_permiso('ordenes.editar'))
    and (
      tecnico_id = (select auth.uid())
      or acompanante_id = (select auth.uid())
      or (select public.tiene_permiso('ordenes.administrar'))
    )
  );
