-- Etapa 5, paso 6: anticipos y pagos únicos del contrato (DISENO §4.6, D15, D20).
--
-- Un contrato de renta lleva pagos de una sola vez: el anticipo (dos meses de
-- renta) y la instalación. Aquí se vuelven cargos, y el anticipo se sigue
-- hasta que se descuenta:
--   1. La tarifa de pago único genera su cargo (una sola vez).
--   2. El anticipo se factura aparte de lo demás y se cobra como cualquier factura.
--   3. Lo que el cliente ya pagó de anticipo se aplica después a otras
--      facturas suyas, sin pasarse de lo pagado.
--
-- PENDIENTE(P8): el manejo fiscal (CFDI del anticipo, CFDI de egreso al
-- aplicarlo) lo define el contador y por ahora se timbra fuera del sistema;
-- aquí se lleva el control del dinero y se registra el folio de esos CFDI.

-- 1. Pagos únicos como cargos ---------------------------------------------------------
alter table public.contrato_tarifas
  add column es_anticipo boolean not null default false,
  add constraint contrato_tarifas_anticipo_check check (not es_anticipo or unidad = 'unico');
comment on column public.contrato_tarifas.es_anticipo is
  'El pago único es un anticipo: se factura aparte y después se descuenta de otras facturas.';

alter table public.cargos drop constraint cargos_tipo_check;
alter table public.cargos drop constraint cargos_renta_check;
alter table public.cargos
  add constraint cargos_tipo_check check (tipo in (
    'renta', 'anticipo', 'pago_unico', 'evento_litro', 'partes_mal_uso', 'servicio', 'laboratorio', 'otro'
  )),
  -- El periodo es solo de las rentas; la tarifa, de lo que nace de un contrato.
  add constraint cargos_tarifa_check check (
    (tipo = 'renta') = (periodo is not null)
    and (tipo <> 'renta' or tarifa_id is not null)
    and (tipo <> 'pago_unico' or tarifa_id is not null)
    and (tarifa_id is null or tipo in ('renta', 'anticipo', 'pago_unico'))
  );
-- Un pago único se cobra una sola vez.
create unique index cargos_pago_unico_key on public.cargos (tarifa_id)
  where tipo in ('anticipo', 'pago_unico') and deleted_at is null;

-- Los pagos únicos de un contrato, con el cargo que ya tengan.
create function public.pagos_unicos_de_contrato(p_contrato uuid)
returns table (
  tarifa_id uuid, concepto text, precio numeric, moneda text, es_anticipo boolean,
  cargo_id uuid, cargo_estado text
)
language sql
stable
set search_path = ''
as $$
  select t.id, t.concepto, t.precio, c.moneda, t.es_anticipo, k.id, k.estado
  from public.contrato_tarifas t
  join public.contratos c on c.id = t.contrato_id
  left join public.cargos k
    on k.tarifa_id = t.id and k.tipo in ('anticipo', 'pago_unico') and k.deleted_at is null
  where t.contrato_id = p_contrato and t.unidad = 'unico' and t.deleted_at is null
  order by t.orden, t.created_at;
$$;
revoke all on function public.pagos_unicos_de_contrato(uuid) from public, anon;
grant execute on function public.pagos_unicos_de_contrato(uuid) to authenticated;

-- Genera el cargo de un pago único de un contrato vigente.
create function public.generar_cargo_unico(p_tarifa uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_tarifa public.contrato_tarifas;
  v_contrato public.contratos;
  v_cargo uuid;
begin
  if not ((select public.tiene_permiso('cargos.editar')) and (select public.tiene_permiso('precios.ver'))) then
    raise exception 'Tu rol no puede generar cargos.' using errcode = '42501';
  end if;
  select * into v_tarifa from public.contrato_tarifas where id = p_tarifa and deleted_at is null;
  if v_tarifa.id is null or v_tarifa.unidad <> 'unico' then
    raise exception 'Esa tarifa no es un pago único.' using errcode = 'P0001';
  end if;
  select * into v_contrato from public.contratos where id = v_tarifa.contrato_id;
  if v_contrato.estado <> 'vigente' or v_contrato.deleted_at is not null then
    raise exception 'El contrato no está vigente.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.cargos where tarifa_id = p_tarifa
             and tipo in ('anticipo', 'pago_unico') and deleted_at is null) then
    raise exception 'Ese pago único ya tiene su cargo.' using errcode = 'P0001';
  end if;
  insert into public.cargos
    (cuenta_id, contrato_id, tipo, concepto, cantidad, unidad, precio_unitario, moneda, tarifa_id, orden_compra_id)
  values (
    v_contrato.cuenta_id, v_contrato.id, case when v_tarifa.es_anticipo then 'anticipo' else 'pago_unico' end,
    v_tarifa.concepto, 1, 'pago', v_tarifa.precio, v_contrato.moneda, v_tarifa.id, v_tarifa.orden_compra_id
  )
  returning id into v_cargo;
  return v_cargo;
