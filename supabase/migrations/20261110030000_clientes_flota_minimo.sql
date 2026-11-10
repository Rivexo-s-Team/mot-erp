-- Tablas mínimas de clientes y flota (DISENO §4.1 y §4.3) para poder sembrar el
-- caso real de Rassini en la Etapa 0. Solo llevan lo indispensable: las etapas
-- 1 (clientes) y 2 (flota) les agregan columnas y pantallas, sin rehacerlas.
--
-- Son entidades de negocio: no se borran, se marcan con deleted_at. Las
-- políticas no filtran deleted_at (lo hace la app) para que marcar un registro
-- como borrado no choque con RLS.

create table public.cuentas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique check (length(btrim(nombre)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz
);
comment on table public.cuentas is
  'Grupo o empresa cliente (ej. "Rassini"). Existe desde que es prospecto.';

create table public.plantas (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references public.cuentas (id),
  nombre text not null check (length(btrim(nombre)) > 0),
  direccion text,
  municipio text,
  estado text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  unique (cuenta_id, nombre)
);
comment on table public.plantas is
  '"División": planta o ubicación operativa de una cuenta (ej. "BYPASA", San Juan del Río).';

create table public.equipos_cliente (
  id uuid primary key default gen_random_uuid(),
  planta_id uuid not null references public.plantas (id),
  identificador text not null check (length(btrim(identificador)) > 0),
  alias text,
  aplicacion text,
  aceite_id uuid references public.aceites (id),
  volumen_reservorio_l numeric check (volumen_reservorio_l > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  unique (planta_id, identificador)
);
comment on table public.equipos_cliente is
  'Máquina o tanque del cliente cuyo aceite se limpia (ej. 11B116 "REP4", prensa vulcanizadora, 280 L).';
comment on column public.equipos_cliente.identificador is 'Identificador que usa el cliente.';
comment on column public.equipos_cliente.volumen_reservorio_l is
  'Volumen del reservorio en litros. Base del cobro por litro en órdenes por evento.';
create index equipos_cliente_aceite_idx on public.equipos_cliente (aceite_id);

create table public.robox (
  id uuid primary key default gen_random_uuid(),
  numero_serie text not null unique check (length(btrim(numero_serie)) > 0),
  modelo text,
  version_programa text,
  sim text,
  estado text not null default 'disponible'
    check (estado in ('disponible', 'en_cliente', 'en_taller', 'baja')),
  fecha_alta date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz
);
comment on table public.robox is
  'SKF RecondOil Box de MOT. Su ubicación se calculará de sus asignaciones y movimientos (Etapa 2).';

-- Triggers estándar ---------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['cuentas', 'plantas', 'equipos_cliente', 'robox'] loop
    execute format(
      'create trigger %1$s_set_updated_at before update on public.%1$I
         for each row execute function public.set_updated_at()', t);
    execute format(
      'create trigger %1$s_set_created_by before insert on public.%1$I
         for each row execute function public.set_created_by()', t);
  end loop;
end $$;

-- Permisos ------------------------------------------------------------------
-- PENDIENTE(P4): quién edita clientes y flota es tentativo hasta que el
-- Director General confirme alcances. Se deja lo mínimo: todos los internos
-- consultan; Dirección y Comercial editan clientes; solo Dirección edita flota.
insert into public.permisos (clave, descripcion) values
  ('clientes.ver', 'Consultar cuentas, plantas y equipos del cliente.'),
  ('clientes.editar', 'Crear y editar cuentas, plantas y equipos del cliente.'),
  ('flota.ver', 'Consultar los Robox.'),
  ('flota.editar', 'Crear y editar los Robox.');

insert into public.rol_permisos (rol_id, permiso_id)
select r.id, p.id
from (values
  ('direccion', 'clientes.ver'), ('comercial', 'clientes.ver'), ('tecnico', 'clientes.ver'),
  ('laboratorio', 'clientes.ver'), ('administracion', 'clientes.ver'),
  ('direccion', 'clientes.editar'), ('comercial', 'clientes.editar'),
  ('direccion', 'flota.ver'), ('comercial', 'flota.ver'), ('tecnico', 'flota.ver'),
  ('laboratorio', 'flota.ver'), ('administracion', 'flota.ver'),
  ('direccion', 'flota.editar')
) as m (rol, permiso)
join public.roles r on r.clave = m.rol
join public.permisos p on p.clave = m.permiso;

-- RLS -----------------------------------------------------------------------
-- El rol Cliente no ve nada aquí: su acceso por cuenta llega con el portal (Etapa 6).
do $$
declare c record;
begin
  for c in
    select * from (values
      ('cuentas', 'clientes'), ('plantas', 'clientes'),
      ('equipos_cliente', 'clientes'), ('robox', 'flota')
    ) as v (tabla, modulo)
  loop
    execute format('alter table public.%I enable row level security', c.tabla);
    execute format('revoke all on public.%I from anon, authenticated', c.tabla);
    execute format('grant select, insert, update on public.%I to authenticated', c.tabla);
    execute format(
      'create policy %1$s_select on public.%1$I for select to authenticated
         using ((select public.tiene_permiso(%2$L)))', c.tabla, c.modulo || '.ver');
    execute format(
      'create policy %1$s_insert on public.%1$I for insert to authenticated
         with check ((select public.tiene_permiso(%2$L)))', c.tabla, c.modulo || '.editar');
    execute format(
      'create policy %1$s_update on public.%1$I for update to authenticated
         using ((select public.tiene_permiso(%2$L)))
         with check ((select public.tiene_permiso(%2$L)))', c.tabla, c.modulo || '.editar');
  end loop;
end $$;
