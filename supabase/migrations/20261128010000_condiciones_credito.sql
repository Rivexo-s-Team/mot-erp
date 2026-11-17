-- Etapa 5, paso 1: condiciones de crédito por razón social (DISENO §4.6).
--
-- Lo que administración necesita saber antes de facturarle a una razón
-- social: cuántos días de crédito tiene, si exige orden de compra, cómo paga
-- y a quién se le da seguimiento. Va aparte de `razones_sociales` porque no lo
-- ve todo el que ve clientes.
--
-- Estrena los permisos de la etapa. PENDIENTE(P4): tentativo. Consultan
-- Dirección, Administración y Comercial; capturan Dirección y Administración.
-- Técnico y Laboratorio no ven nada de facturación.

insert into public.permisos (clave, descripcion) values
  ('facturacion.ver', 'Consultar condiciones de crédito, facturas, pagos y saldos.'),
  ('facturacion.editar', 'Capturar condiciones de crédito, facturas y pagos.');
insert into public.rol_permisos (rol_id, permiso_id)
select r.id, p.id
from (values
  ('direccion', 'facturacion.ver'), ('administracion', 'facturacion.ver'), ('comercial', 'facturacion.ver'),
  ('direccion', 'facturacion.editar'), ('administracion', 'facturacion.editar')
) as m (rol, permiso)
join public.roles r on r.clave = m.rol
join public.permisos p on p.clave = m.permiso;

-- Para que el contacto de cuentas por pagar sea de la misma cuenta.
alter table public.contactos
  add constraint contactos_id_cuenta_key unique (id, cuenta_id);

create table public.condiciones_credito (
  -- Una por razón social.
  razon_social_id uuid primary key,
  cuenta_id uuid not null references public.cuentas (id),
  dias_credito integer not null default 0 check (dias_credito between 0 and 365),
  requiere_orden_compra boolean not null default false,
  -- Claves del SAT. PUE: pago en una sola exhibición. PPD: en parcialidades o diferido.
  metodo_pago text check (metodo_pago in ('PUE', 'PPD')),
  forma_pago text check (forma_pago ~ '^[0-9]{2}$'),
  contacto_cxp_id uuid,
  -- Nombre o dirección del portal de proveedores, si la razón social usa uno.
  portal text,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  -- La bitácora identifica cada registro por su columna id.
  id uuid generated always as (razon_social_id) stored,
  foreign key (razon_social_id, cuenta_id) references public.razones_sociales (id, cuenta_id),
  foreign key (contacto_cxp_id, cuenta_id) references public.contactos (id, cuenta_id),
  -- Regla del SAT: con PPD la forma de pago es "99 Por definir".
  constraint condiciones_credito_ppd_check
    check (metodo_pago is distinct from 'PPD' or forma_pago is null or forma_pago = '99')
);
comment on table public.condiciones_credito is
  'Condiciones con las que se le factura y cobra a una razón social: días de crédito, orden de compra, método y forma de pago, contacto de cuentas por pagar.';
comment on column public.condiciones_credito.dias_credito is
  'Días naturales para pagar después de la fecha de la factura. 0 = de contado.';
create index condiciones_credito_cuenta_idx on public.condiciones_credito (cuenta_id);
create index condiciones_credito_contacto_idx on public.condiciones_credito (contacto_cxp_id);

create trigger condiciones_credito_set_updated_at before update on public.condiciones_credito
  for each row execute function public.set_updated_at();
create trigger condiciones_credito_set_created_by before insert on public.condiciones_credito
  for each row execute function public.set_created_by();
create trigger condiciones_credito_bitacora after insert or update or delete on public.condiciones_credito
  for each row execute function public.registrar_bitacora();

alter table public.condiciones_credito enable row level security;
revoke all on public.condiciones_credito from anon, authenticated;
grant select, insert, update on public.condiciones_credito to authenticated;
create policy condiciones_credito_select on public.condiciones_credito for select to authenticated
  using ((select public.tiene_permiso('facturacion.ver')));
create policy condiciones_credito_insert on public.condiciones_credito for insert to authenticated
  with check ((select public.tiene_permiso('facturacion.editar')));
create policy condiciones_credito_update on public.condiciones_credito for update to authenticated
  using ((select public.tiene_permiso('facturacion.editar')))
  with check ((select public.tiene_permiso('facturacion.editar')));