end;
$$;
revoke all on function public.generar_cargo_unico(uuid) from public, anon;
grant execute on function public.generar_cargo_unico(uuid) to authenticated;

-- 2. La factura de anticipo va aparte ---------------------------------------------------
alter table public.facturas add column es_anticipo boolean not null default false;
comment on column public.facturas.es_anticipo is
  'La factura es de un anticipo. Lo decide su primer concepto; no se mezcla con otros cargos.';

create function public.factura_conceptos_anticipo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_es_anticipo boolean := (select tipo = 'anticipo' from public.cargos where id = new.cargo_id);
begin
  if not exists (select 1 from public.factura_conceptos where factura_id = new.factura_id) then
    update public.facturas set es_anticipo = v_es_anticipo where id = new.factura_id;
  elsif v_es_anticipo <> (select es_anticipo from public.facturas where id = new.factura_id) then
    raise exception 'Un anticipo se factura aparte: no se mezcla con otros cargos.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger factura_conceptos_anticipo before insert on public.factura_conceptos
  for each row execute function public.factura_conceptos_anticipo();

-- Que una factura sea de anticipo no se cambia a mano.
create function public.facturas_anticipo_fijo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.es_anticipo is distinct from old.es_anticipo and pg_trigger_depth() < 2 then
    new.es_anticipo := old.es_anticipo;
  end if;
  return new;
end;
$$;
-- "aa": corre antes que facturas_proteger.
create trigger facturas_aa_anticipo_fijo before update on public.facturas
  for each row execute function public.facturas_anticipo_fijo();

-- 3. Aplicar el anticipo ----------------------------------------------------------------
-- Aplicar un anticipo es un pago sin dinero nuevo: forma "30 Aplicación de
-- anticipos" del SAT, ligado a la factura de anticipo de la que sale.
alter table public.pagos
  add column anticipo_factura_id uuid references public.facturas (id),
  add constraint pagos_anticipo_check check ((forma_pago = '30') = (anticipo_factura_id is not null));
comment on column public.pagos.anticipo_factura_id is
  'Factura de anticipo de la que sale este pago (forma 30). Vacío en un pago con dinero.';
comment on column public.pagos.rep_folio is
  'Folio del comprobante que ampara el pago: el complemento de pago o, si es aplicación de anticipo, el CFDI de egreso.';
create index pagos_anticipo_factura_idx on public.pagos (anticipo_factura_id);

-- Cuánto de cada factura de anticipo ya pagó el cliente, cuánto se ha
-- aplicado y cuánto queda disponible.
create view public.anticipo_saldos
with (security_invoker = true) as
select
  f.id as factura_id,
  f.cuenta_id,
  f.razon_social_id,
  f.moneda,
  coalesce(s.pagado, 0) as pagado,
  coalesce(a.aplicado, 0) as aplicado,
  coalesce(s.pagado, 0) - coalesce(a.aplicado, 0) as disponible
from public.facturas f
left join public.factura_saldos s on s.factura_id = f.id
left join (
  select anticipo_factura_id, sum(monto) as aplicado from public.pagos
  where anticipo_factura_id is not null and deleted_at is null group by anticipo_factura_id
) a on a.anticipo_factura_id = f.id
where f.es_anticipo and f.estado = 'emitida' and f.deleted_at is null;
comment on view public.anticipo_saldos is
  'Pagado, aplicado y disponible de cada factura de anticipo emitida. Respeta RLS de quien consulta.';

-- Solo se aplica lo que el cliente ya pagó del anticipo, a la misma razón
-- social y en la misma moneda.
create function public.pagos_validar_anticipo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_anticipo public.facturas;
  v_pagado numeric;
  v_aplicado numeric;
