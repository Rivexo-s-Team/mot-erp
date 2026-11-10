-- Base del esquema: piezas que reutilizan todas las tablas.
--   1. Llenado automático de updated_at y created_by.
--   2. Bitácora de cambios para tablas sensibles.
--   3. Parámetros de negocio (viven en datos, no en código).

-- ---------------------------------------------------------------------------
-- 1. Columnas automáticas
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Trigger: pone updated_at = now() en cada actualización.';

create function public.set_created_by()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- auth.uid() es nulo en migraciones, seed y tareas del servidor.
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

comment on function public.set_created_by() is
  'Trigger: pone created_by = usuario actual al insertar, si no viene.';

-- ---------------------------------------------------------------------------
-- 2. Bitácora
-- ---------------------------------------------------------------------------

create table public.bitacora (
  id uuid primary key default gen_random_uuid(),
  tabla text not null,
  registro_id uuid not null,
  operacion text not null check (operacion in ('INSERT', 'UPDATE', 'DELETE')),
  datos_anteriores jsonb,
  datos_nuevos jsonb,
  usuario_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.bitacora is
  'Quién cambió qué y cuándo en tablas sensibles (precios, contratos, facturas, resultados). Solo se agrega; nunca se edita ni se borra.';

create index bitacora_registro_idx on public.bitacora (tabla, registro_id, created_at desc);
create index bitacora_usuario_idx on public.bitacora (usuario_id, created_at desc);

-- RLS sin políticas = nadie la lee ni la escribe desde la app.
-- Las políticas de lectura por rol llegan con la migración de roles y permisos.
alter table public.bitacora enable row level security;
revoke all on public.bitacora from anon, authenticated;
grant select on public.bitacora to authenticated;

create function public.registrar_bitacora()
returns trigger
language plpgsql
security definer -- escribe en la bitácora aunque el usuario no tenga permiso directo
set search_path = ''
as $$
begin
  -- Una actualización que no cambia nada (salvo updated_at) no se registra.
  if tg_op = 'UPDATE' and to_jsonb(old) - 'updated_at' = to_jsonb(new) - 'updated_at' then
    return new;
  end if;

  insert into public.bitacora (tabla, registro_id, operacion, datos_anteriores, datos_nuevos, usuario_id)
  values (
    tg_table_name,
    case when tg_op = 'DELETE' then old.id else new.id end,
    tg_op,
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end,
    auth.uid()
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

comment on function public.registrar_bitacora() is
  'Trigger para tablas sensibles con columna id uuid: guarda el antes y el después de cada cambio en bitacora.';

revoke execute on function public.registrar_bitacora() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Parámetros de negocio
-- ---------------------------------------------------------------------------

create table public.parametros_negocio (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique check (clave ~ '^[a-z][a-z0-9_]*$'),
  valor numeric not null,
  unidad text not null,
  moneda text check (moneda ~ '^[A-Z]{3}$'),
  descripcion text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

comment on table public.parametros_negocio is
  'Valores de política comercial y de laboratorio que MOT puede cambiar sin tocar el código.';
comment on column public.parametros_negocio.moneda is
  'Código ISO de la moneda cuando el valor es un importe; nulo si no lo es.';

-- Incluye precios (piso del cotizador): RLS sin políticas hasta que existan los roles.
alter table public.parametros_negocio enable row level security;
revoke all on public.parametros_negocio from anon, authenticated;
grant select, update on public.parametros_negocio to authenticated;

create trigger parametros_negocio_set_updated_at
  before update on public.parametros_negocio
  for each row execute function public.set_updated_at();

create trigger parametros_negocio_set_created_by
  before insert on public.parametros_negocio
  for each row execute function public.set_created_by();

create trigger parametros_negocio_bitacora
  after insert or update or delete on public.parametros_negocio
  for each row execute function public.registrar_bitacora();

-- Valores iniciales (DISENO §1, §4.2 y §4.5). Van en la migración y no en el
-- seed porque producción también los necesita.
insert into public.parametros_negocio (clave, valor, unidad, moneda, descripcion) values
  ('cotizador_porcentaje_aceite_nuevo', 0.70, 'fraccion', null,
   'Precio por litro = este porcentaje del precio del aceite nuevo (0.70 = 70 %).'),
  ('cotizador_piso_precio_litro', 2.50, 'por_litro', 'USD',
   'Precio mínimo por litro del cotizador.'),
  ('lab_condicion_precaucion_desde', 2, 'pruebas_no_pasa', null,
   'Pruebas "no pasa" a partir de las cuales la condición del aceite es Precaución.'),
  -- PENDIENTE(P6): la guía dice "más de 4 = Crítico" y no define exactamente 4.
  -- Por ahora 4 queda en Precaución; si el laboratorio decide lo contrario, se cambia a 4.
  ('lab_condicion_critico_desde', 5, 'pruebas_no_pasa', null,
   'Pruebas "no pasa" a partir de las cuales la condición del aceite es Crítico.');
