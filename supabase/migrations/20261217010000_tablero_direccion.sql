-- Tablero de dirección, paso 1: ingresos y cobranza (D68).
-- Nada se guarda: son consultas sobre lo ya capturado. Respetan RLS de quien
-- las llama (los cuatro roles que ven el tablero ya ven facturación y precios)
-- y además piden el permiso direccion.ver.

insert into public.permisos (clave, descripcion) values
  ('direccion.ver', 'Ver el tablero de dirección: ingresos, cobranza y resultados.');
insert into public.rol_permisos (rol_id, permiso_id)
select r.id, p.id
from public.roles r, public.permisos p
where p.clave = 'direccion.ver'
  and r.clave in ('direccion', 'administracion', 'administracion_coordinacion', 'comercial');

-- Facturado y cobrado por mes y moneda. `facturado` es sin IVA (el ingreso);
-- `facturado_total` es con IVA, para compararlo con lo cobrado. Lo cobrado es
-- dinero que entró: la aplicación de un anticipo (forma 30) no cuenta dos veces.
create function public.tablero_ingresos(p_desde date, p_hasta date)
returns table (mes date, moneda text, facturas integer, facturado numeric, facturado_total numeric, cobrado numeric)
language sql
stable
set search_path = ''
as $$
  with f as (
    select date_trunc('month', fa.fecha)::date as mes, fa.moneda,
           count(*)::integer as facturas, sum(t.subtotal) as facturado, sum(t.total) as facturado_total
    from public.facturas fa
    join public.factura_totales t on t.factura_id = fa.id
    where fa.estado = 'emitida' and fa.deleted_at is null
      and fa.fecha >= p_desde and fa.fecha <= p_hasta
    group by 1, 2
  ),
  c as (
    select date_trunc('month', pa.fecha)::date as mes, pa.moneda, sum(pa.monto) as cobrado
    from public.pagos pa
    where pa.deleted_at is null and pa.anticipo_factura_id is null
      and pa.fecha >= p_desde and pa.fecha <= p_hasta
    group by 1, 2
  )
  select coalesce(f.mes, c.mes), coalesce(f.moneda, c.moneda), coalesce(f.facturas, 0),
         coalesce(f.facturado, 0), coalesce(f.facturado_total, 0), coalesce(c.cobrado, 0)
  from f full join c on c.mes = f.mes and c.moneda = f.moneda
  where (select public.tiene_permiso('direccion.ver'))
  order by 1, 2;
$$;
comment on function public.tablero_ingresos(date, date) is
  'Tablero: facturado (sin y con IVA) y cobrado por mes y moneda, de facturas emitidas y pagos con dinero.';

-- Renta mensual de los contratos vigentes hoy, por moneda.
create function public.tablero_rentas_vigentes()
returns table (moneda text, contratos integer, rentas integer, renta_mensual numeric)
language sql
stable
set search_path = ''
as $$
  select c.moneda, count(distinct c.id)::integer, count(t.id)::integer, sum(t.precio)
  from public.contratos c
  join public.contrato_tarifas t on t.contrato_id = c.id and t.unidad = 'mes' and t.deleted_at is null
  where c.estado = 'vigente' and c.deleted_at is null
    and (select public.tiene_permiso('direccion.ver'))
  group by c.moneda
  order by c.moneda;
$$;
comment on function public.tablero_rentas_vigentes() is
  'Tablero: suma de las tarifas mensuales de los contratos vigentes, por moneda.';

-- Cargos pendientes, por moneda (sin IVA): lo que falta por facturar, esté
-- suelto o ya en un borrador de factura. Deja de contar al emitirse la factura.
create function public.tablero_por_facturar()
returns table (moneda text, cargos integer, importe numeric, por_completar integer)
language sql
stable
set search_path = ''
as $$
  select ca.moneda, count(*)::integer, coalesce(sum(ca.importe), 0),
         count(*) filter (where ca.importe is null)::integer
  from public.cargos ca
  where ca.estado = 'pendiente' and ca.deleted_at is null
    and (select public.tiene_permiso('direccion.ver'))
  group by ca.moneda
  order by ca.moneda;
$$;
comment on function public.tablero_por_facturar() is
  'Tablero: cargos pendientes (sueltos o en borrador de factura), por moneda. por_completar = sin importe todavía.';

revoke execute on function public.tablero_ingresos(date, date) from public, anon;
revoke execute on function public.tablero_rentas_vigentes() from public, anon;
revoke execute on function public.tablero_por_facturar() from public, anon;
grant execute on function public.tablero_ingresos(date, date) to authenticated;
grant execute on function public.tablero_rentas_vigentes() to authenticated;
grant execute on function public.tablero_por_facturar() to authenticated;