begin
  if tg_op = 'UPDATE' then
    new.anticipo_factura_id := old.anticipo_factura_id;
  end if;
  if new.anticipo_factura_id is null or new.deleted_at is not null then
    return new;
  end if;
  select * into v_anticipo from public.facturas where id = new.anticipo_factura_id for update;
  if v_anticipo.id is null or not v_anticipo.es_anticipo or v_anticipo.estado <> 'emitida' then
    raise exception 'Esa factura no es un anticipo emitido.' using errcode = 'P0001';
  end if;
  if v_anticipo.razon_social_id <> new.razon_social_id or v_anticipo.moneda <> new.moneda then
    raise exception 'El anticipo es de otra razón social o está en otra moneda.' using errcode = 'P0001';
  end if;
  select coalesce(sum(monto), 0) into v_pagado from public.pago_aplicaciones where factura_id = v_anticipo.id;
  select coalesce(sum(monto), 0) into v_aplicado from public.pagos
  where anticipo_factura_id = v_anticipo.id and deleted_at is null and id <> new.id;
  if v_aplicado + new.monto > v_pagado then
    raise exception 'El anticipo disponible no alcanza: solo se aplica lo que el cliente ya pagó.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger pagos_validar_anticipo before insert or update on public.pagos
  for each row execute function public.pagos_validar_anticipo();

-- Un anticipo no se paga con otro anticipo, y a una factura de anticipo no
-- se le quitan pagos que ya se aplicaron a otras facturas.
create function public.pago_aplicaciones_anticipo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_factura uuid;
  v_queda numeric;
begin
  -- En un alta no hay registro anterior, y en una baja no hay nuevo.
  if tg_op = 'INSERT' then v_factura := new.factura_id; else v_factura := old.factura_id; end if;
  if tg_op <> 'DELETE' and (select anticipo_factura_id from public.pagos where id = new.pago_id) is not null
     and (select es_anticipo from public.facturas where id = new.factura_id) then
    raise exception 'Un anticipo no se aplica a otra factura de anticipo.' using errcode = 'P0001';
  end if;
  if tg_op <> 'INSERT' and (select es_anticipo from public.facturas where id = v_factura) then
    select coalesce(sum(monto), 0) into v_queda from public.pago_aplicaciones
    where factura_id = v_factura and id <> old.id;
    if tg_op = 'UPDATE' then v_queda := v_queda + new.monto; end if;
    if v_queda < (select coalesce(sum(monto), 0) from public.pagos
                  where anticipo_factura_id = v_factura and deleted_at is null) then
      raise exception 'Parte de este anticipo ya se aplicó a otras facturas. Quita primero esas aplicaciones.'
        using errcode = 'P0001';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger pago_aplicaciones_anticipo before insert or update or delete on public.pago_aplicaciones
  for each row execute function public.pago_aplicaciones_anticipo();

-- Aplica parte del anticipo disponible a una factura, todo o nada.
create function public.aplicar_anticipo(p_anticipo uuid, p_factura uuid, p_monto numeric, p_fecha date)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_anticipo public.facturas;
  v_pago uuid;
begin
  if not (select public.tiene_permiso('facturacion.editar')) then
    raise exception 'Tu rol no puede aplicar anticipos.' using errcode = '42501';
  end if;
  select * into v_anticipo from public.facturas where id = p_anticipo and deleted_at is null;
  if v_anticipo.id is null then
    raise exception 'La factura de anticipo no existe.' using errcode = 'P0001';
  end if;
  insert into public.pagos
    (cuenta_id, razon_social_id, fecha, monto, moneda, forma_pago, anticipo_factura_id, referencia)
  values
    (v_anticipo.cuenta_id, v_anticipo.razon_social_id, p_fecha, p_monto, v_anticipo.moneda, '30', v_anticipo.id,
     'Anticipo de la factura ' || concat_ws(' ', v_anticipo.serie, v_anticipo.folio))
  returning id into v_pago;
  insert into public.pago_aplicaciones (pago_id, factura_id, monto) values (v_pago, p_factura, p_monto);
  return v_pago;
end;
$$;
comment on function public.aplicar_anticipo(uuid, uuid, numeric, date) is
  'Descuenta de una factura parte del anticipo que el cliente ya pagó.';
revoke all on function public.aplicar_anticipo(uuid, uuid, numeric, date) from public, anon;
grant execute on function public.aplicar_anticipo(uuid, uuid, numeric, date) to authenticated;
