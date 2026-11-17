-- Etapa 5, paso 5: pagos y su aplicación a facturas (DISENO §4.6).
--
-- Un pago es dinero recibido de una razón social. Se aplica a una o varias de
-- sus facturas emitidas, completo o en partes; lo que no se aplica queda "por
-- aplicar". El saldo de cada factura es su total menos lo aplicado.
--
-- PENDIENTE(P8): un pago se aplica a facturas de su misma moneda. Si el
-- cliente pagó en pesos una factura en dólares, se registra el pago en
-- dólares y se anota el tipo de cambio con que pagó; el criterio fiscal lo
-- define el contador. El complemento de pago (REP) se timbra fuera del
-- sistema y aquí solo se registra su folio y su folio fiscal (D42).

create table public.pagos (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references public.cuentas (id),
  razon_social_id uuid not null,
  fecha date not null,
  monto numeric not null check (monto > 0 and monto = round(monto, 2)),
  moneda text not null check (moneda ~ '^[A-Z]{3}$'),
  -- Pesos por unidad de la moneda, si el pago se hizo en pesos o lo pide el complemento.
  tipo_cambio numeric check (tipo_cambio > 0),
  -- Clave del SAT (03 transferencia, 02 cheque…).
  forma_pago text check (forma_pago ~ '^[0-9]{2}$' and forma_pago <> '99'),
  referencia text,
  notas text,
  -- Complemento de pago (REP), timbrado fuera del sistema.
  rep_folio text,
  rep_uuid uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  foreign key (razon_social_id, cuenta_id) references public.razones_sociales (id, cuenta_id),
  constraint pagos_tipo_cambio_mxn_check check (moneda <> 'MXN' or tipo_cambio is null),
  constraint pagos_rep_check check ((rep_uuid is null) = (rep_folio is null))
);
comment on table public.pagos is
  'Pago recibido de una razón social. Se aplica a sus facturas con pago_aplicaciones.';
comment on column public.pagos.forma_pago is
  'Clave del SAT de cómo se pagó. No puede ser 99: un pago recibido ya tiene forma.';
create index pagos_cuenta_idx on public.pagos (cuenta_id);
create index pagos_razon_social_idx on public.pagos (razon_social_id);
create index pagos_fecha_idx on public.pagos (fecha) where deleted_at is null;
create unique index pagos_rep_uuid_key on public.pagos (rep_uuid) where rep_uuid is not null;

