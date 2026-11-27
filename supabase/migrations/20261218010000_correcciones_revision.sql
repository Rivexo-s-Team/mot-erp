-- Correcciones de la revisión de código del 26 nov 2026 (D71).

-- 1. Una orden no puede nacer cerrada: el cierre exige firmas y dispara el
--    cargo, las salidas de partes y los filtros, y todo eso se revisa al
--    actualizar. Sin esto, alguien con ordenes.editar podía insertarla ya
--    cerrada por la API, sin firmas, y quedaba fija y visible en el portal.
create function public.ordenes_servicio_alta()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.estado in ('cerrada', 'cancelada') then
    raise exception 'Una orden se da de alta programada o en curso; se cierra después, ya firmada.'
      using errcode = 'P0001';
  end if;
  new.fecha_cierre := null;
  return new;
end $$;
create trigger ordenes_servicio_alta before insert on public.ordenes_servicio
  for each row execute function public.ordenes_servicio_alta();

-- 2. Una factura nace en borrador y sin datos de emisión ni de cancelación:
--    emitir y cancelar pasan por facturas_proteger, que solo corre al
--    actualizar. Y un borrador eliminado no se revive: sus cargos ya quedaron
--    libres y pueden estar en otra factura.
create function public.facturas_alta()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.estado := 'borrador';
    new.uuid_fiscal := null;
    new.timbrado := null;
    new.emitida_at := null;
    new.emitida_por := null;
    new.xml_ruta := null;
    new.pdf_ruta := null;
    new.xml_total := null;
    new.cancelada_at := null;
    new.cancelada_por := null;
    new.motivo_cancelacion := null;
    new.es_anticipo := false;
    new.deleted_at := null;
    return new;
  end if;
  if old.deleted_at is not null and new.deleted_at is null then
    raise exception 'Una factura eliminada no se recupera. Arma una nueva con sus cargos.'
      using errcode = 'P0001';
  end if;
  return new;
end $$;
-- "aaa": antes que los demás triggers de la tabla.
create trigger facturas_aaa_alta before insert or update on public.facturas
  for each row execute function public.facturas_alta();

-- 3. Un cargo no nace facturado ni dentro de una factura: eso lo ponen la
--    factura y sus conceptos.
create function public.cargos_alta()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.estado = 'facturado' or new.factura_id is not null then
    raise exception 'Un cargo se da de alta pendiente; lo marca como facturado su factura.'
      using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger cargos_alta before insert on public.cargos
  for each row execute function public.cargos_alta();

-- 4. Quitar o reducir el pago de una factura de anticipo ahora espera a quien
--    esté aplicando ese mismo anticipo (y al revés): antes, dos personas a la
--    vez podían dejar aplicado más de lo pagado.
create or replace function public.pago_aplicaciones_anticipo()
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
    -- El mismo candado que toma pagos_validar_anticipo al aplicar.
    perform 1 from public.facturas where id = v_factura for update;
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

-- 5. Rentas a mes vencido (D51, D70): el mes se genera cuando ya terminó, así
--    que un contrato que se dio por terminado después de ese mes todavía debe
--    su renta. Cuenta el contrato vigente y también el terminado cuya fecha de
--    término cae en el mes o después.
create or replace function public.rentas_del_mes(p_periodo date)
returns table (
  tarifa_id uuid, contrato_id uuid, cuenta_id uuid, cuenta text, planta text, concepto text,
  precio numeric, moneda text, orden_compra_id uuid, parcial boolean, cargo_id uuid, cargo_estado text
)
language sql
stable
set search_path = ''
as $$
  with mes as (
    select date_trunc('month', p_periodo)::date as inicio,
           (date_trunc('month', p_periodo) + interval '1 month - 1 day')::date as fin
  )
  select
    t.id, c.id, c.cuenta_id, cu.nombre, p.nombre, t.concepto, t.precio, c.moneda, t.orden_compra_id,
    coalesce(c.fecha_inicio > mes.inicio, false) or coalesce(c.fecha_termino < mes.fin, false),
    k.id, k.estado
  from mes
  join public.contratos c
    on c.deleted_at is null
   and (c.estado = 'vigente' or (c.estado = 'terminado' and c.fecha_termino >= mes.inicio))
   and (c.fecha_inicio is null or c.fecha_inicio <= mes.fin)
   and (c.fecha_termino is null or c.fecha_termino >= mes.inicio)
  join public.contrato_tarifas t on t.contrato_id = c.id and t.unidad = 'mes' and t.deleted_at is null
  join public.cuentas cu on cu.id = c.cuenta_id
  join public.plantas p on p.id = c.planta_id
  left join public.cargos k
    on k.tarifa_id = t.id and k.periodo = mes.inicio and k.tipo = 'renta' and k.deleted_at is null
  order by cu.nombre, p.nombre, t.orden, t.created_at;
$$;
