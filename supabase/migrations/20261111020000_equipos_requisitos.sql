-- Etapa 1, paso 2: datos completos de los equipos del cliente, su costo de
-- aceite virgen (aparte, porque es un precio) y los requisitos de cada planta.

-- ---------------------------------------------------------------------------
-- Equipos del cliente: resto de los datos de DISENO §4.1
-- ---------------------------------------------------------------------------

alter table public.equipos_cliente
  add column marca text,
  add column numero_contenedores integer check (numero_contenedores > 0),
  add column volumen_contenedor_l numeric check (volumen_contenedor_l > 0),
  add column tipo_conexion text,
  add column altura text,
  add column localizacion text,
  add column temperatura_operacion_c numeric,
  add column frecuencia_cambio_aceite text,
  add column toma_muestras text check (toma_muestras in ('mot', 'cliente')),
  add column notas text;

comment on column public.equipos_cliente.volumen_contenedor_l is
  'Volumen de cada contenedor, en litros. Si no son iguales, se aclara en notas.';
comment on column public.equipos_cliente.altura is
  'Altura del equipo o de su conexión, como la describa el levantamiento (texto libre: la plantilla no define unidad).';
comment on column public.equipos_cliente.frecuencia_cambio_aceite is
  'Cada cuánto cambia hoy el aceite el cliente (texto libre, ej. "cada 12 meses").';
comment on column public.equipos_cliente.toma_muestras is 'Quién toma las muestras: mot o cliente.';

alter table public.equipos_cliente drop constraint equipos_cliente_planta_id_identificador_key;
create unique index equipos_cliente_identificador_vigente_key
  on public.equipos_cliente (planta_id, lower(btrim(identificador)))
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Costo del aceite virgen por equipo (precio: solo roles con precios.ver)
-- ---------------------------------------------------------------------------

create table public.equipos_cliente_costos (
  equipo_cliente_id uuid primary key references public.equipos_cliente (id),
  costo_aceite_virgen numeric not null check (costo_aceite_virgen > 0),
  moneda text not null check (moneda ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);
comment on table public.equipos_cliente_costos is
  'Costo del aceite virgen por litro que paga el cliente en cada equipo. Va aparte de equipos_cliente porque es un precio.';
comment on column public.equipos_cliente_costos.costo_aceite_virgen is 'Costo por litro, en la moneda indicada.';

-- La bitácora identifica cada registro por su columna id.
alter table public.equipos_cliente_costos
  add column id uuid generated always as (equipo_cliente_id) stored;

create trigger equipos_cliente_costos_set_updated_at before update on public.equipos_cliente_costos
  for each row execute function public.set_updated_at();
create trigger equipos_cliente_costos_set_created_by before insert on public.equipos_cliente_costos
  for each row execute function public.set_created_by();
create trigger equipos_cliente_costos_bitacora
  after insert or update or delete on public.equipos_cliente_costos
  for each row execute function public.registrar_bitacora();

-- ---------------------------------------------------------------------------
-- Requisitos de planta
-- ---------------------------------------------------------------------------

create table public.requisitos_planta (
  id uuid primary key default gen_random_uuid(),
  planta_id uuid not null references public.plantas (id),
  -- Las tres columnas de "Requisitos" de la plantilla del director comercial.
  categoria text not null check (categoria in ('acceso_planta', 'alta_proveedor', 'contrato')),
  nombre text not null check (length(btrim(nombre)) > 0),
  detalle text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz
);
comment on table public.requisitos_planta is
  'Lo que la planta exige para entrar o para ser proveedor: REPSE, EPP, alta de proveedor, cursos…';
create index requisitos_planta_planta_idx on public.requisitos_planta (planta_id);

create trigger requisitos_planta_set_updated_at before update on public.requisitos_planta
  for each row execute function public.set_updated_at();
create trigger requisitos_planta_set_created_by before insert on public.requisitos_planta
  for each row execute function public.set_created_by();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.equipos_cliente_costos enable row level security;
alter table public.requisitos_planta enable row level security;
revoke all on public.equipos_cliente_costos, public.requisitos_planta from anon, authenticated;
grant select, insert, update, delete on public.equipos_cliente_costos to authenticated;
grant select, insert, update on public.requisitos_planta to authenticated;

-- El costo lo ve quien ve precios; lo captura quien además edita clientes.
create policy equipos_cliente_costos_select on public.equipos_cliente_costos for select to authenticated
  using ((select public.tiene_permiso('precios.ver')));
create policy equipos_cliente_costos_insert on public.equipos_cliente_costos for insert to authenticated
  with check ((select public.tiene_permiso('precios.ver')) and (select public.tiene_permiso('clientes.editar')));
create policy equipos_cliente_costos_update on public.equipos_cliente_costos for update to authenticated
  using ((select public.tiene_permiso('precios.ver')) and (select public.tiene_permiso('clientes.editar')))
  with check ((select public.tiene_permiso('precios.ver')) and (select public.tiene_permiso('clientes.editar')));
-- Aquí sí se borra: quitar el costo de un equipo queda registrado en la bitácora.
create policy equipos_cliente_costos_delete on public.equipos_cliente_costos for delete to authenticated
  using ((select public.tiene_permiso('precios.ver')) and (select public.tiene_permiso('clientes.editar')));

create policy requisitos_planta_select on public.requisitos_planta for select to authenticated
  using ((select public.tiene_permiso('clientes.ver')));
create policy requisitos_planta_insert on public.requisitos_planta for insert to authenticated
  with check ((select public.tiene_permiso('clientes.editar')));
create policy requisitos_planta_update on public.requisitos_planta for update to authenticated
  using ((select public.tiene_permiso('clientes.editar')))
  with check ((select public.tiene_permiso('clientes.editar')));