create table public.pago_aplicaciones (
  id uuid primary key default gen_random_uuid(),
  pago_id uuid not null references public.pagos (id),
  factura_id uuid not null references public.facturas (id),
  monto numeric not null check (monto > 0 and monto = round(monto, 2)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  unique (pago_id, factura_id)
);
comment on table public.pago_aplicaciones is
  'Cuánto de un pago se aplicó a una factura, en la moneda de ambos.';
create index pago_aplicaciones_factura_idx on public.pago_aplicaciones (factura_id);

-- Saldo de cada factura: total menos lo que se le ha aplicado.
create view public.factura_saldos
with (security_invoker = true) as
select
  t.factura_id,
  t.total,
  coalesce(a.pagado, 0) as pagado,
  t.total - coalesce(a.pagado, 0) as saldo
from public.factura_totales t
left join (
  select factura_id, sum(monto) as pagado from public.pago_aplicaciones group by factura_id
) a on a.factura_id = t.factura_id;
comment on view public.factura_saldos is 'Total, pagado y saldo de cada factura. Respeta RLS de quien consulta.';

-- Cuánto de cada pago está aplicado y cuánto queda por aplicar.
create view public.pago_saldos
with (security_invoker = true) as
select
  p.id as pago_id,
  coalesce(sum(a.monto), 0) as aplicado,
  p.monto - coalesce(sum(a.monto), 0) as por_aplicar
from public.pagos p
left join public.pago_aplicaciones a on a.pago_id = p.id
group by p.id;
comment on view public.pago_saldos is 'Aplicado y por aplicar de cada pago. Respeta RLS de quien consulta.';

-- Una aplicación solo procede si el pago y la factura son de la misma razón
-- social y moneda, la factura está emitida, y no se pasa ni del pago ni del
-- saldo de la factura.
create function public.pago_aplicaciones_validar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pago public.pagos;
  v_factura public.facturas;
  v_total numeric;
  v_del_pago numeric;
  v_de_la_factura numeric;
begin
  if tg_op = 'UPDATE' then
    new.pago_id := old.pago_id;
    new.factura_id := old.factura_id;
  end if;
  select * into v_pago from public.pagos where id = new.pago_id for update;
  select * into v_factura from public.facturas where id = new.factura_id for update;
  if v_pago.id is null or v_pago.deleted_at is not null then
    raise exception 'El pago no existe.' using errcode = 'P0001';
  end if;
  if v_factura.id is null or v_factura.estado <> 'emitida' then
    raise exception 'Un pago solo se aplica a una factura emitida.' using errcode = 'P0001';
  end if;
  if v_factura.razon_social_id <> v_pago.razon_social_id then
    raise exception 'La factura es de otra razón social.' using errcode = 'P0001';
  end if;
  if v_factura.moneda <> v_pago.moneda then
    raise exception 'La factura está en otra moneda que el pago.' using errcode = 'P0001';
  end if;

  select coalesce(sum(monto), 0) into v_del_pago from public.pago_aplicaciones
  where pago_id = new.pago_id and id <> new.id;
  if v_del_pago + new.monto > v_pago.monto then
    raise exception 'Lo aplicado es más que el monto del pago.' using errcode = 'P0001';
  end if;
  select total into v_total from public.factura_totales where factura_id = new.factura_id;
  select coalesce(sum(monto), 0) into v_de_la_factura from public.pago_aplicaciones
  where factura_id = new.factura_id and id <> new.id;
  if v_de_la_factura + new.monto > v_total then
    raise exception 'Lo aplicado es más que el saldo de la factura.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger pago_aplicaciones_validar before insert or update on public.pago_aplicaciones
  for each row execute function public.pago_aplicaciones_validar();

-- De un pago no cambian su cliente ni su moneda, y su monto no baja de lo que
-- ya tiene aplicado. Al eliminarlo se quitan sus aplicaciones.
create function public.pagos_proteger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.cuenta_id := old.cuenta_id;
  new.razon_social_id := old.razon_social_id;
  new.moneda := old.moneda;
  if old.deleted_at is not null then
    raise exception 'El pago fue eliminado.' using errcode = 'P0001';
  end if;
  if new.deleted_at is not null then
    if old.rep_uuid is not null then
      raise exception 'El pago ya tiene complemento de pago: no se elimina.' using errcode = 'P0001';
    end if;
    delete from public.pago_aplicaciones where pago_id = new.id;
    return new;
  end if;
  if new.monto < (select coalesce(sum(monto), 0) from public.pago_aplicaciones where pago_id = new.id) then
    raise exception 'El monto no puede ser menor que lo ya aplicado.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger pagos_proteger before update on public.pagos
  for each row execute function public.pagos_proteger();

-- Una factura con pagos aplicados no se cancela: primero se quitan los pagos.
create function public.facturas_sin_pagos_al_cancelar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.estado = 'cancelada' and old.estado <> 'cancelada'
     and exists (select 1 from public.pago_aplicaciones where factura_id = new.id) then
    raise exception 'La factura tiene pagos aplicados. Quítalos antes de cancelarla.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger facturas_sin_pagos_al_cancelar before update on public.facturas
  for each row execute function public.facturas_sin_pagos_al_cancelar();

create trigger pagos_set_updated_at before update on public.pagos
  for each row execute function public.set_updated_at();
create trigger pagos_set_created_by before insert on public.pagos
  for each row execute function public.set_created_by();
create trigger pagos_bitacora after insert or update or delete on public.pagos
  for each row execute function public.registrar_bitacora();
create trigger pago_aplicaciones_set_updated_at before update on public.pago_aplicaciones
  for each row execute function public.set_updated_at();
create trigger pago_aplicaciones_set_created_by before insert on public.pago_aplicaciones
  for each row execute function public.set_created_by();
create trigger pago_aplicaciones_bitacora after insert or update or delete on public.pago_aplicaciones
  for each row execute function public.registrar_bitacora();

alter table public.pagos enable row level security;
revoke all on public.pagos from anon, authenticated;
grant select, insert, update on public.pagos to authenticated;
create policy pagos_select on public.pagos for select to authenticated
  using ((select public.tiene_permiso('facturacion.ver')));
create policy pagos_insert on public.pagos for insert to authenticated
  with check ((select public.tiene_permiso('facturacion.editar')));
create policy pagos_update on public.pagos for update to authenticated
  using ((select public.tiene_permiso('facturacion.editar')))
  with check ((select public.tiene_permiso('facturacion.editar')));

alter table public.pago_aplicaciones enable row level security;
revoke all on public.pago_aplicaciones from anon, authenticated;
grant select, insert, update, delete on public.pago_aplicaciones to authenticated;
create policy pago_aplicaciones_select on public.pago_aplicaciones for select to authenticated
  using ((select public.tiene_permiso('facturacion.ver')));
create policy pago_aplicaciones_insert on public.pago_aplicaciones for insert to authenticated
  with check ((select public.tiene_permiso('facturacion.editar')));
create policy pago_aplicaciones_update on public.pago_aplicaciones for update to authenticated
  using ((select public.tiene_permiso('facturacion.editar')))
  with check ((select public.tiene_permiso('facturacion.editar')));
create policy pago_aplicaciones_delete on public.pago_aplicaciones for delete to authenticated
  using ((select public.tiene_permiso('facturacion.editar')));

-- Registra un pago y sus aplicaciones de una vez, todo o nada.
--   p_datos: {fecha, monto, moneda, tipo_cambio, forma_pago, referencia, notas}
--   p_aplicaciones: [{factura_id, monto}]
create function public.registrar_pago(p_razon_social uuid, p_datos jsonb, p_aplicaciones jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_razon public.razones_sociales;
  v_pago uuid;
begin
  if not (select public.tiene_permiso('facturacion.editar')) then
    raise exception 'Tu rol no puede registrar pagos.' using errcode = '42501';
  end if;
  select * into v_razon from public.razones_sociales where id = p_razon_social and deleted_at is null;
  if v_razon.id is null then
    raise exception 'La razón social no existe.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(coalesce(p_aplicaciones, '[]'::jsonb)) <> 'array' then
    raise exception 'Las aplicaciones no tienen la forma esperada.' using errcode = 'P0001';
  end if;

  insert into public.pagos
    (cuenta_id, razon_social_id, fecha, monto, moneda, tipo_cambio, forma_pago, referencia, notas)
  values (
    v_razon.cuenta_id, v_razon.id, (p_datos ->> 'fecha')::date, (p_datos ->> 'monto')::numeric,
    p_datos ->> 'moneda', nullif(p_datos ->> 'tipo_cambio', '')::numeric,
    nullif(p_datos ->> 'forma_pago', ''), nullif(btrim(p_datos ->> 'referencia'), ''),
    nullif(btrim(p_datos ->> 'notas'), '')
  )
  returning id into v_pago;

  insert into public.pago_aplicaciones (pago_id, factura_id, monto)
  select v_pago, (a ->> 'factura_id')::uuid, (a ->> 'monto')::numeric
  from jsonb_array_elements(coalesce(p_aplicaciones, '[]'::jsonb)) a;
  return v_pago;
end;
$$;
comment on function public.registrar_pago(uuid, jsonb, jsonb) is
  'Registra un pago de una razón social y lo aplica a sus facturas, todo o nada.';
revoke all on function public.registrar_pago(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.registrar_pago(uuid, jsonb, jsonb) to authenticated;
