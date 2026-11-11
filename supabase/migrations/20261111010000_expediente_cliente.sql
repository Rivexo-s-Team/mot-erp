-- Etapa 1, paso 1: expediente del cliente (DISENO §4.1).
-- Completa cuentas y plantas, y agrega razones sociales y contactos.

-- ---------------------------------------------------------------------------
-- Cuentas
-- ---------------------------------------------------------------------------

alter table public.cuentas
  add column tipo_industria text,
  add column notas text;

-- El nombre es único sin distinguir mayúsculas y solo entre cuentas vigentes,
-- para poder reutilizarlo si una cuenta se borró.
alter table public.cuentas drop constraint cuentas_nombre_key;
create unique index cuentas_nombre_vigente_key on public.cuentas (lower(btrim(nombre)))
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Razones sociales
-- ---------------------------------------------------------------------------

create table public.razones_sociales (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references public.cuentas (id),
  razon_social text not null check (length(btrim(razon_social)) > 0),
  -- RFC del SAT: 12 caracteres (persona moral) o 13 (persona física).
  rfc text not null check (rfc ~ '^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$'),
  regimen_fiscal text check (regimen_fiscal ~ '^[0-9]{3}$'),
  codigo_postal_fiscal text check (codigo_postal_fiscal ~ '^[0-9]{5}$'),
  uso_cfdi text check (uso_cfdi ~ '^[A-Z]{1,2}[0-9]{2}$'),
  usa_portal_proveedores boolean not null default false,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  -- Permite exigir que una planta use una razón social de su misma cuenta.
  unique (id, cuenta_id)
);
comment on table public.razones_sociales is
  'Datos fiscales a los que se factura. Una cuenta puede tener varias.';
comment on column public.razones_sociales.regimen_fiscal is 'Clave del régimen fiscal del SAT (ej. 601).';
comment on column public.razones_sociales.uso_cfdi is 'Clave de uso de CFDI del SAT (ej. G03).';
create unique index razones_sociales_rfc_vigente_key on public.razones_sociales (cuenta_id, rfc)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Plantas: dirección completa y razón social por defecto
-- ---------------------------------------------------------------------------

alter table public.plantas rename column direccion to calle;
alter table public.plantas
  add column numero_exterior text,
  add column numero_interior text,
  add column colonia text,
  add column codigo_postal text check (codigo_postal ~ '^[0-9]{5}$'),
  add column referencia text,
  add column razon_social_id uuid,
  add constraint plantas_id_cuenta_key unique (id, cuenta_id),
  add constraint plantas_razon_social_fkey
    foreign key (razon_social_id, cuenta_id) references public.razones_sociales (id, cuenta_id);
comment on column public.plantas.razon_social_id is
  'Razón social a la que se factura esta planta por defecto. Debe ser de la misma cuenta.';

alter table public.plantas drop constraint plantas_cuenta_id_nombre_key;
create unique index plantas_nombre_vigente_key on public.plantas (cuenta_id, lower(btrim(nombre)))
  where deleted_at is null;
create index plantas_razon_social_idx on public.plantas (razon_social_id);

-- ---------------------------------------------------------------------------
-- Contactos
-- ---------------------------------------------------------------------------

create table public.contactos (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references public.cuentas (id),
  planta_id uuid,
  nombre text not null check (length(btrim(nombre)) > 0),
  area text not null check (area in (
    'compras', 'mantenimiento', 'operaciones', 'gerente_planta',
    'cuentas_por_pagar', 'administracion', 'finanzas'
  )),
  puesto text,
  telefono_celular text,
  telefono_oficina text,
  correo text check (correo like '%_@_%'),
  recibe_facturas boolean not null default false,
  recibe_informes boolean not null default false,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  -- Si el contacto es de una planta, debe ser una planta de su misma cuenta.
  foreign key (planta_id, cuenta_id) references public.plantas (id, cuenta_id)
);
comment on table public.contactos is
  'Personas del cliente, por cuenta o por planta, con su área. Las marcas indican a quién se le envían facturas e informes.';
create index contactos_cuenta_idx on public.contactos (cuenta_id);
create index contactos_planta_idx on public.contactos (planta_id);
create index razones_sociales_cuenta_idx on public.razones_sociales (cuenta_id);

-- ---------------------------------------------------------------------------
-- Triggers estándar; bitácora en datos fiscales
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['razones_sociales', 'contactos'] loop
    execute format(
      'create trigger %1$s_set_updated_at before update on public.%1$I
         for each row execute function public.set_updated_at()', t);
    execute format(
      'create trigger %1$s_set_created_by before insert on public.%1$I
         for each row execute function public.set_created_by()', t);
  end loop;
end $$;

create trigger razones_sociales_bitacora after insert or update or delete on public.razones_sociales
  for each row execute function public.registrar_bitacora();

-- ---------------------------------------------------------------------------
-- Permisos y RLS
-- ---------------------------------------------------------------------------

-- PENDIENTE(P4): Administración lleva la facturación, así que también edita
-- razones sociales. Tentativo hasta que el Director General confirme alcances.
insert into public.permisos (clave, descripcion) values
  ('razones_sociales.editar', 'Crear y editar las razones sociales (datos fiscales) de una cuenta.');

insert into public.rol_permisos (rol_id, permiso_id)
select r.id, p.id
from public.roles r
join public.permisos p on p.clave = 'razones_sociales.editar'
where r.clave in ('direccion', 'comercial', 'administracion');

alter table public.razones_sociales enable row level security;
alter table public.contactos enable row level security;
revoke all on public.razones_sociales, public.contactos from anon, authenticated;
grant select, insert, update on public.razones_sociales, public.contactos to authenticated;

create policy razones_sociales_select on public.razones_sociales for select to authenticated
  using ((select public.tiene_permiso('clientes.ver')));
create policy razones_sociales_insert on public.razones_sociales for insert to authenticated
  with check ((select public.tiene_permiso('razones_sociales.editar')));
create policy razones_sociales_update on public.razones_sociales for update to authenticated
  using ((select public.tiene_permiso('razones_sociales.editar')))
  with check ((select public.tiene_permiso('razones_sociales.editar')));

create policy contactos_select on public.contactos for select to authenticated
  using ((select public.tiene_permiso('clientes.ver')));
create policy contactos_insert on public.contactos for insert to authenticated
  with check ((select public.tiene_permiso('clientes.editar')));
create policy contactos_update on public.contactos for update to authenticated
  using ((select public.tiene_permiso('clientes.editar')))
  with check ((select public.tiene_permiso('clientes.editar')));
