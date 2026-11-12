-- Etapa 2, paso 3: órdenes de compra del cliente (DISENO §4.3, decisión D18).
--
-- Una orden de compra (OC) pertenece a un contrato. Puede ser general (cubre
-- todo el contrato) o cubrir tarifas específicas: cada tarifa apunta a su OC.
-- Lleva importes, así que se trata como precio: precios.ver y bitácora.
-- El saldo (monto menos lo facturado) se calculará con las facturas (Etapa 5).

create table public.ordenes_compra (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.contratos (id),
  numero text not null check (length(btrim(numero)) > 0),
  -- En la moneda del contrato, sin IVA. Vacío si la OC no fija un monto.
  monto numeric check (monto >= 0),
  fecha_inicio date,
  fecha_termino date,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  unique (id, contrato_id),
  constraint ordenes_compra_vigencia_check
    check (fecha_inicio is null or fecha_termino is null or fecha_termino >= fecha_inicio)
);
comment on table public.ordenes_compra is
  'Orden de compra del cliente para un contrato. Las tarifas que cubre apuntan a ella; si ninguna lo hace, es general.';
comment on column public.ordenes_compra.numero is 'Número de OC tal como lo da el cliente.';
create index ordenes_compra_contrato_idx on public.ordenes_compra (contrato_id);
create unique index ordenes_compra_numero_vigente_key
  on public.ordenes_compra (contrato_id, lower(btrim(numero)))
  where deleted_at is null;

-- Cada tarifa puede estar cubierta por una OC de su mismo contrato.
alter table public.contrato_tarifas
  add column orden_compra_id uuid,
  add constraint contrato_tarifas_orden_compra_fkey
    foreign key (orden_compra_id, contrato_id) references public.ordenes_compra (id, contrato_id);
comment on column public.contrato_tarifas.orden_compra_id is
  'Orden de compra del cliente que cubre esta tarifa, si la hay.';
create index contrato_tarifas_orden_compra_idx on public.contrato_tarifas (orden_compra_id);

create trigger ordenes_compra_set_updated_at before update on public.ordenes_compra
  for each row execute function public.set_updated_at();
create trigger ordenes_compra_set_created_by before insert on public.ordenes_compra
  for each row execute function public.set_created_by();
create trigger ordenes_compra_bitacora after insert or update or delete on public.ordenes_compra
  for each row execute function public.registrar_bitacora();

-- RLS: igual que las tarifas (ver = contratos + precios; editar = editar contratos + precios).
alter table public.ordenes_compra enable row level security;
revoke all on public.ordenes_compra from anon, authenticated;
grant select, insert, update on public.ordenes_compra to authenticated;
create policy ordenes_compra_select on public.ordenes_compra for select to authenticated
  using ((select public.tiene_permiso('contratos.ver'))
     and (select public.tiene_permiso('precios.ver')));
create policy ordenes_compra_insert on public.ordenes_compra for insert to authenticated
  with check ((select public.tiene_permiso('contratos.editar'))
          and (select public.tiene_permiso('precios.ver')));
create policy ordenes_compra_update on public.ordenes_compra for update to authenticated
  using ((select public.tiene_permiso('contratos.editar'))
     and (select public.tiene_permiso('precios.ver')))
  with check ((select public.tiene_permiso('contratos.editar'))
          and (select public.tiene_permiso('precios.ver')));
