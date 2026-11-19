-- Etapa 5, paso 7: cobranza (DISENO §4.6).
--
-- Las cuentas por cobrar y la antigüedad de saldos no necesitan tablas: salen
-- de las facturas emitidas, sus saldos y sus días de crédito. Aquí van las dos
-- piezas que faltaban: el saldo de las órdenes de compra y el seguimiento de
-- los portales de proveedores.

-- Saldo de cada orden de compra: su monto menos lo ya facturado contra ella.
-- Cuenta lo facturado sin IVA (como el monto de la orden) de las facturas
-- emitidas, por los cargos que esa orden cubre. Una orden sin monto no tiene saldo.
create view public.orden_compra_saldos
with (security_invoker = true) as
select
  o.id as orden_compra_id,
  o.contrato_id,
  o.monto,
  coalesce(f.facturado, 0) as facturado,
  o.monto - coalesce(f.facturado, 0) as saldo
from public.ordenes_compra o
left join (
  select k.orden_compra_id, sum(c.importe) as facturado
  from public.factura_conceptos c
  join public.facturas fa on fa.id = c.factura_id and fa.estado = 'emitida' and fa.deleted_at is null
  join public.cargos k on k.id = c.cargo_id
  where k.orden_compra_id is not null
  group by k.orden_compra_id
) f on f.orden_compra_id = o.id
where o.deleted_at is null;
comment on view public.orden_compra_saldos is
  'Monto, facturado (sin IVA, facturas emitidas) y saldo de cada orden de compra. Respeta RLS de quien consulta.';

-- Seguimiento en el portal de proveedores del cliente, por factura. Aplica a
-- las razones sociales que piden subir ahí sus facturas.
create table public.portal_proveedor (
  factura_id uuid primary key references public.facturas (id),
  estado text not null default 'pendiente_subir'
    check (estado in ('pendiente_subir', 'subida', 'aprobada', 'programada', 'pagada')),
  fecha_subida date,
  fecha_aprobacion date,
  -- Día en que el portal dice que pagará.
  fecha_pago_programado date,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  -- La bitácora identifica cada registro por su columna id.
  id uuid generated always as (factura_id) stored,
  constraint portal_proveedor_fechas_check check (
    (fecha_aprobacion is null or fecha_subida is null or fecha_aprobacion >= fecha_subida)
  ),
  -- Una factura que ya pasó de "pendiente de subir" tiene su fecha de subida.
  constraint portal_proveedor_subida_check check (estado = 'pendiente_subir' or fecha_subida is not null)
);
comment on table public.portal_proveedor is
  'Cómo va una factura en el portal de proveedores del cliente: pendiente de subir, subida, aprobada, programada o pagada.';

-- Solo se le da seguimiento a una factura emitida.
create function public.portal_proveedor_validar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.factura_id := old.factura_id;
  end if;
  if (select estado from public.facturas where id = new.factura_id) is distinct from 'emitida' then
    raise exception 'Solo una factura emitida se sigue en el portal.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger portal_proveedor_validar before insert or update on public.portal_proveedor
  for each row execute function public.portal_proveedor_validar();

create trigger portal_proveedor_set_updated_at before update on public.portal_proveedor
  for each row execute function public.set_updated_at();
create trigger portal_proveedor_set_created_by before insert on public.portal_proveedor
  for each row execute function public.set_created_by();
create trigger portal_proveedor_bitacora after insert or update or delete on public.portal_proveedor
  for each row execute function public.registrar_bitacora();

alter table public.portal_proveedor enable row level security;
revoke all on public.portal_proveedor from anon, authenticated;
grant select, insert, update on public.portal_proveedor to authenticated;
create policy portal_proveedor_select on public.portal_proveedor for select to authenticated
  using ((select public.tiene_permiso('facturacion.ver')));
create policy portal_proveedor_insert on public.portal_proveedor for insert to authenticated
  with check ((select public.tiene_permiso('facturacion.editar')));
create policy portal_proveedor_update on public.portal_proveedor for update to authenticated
  using ((select public.tiene_permiso('facturacion.editar')))
  with check ((select public.tiene_permiso('facturacion.editar')));
