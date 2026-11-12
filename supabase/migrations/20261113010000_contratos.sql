-- Etapa 2, paso 2: contratos y sus tarifas (DISENO §4.3, decisiones D2, D15, D18, D19).
--
-- Un contrato es por planta y por negociación. Los datos generales los ven
-- todos los internos; los precios (tarifas) van en tabla aparte y solo los ve
-- quien tiene precios.ver. Todo cambio queda en la bitácora.

-- Llaves para que la base impida mezclar datos de dos cuentas, plantas u oportunidades.
alter table public.equipos_cliente
  add constraint equipos_cliente_id_planta_key unique (id, planta_id);
alter table public.cotizaciones
  add constraint cotizaciones_id_oportunidad_key unique (id, oportunidad_id);
alter table public.oportunidades
  add constraint oportunidades_id_cuenta_key unique (id, cuenta_id);

-- ---------------------------------------------------------------------------
-- Contratos
-- ---------------------------------------------------------------------------

create table public.contratos (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references public.cuentas (id),
  planta_id uuid not null,
  razon_social_id uuid,
  tipo text not null
    check (tipo in ('renta', 'por_evento', 'unico', 'servicio', 'laboratorio')),
  estado text not null default 'borrador'
    check (estado in ('borrador', 'vigente', 'terminado', 'cancelado')),
  referencia text,
  -- Ampliación: el contrato del que nace. Vacío si es un contrato nuevo.
  contrato_origen_id uuid,
  -- De dónde salió: la oportunidad ganada y su cotización aceptada.
  oportunidad_id uuid,
  cotizacion_id uuid,
  fecha_inicio date,
  fecha_termino date,
  moneda text not null default 'USD' check (moneda ~ '^[A-Z]{3}$'),
  incluye_filtros boolean not null default false,
  incluye_laboratorio boolean not null default false,
  frecuencia_visitas text,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  unique (id, cuenta_id),
  unique (id, planta_id),
  foreign key (planta_id, cuenta_id) references public.plantas (id, cuenta_id),
  foreign key (razon_social_id, cuenta_id) references public.razones_sociales (id, cuenta_id),
  foreign key (contrato_origen_id, cuenta_id) references public.contratos (id, cuenta_id),
  foreign key (oportunidad_id, cuenta_id) references public.oportunidades (id, cuenta_id),
  foreign key (cotizacion_id, oportunidad_id) references public.cotizaciones (id, oportunidad_id),
  constraint contratos_vigencia_check
    check (fecha_inicio is null or fecha_termino is null or fecha_termino >= fecha_inicio),
  constraint contratos_origen_check check (contrato_origen_id is distinct from id),
  constraint contratos_cotizacion_check check (cotizacion_id is null or oportunidad_id is not null)
);
comment on table public.contratos is
  'Negociación con una planta: tipo, vigencia y condiciones. Los precios están en contrato_tarifas.';
comment on column public.contratos.razon_social_id is 'Razón social a la que se factura este contrato.';
comment on column public.contratos.referencia is
  'Número o nombre con el que MOT o el cliente identifican el contrato. Opcional.';
comment on column public.contratos.moneda is 'Moneda de todas las tarifas del contrato.';
create index contratos_cuenta_idx on public.contratos (cuenta_id);
create index contratos_planta_idx on public.contratos (planta_id);
create index contratos_estado_idx on public.contratos (estado) where deleted_at is null;
create index contratos_origen_idx on public.contratos (contrato_origen_id);
create index contratos_cotizacion_idx on public.contratos (cotizacion_id);
-- Una oportunidad ganada da lugar a un solo contrato vigente en el sistema.
create unique index contratos_oportunidad_vigente_key on public.contratos (oportunidad_id)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Tarifas (precios)
-- ---------------------------------------------------------------------------

create table public.contrato_tarifas (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null,
  -- Se repite la planta del contrato para poder exigir que el equipo sea de esa planta.
  planta_id uuid not null,
  orden integer not null default 0,
  concepto text not null check (length(btrim(concepto)) > 0),
  -- 'unico' = pago de una sola vez (anticipo, instalación). Ver D15.
  unidad text not null check (unidad in ('mes', 'litro', 'evento', 'servicio', 'unico')),
  precio numeric not null check (precio >= 0),
  equipo_cliente_id uuid,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  foreign key (contrato_id, planta_id) references public.contratos (id, planta_id) on update cascade,
  foreign key (equipo_cliente_id, planta_id) references public.equipos_cliente (id, planta_id)
);
comment on table public.contrato_tarifas is
  'Precios de un contrato, sin IVA y en la moneda del contrato. En una renta hay una línea por cada Robox rentado (D18).';
