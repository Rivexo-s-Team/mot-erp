-- Tablero de dirección, paso 2: ingresos por cliente y planta (D72).
-- Un renglón por cuenta, planta y moneda: lo facturado en el periodo (sin
-- IVA), la renta mensual vigente y los Robox que tiene hoy. La planta de lo
-- facturado sale del cargo de cada concepto: la de su contrato o, si no
-- tiene, la de su orden de servicio; sin ninguna, queda "sin planta".
-- Respeta RLS de quien la llama y pide el permiso direccion.ver.

create function public.tablero_por_planta(p_desde date, p_hasta date)
returns table (
  cuenta_id uuid, cuenta text, planta_id uuid, planta text, moneda text,
  facturado numeric, renta_mensual numeric, robox integer
)
language sql
stable
set search_path = ''
as $$
  with fac as (
    select f.cuenta_id, coalesce(k.planta_id, o.planta_id) as planta_id, f.moneda, sum(fc.importe) as facturado
    from public.facturas f
    join public.factura_conceptos fc on fc.factura_id = f.id
    join public.cargos ca on ca.id = fc.cargo_id
    left join public.contratos k on k.id = ca.contrato_id
    left join public.ordenes_servicio o on o.id = ca.orden_id
    where f.estado = 'emitida' and f.deleted_at is null
      and f.fecha >= p_desde and f.fecha <= p_hasta
    group by 1, 2, 3
  ),
  ren as (
    select c.cuenta_id, c.planta_id, c.moneda, sum(t.precio) as renta
    from public.contratos c
    join public.contrato_tarifas t on t.contrato_id = c.id and t.unidad = 'mes' and t.deleted_at is null
    where c.estado = 'vigente' and c.deleted_at is null
    group by 1, 2, 3
  ),
  asig as (
    select c.cuenta_id, a.planta_id, c.moneda, count(*)::integer as n
    from public.asignaciones_robox a
    join public.contratos c on c.id = a.contrato_id
    where a.fecha_fin is null and a.deleted_at is null
    group by 1, 2, 3
  ),
  llaves as (
    select fac.cuenta_id, fac.planta_id, fac.moneda from fac
    union select ren.cuenta_id, ren.planta_id, ren.moneda from ren
    union select asig.cuenta_id, asig.planta_id, asig.moneda from asig
  )
  select l.cuenta_id, cu.nombre, l.planta_id, p.nombre, l.moneda,
         coalesce(fac.facturado, 0), coalesce(ren.renta, 0), coalesce(asig.n, 0)
  from llaves l
  join public.cuentas cu on cu.id = l.cuenta_id
  left join public.plantas p on p.id = l.planta_id
  left join fac on fac.cuenta_id = l.cuenta_id and fac.planta_id is not distinct from l.planta_id and fac.moneda = l.moneda
  left join ren on ren.cuenta_id = l.cuenta_id and ren.planta_id is not distinct from l.planta_id and ren.moneda = l.moneda
  left join asig on asig.cuenta_id = l.cuenta_id and asig.planta_id is not distinct from l.planta_id and asig.moneda = l.moneda
  where (select public.tiene_permiso('direccion.ver'))
  order by cu.nombre, p.nombre nulls last, l.moneda;
$$;
comment on function public.tablero_por_planta(date, date) is
  'Tablero: facturado del periodo (sin IVA), renta mensual vigente y Robox asignados hoy, por cuenta, planta y moneda.';

revoke execute on function public.tablero_por_planta(date, date) from public, anon;
grant execute on function public.tablero_por_planta(date, date) to authenticated;
