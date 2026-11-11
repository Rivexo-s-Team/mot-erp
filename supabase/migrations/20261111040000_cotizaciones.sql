-- Etapa 1, paso 4: cotizaciones de partidas libres (DISENO §4.2, decisión D10).
-- Son precios: solo las ve quien tiene precios.ver, y todo cambio queda en la bitácora.

-- ---------------------------------------------------------------------------
-- Cotizaciones
-- ---------------------------------------------------------------------------

create table public.cotizaciones (
  id uuid primary key default gen_random_uuid(),
  oportunidad_id uuid not null references public.oportunidades (id),
  version integer not null check (version > 0),
  estado text not null default 'borrador' check (estado in ('borrador', 'enviada')),
  moneda text not null default 'USD' check (moneda ~ '^[A-Z]{3}$'),
  -- Unidades de `moneda` por 1 USD. Solo se pide cuando la cotización no es en USD.
  tipo_cambio numeric check (tipo_cambio > 0),
  vigencia date,
  valor_total_contrato numeric check (valor_total_contrato > 0),
  litros_estimados numeric check (litros_estimados > 0),
  condiciones text,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  constraint cotizaciones_moneda_tipo_cambio_check
    check (moneda = 'USD' or tipo_cambio is not null)
);
comment on table public.cotizaciones is
  'Cotización de una oportunidad, por versiones. En borrador se puede editar; enviada queda fija y los cambios van en una versión nueva.';
comment on column public.cotizaciones.valor_total_contrato is
  'Valor total del contrato (TCV) cuando es renta, en la moneda de la cotización.';
comment on column public.cotizaciones.litros_estimados is
  'Litros estimados a vender cuando se cotiza por litro.';
comment on column public.cotizaciones.condiciones is
  'Condiciones comerciales que se muestran al cliente (pago, anticipo, vigencia…).';
create unique index cotizaciones_version_vigente_key on public.cotizaciones (oportunidad_id, version)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Partidas
-- ---------------------------------------------------------------------------

create table public.cotizacion_lineas (
  id uuid primary key default gen_random_uuid(),
  cotizacion_id uuid not null references public.cotizaciones (id),
  orden integer not null default 0,
  concepto text not null check (length(btrim(concepto)) > 0),
  equipo_cliente_id uuid references public.equipos_cliente (id),
  cantidad numeric not null check (cantidad > 0),
  unidad text not null check (unidad in ('litro', 'mes', 'evento', 'servicio')),
  precio_unitario numeric not null check (precio_unitario >= 0),
  recurrente boolean not null default false,
  -- Cotizador por litro: de dónde salió el precio.
  precio_referencia numeric check (precio_referencia > 0),
  fuente_tipo text check (fuente_tipo in ('comprobante_cliente', 'internet')),
  fuente_url text,
  fecha_referencia date,
  importe numeric generated always as (round(cantidad * precio_unitario, 2)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz
);
comment on table public.cotizacion_lineas is
  'Partidas de una cotización. Las captura libremente el vendedor; el cotizador por litro solo sugiere el precio.';
comment on column public.cotizacion_lineas.recurrente is
  'Verdadero si la partida se cobra cada periodo (ej. renta mensual); falso si es de una sola vez.';
comment on column public.cotizacion_lineas.precio_referencia is
  'Precio del aceite nuevo por litro que sirvió de referencia, en la moneda de la cotización.';
create index cotizacion_lineas_cotizacion_idx on public.cotizacion_lineas (cotizacion_id, orden);
create index cotizacion_lineas_equipo_idx on public.cotizacion_lineas (equipo_cliente_id);

-- Una cotización enviada ya no cambia: ni sus datos ni sus partidas.
create function public.cotizaciones_proteger_enviada()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.estado = 'enviada' and (
    to_jsonb(new) - array['estado', 'deleted_at', 'updated_at']
      is distinct from to_jsonb(old) - array['estado', 'deleted_at', 'updated_at']
  ) then
    raise exception 'La cotización ya fue enviada; crea una versión nueva para cambiarla.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger cotizaciones_proteger_enviada before update on public.cotizaciones
  for each row execute function public.cotizaciones_proteger_enviada();

create function public.cotizacion_lineas_proteger_enviada()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_estado text;
begin
  select estado into v_estado from public.cotizaciones
  where id = coalesce(new.cotizacion_id, old.cotizacion_id);
  if v_estado = 'enviada' then
    raise exception 'La cotización ya fue enviada; crea una versión nueva para cambiarla.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger cotizacion_lineas_proteger_enviada before insert or update on public.cotizacion_lineas
  for each row execute function public.cotizacion_lineas_proteger_enviada();

-- Totales por cotización, separando lo recurrente de lo de una sola vez.
create view public.cotizacion_totales
with (security_invoker = true) as
select
  c.id as cotizacion_id,
  coalesce(sum(l.importe) filter (where not l.recurrente), 0) as total_unico,
  coalesce(sum(l.importe) filter (where l.recurrente), 0) as total_recurrente,
  count(l.id)::integer as partidas
from public.cotizaciones c
left join public.cotizacion_lineas l on l.cotizacion_id = c.id and l.deleted_at is null
group by c.id;
comment on view public.cotizacion_totales is
  'Suma de las partidas vigentes. Respeta RLS de quien consulta (security_invoker).';

-- Triggers estándar y bitácora ----------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['cotizaciones', 'cotizacion_lineas'] loop
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
-- RLS: ver = pipeline + precios; editar = editar pipeline + precios
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['cotizaciones', 'cotizacion_lineas'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format(
      'create policy %1$s_select on public.%1$I for select to authenticated
         using ((select public.tiene_permiso(''oportunidades.ver''))
            and (select public.tiene_permiso(''precios.ver'')))', t);
    execute format(
      'create policy %1$s_insert on public.%1$I for insert to authenticated
         with check ((select public.tiene_permiso(''oportunidades.editar''))
                 and (select public.tiene_permiso(''precios.ver'')))', t);
    execute format(
      'create policy %1$s_update on public.%1$I for update to authenticated
         using ((select public.tiene_permiso(''oportunidades.editar''))
            and (select public.tiene_permiso(''precios.ver'')))
         with check ((select public.tiene_permiso(''oportunidades.editar''))
                 and (select public.tiene_permiso(''precios.ver'')))', t);
  end loop;
end $$;

revoke all on public.cotizacion_totales from anon, authenticated;
grant select on public.cotizacion_totales to authenticated;