comment on column public.contrato_tarifas.equipo_cliente_id is
  'Equipo o tanque del cliente al que aplica el precio, si es específico.';
create index contrato_tarifas_contrato_idx on public.contrato_tarifas (contrato_id, orden);
create index contrato_tarifas_equipo_idx on public.contrato_tarifas (equipo_cliente_id);

-- Resumen de precios por contrato.
create view public.contrato_totales
with (security_invoker = true) as
select
  c.id as contrato_id,
  coalesce(sum(t.precio) filter (where t.unidad = 'mes'), 0) as total_mensual,
  coalesce(sum(t.precio) filter (where t.unidad = 'unico'), 0) as total_unico,
  count(t.id)::integer as tarifas
from public.contratos c
left join public.contrato_tarifas t on t.contrato_id = c.id and t.deleted_at is null
group by c.id;
comment on view public.contrato_totales is
  'Suma de las tarifas vigentes: lo mensual y lo de una sola vez. Respeta RLS de quien consulta.';

-- Triggers estándar y bitácora ----------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['contratos', 'contrato_tarifas'] loop
    execute format(
      'create trigger %1$s_set_updated_at before update on public.%1$I
         for each row execute function public.set_updated_at()', t);
    execute format(
      'create trigger %1$s_set_created_by before insert on public.%1$I
         for each row execute function public.set_created_by()', t);
    execute format(
      'create trigger %1$s_bitacora after insert or update or delete on public.%1$I
         for each row execute function public.registrar_bitacora()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------
-- PENDIENTE(P4): tentativo (D19). Todos los internos consultan los contratos;
-- los editan Dirección y Administración. Los precios, solo quien tiene precios.ver.
insert into public.permisos (clave, descripcion) values
  ('contratos.ver', 'Consultar los contratos (sin precios).'),
  ('contratos.editar', 'Crear y editar contratos y sus tarifas.');

insert into public.rol_permisos (rol_id, permiso_id)
select r.id, p.id
from (values
  ('direccion', 'contratos.ver'), ('comercial', 'contratos.ver'), ('tecnico', 'contratos.ver'),
  ('laboratorio', 'contratos.ver'), ('administracion', 'contratos.ver'),
  ('direccion', 'contratos.editar'), ('administracion', 'contratos.editar')
) as m (rol, permiso)
join public.roles r on r.clave = m.rol
join public.permisos p on p.clave = m.permiso;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.contratos enable row level security;
revoke all on public.contratos from anon, authenticated;
grant select, insert, update on public.contratos to authenticated;
create policy contratos_select on public.contratos for select to authenticated
  using ((select public.tiene_permiso('contratos.ver')));
create policy contratos_insert on public.contratos for insert to authenticated
  with check ((select public.tiene_permiso('contratos.editar')));
create policy contratos_update on public.contratos for update to authenticated
  using ((select public.tiene_permiso('contratos.editar')))
  with check ((select public.tiene_permiso('contratos.editar')));

alter table public.contrato_tarifas enable row level security;
revoke all on public.contrato_tarifas from anon, authenticated;
grant select, insert, update on public.contrato_tarifas to authenticated;
create policy contrato_tarifas_select on public.contrato_tarifas for select to authenticated
  using ((select public.tiene_permiso('contratos.ver'))
     and (select public.tiene_permiso('precios.ver')));
create policy contrato_tarifas_insert on public.contrato_tarifas for insert to authenticated
  with check ((select public.tiene_permiso('contratos.editar'))
          and (select public.tiene_permiso('precios.ver')));
create policy contrato_tarifas_update on public.contrato_tarifas for update to authenticated
  using ((select public.tiene_permiso('contratos.editar'))
     and (select public.tiene_permiso('precios.ver')))
  with check ((select public.tiene_permiso('contratos.editar'))
          and (select public.tiene_permiso('precios.ver')));

revoke all on public.contrato_totales from anon, authenticated;
grant select on public.contrato_totales to authenticated;
