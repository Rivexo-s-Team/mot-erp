-- Etapa 5, paso 2: las rentas mensuales como cargos (DISENO §4.6).
--
-- Cada tarifa mensual de un contrato vigente genera un cargo por mes. No hay
-- tarea automática: alguien de administración pide "generar las rentas" del
-- mes que elija (la emisión recurrente es de la Etapa 6). Pedirlo dos veces
-- no duplica nada.
--
-- PENDIENTE(P8): falta saber si la renta se factura por mes adelantado o
-- vencido y si un mes incompleto se cobra completo. Por ahora se cobra el mes
-- completo y el cargo avisa cuando el contrato empieza o termina dentro del mes.

alter table public.cargos drop constraint cargos_tipo_check;
alter table public.cargos
  add constraint cargos_tipo_check
    check (tipo in ('renta', 'evento_litro', 'partes_mal_uso', 'servicio', 'laboratorio', 'otro')),
  add column tarifa_id uuid references public.contrato_tarifas (id),
  -- Primer día del mes que cubre una renta.
  add column periodo date check (periodo = date_trunc('month', periodo)::date),
  add column orden_compra_id uuid references public.ordenes_compra (id),
  add constraint cargos_renta_check
    check (
      (tipo = 'renta' and tarifa_id is not null and periodo is not null)
      or (tipo <> 'renta' and tarifa_id is null and periodo is null)
    );
comment on column public.cargos.periodo is 'Mes que cubre un cargo de renta (su primer día).';
comment on column public.cargos.orden_compra_id is
  'Orden de compra del cliente que cubre el cargo, si la tarifa indica una.';
create index cargos_tarifa_idx on public.cargos (tarifa_id);
create index cargos_orden_compra_idx on public.cargos (orden_compra_id);
-- Una tarifa se cobra una sola vez por mes (un cargo cancelado sigue contando:
-- para volver a cobrarlo se reactiva, no se genera otro).
create unique index cargos_renta_periodo_key on public.cargos (tarifa_id, periodo)
  where tipo = 'renta' and deleted_at is null;

-- Las rentas que le tocan a un mes: una por cada tarifa mensual de los
-- contratos vigentes cuya vigencia toca ese mes. Dice cuáles ya tienen cargo.
create function public.rentas_del_mes(p_periodo date)
returns table (
  tarifa_id uuid,
  contrato_id uuid,
  cuenta_id uuid,
  cuenta text,
  planta text,
  concepto text,
  precio numeric,
  moneda text,
  orden_compra_id uuid,
  parcial boolean,
  cargo_id uuid,
  cargo_estado text
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
    on c.estado = 'vigente' and c.deleted_at is null
   and (c.fecha_inicio is null or c.fecha_inicio <= mes.fin)
   and (c.fecha_termino is null or c.fecha_termino >= mes.inicio)
  join public.contrato_tarifas t on t.contrato_id = c.id and t.unidad = 'mes' and t.deleted_at is null
  join public.cuentas cu on cu.id = c.cuenta_id
  join public.plantas p on p.id = c.planta_id
  left join public.cargos k
    on k.tarifa_id = t.id and k.periodo = mes.inicio and k.tipo = 'renta' and k.deleted_at is null
  order by cu.nombre, p.nombre, t.orden, t.created_at;
$$;
comment on function public.rentas_del_mes(date) is
  'Rentas que corresponden a un mes, con el cargo que ya tengan. Con los permisos de quien consulta.';
revoke all on function public.rentas_del_mes(date) from public, anon;
grant execute on function public.rentas_del_mes(date) to authenticated;

-- Crea los cargos de renta que le falten a un mes. Devuelve cuántos creó.
-- Con los permisos de quien llama: necesita poder capturar cargos y ver precios.
create function public.generar_rentas_mes(p_periodo date)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_inicio date := date_trunc('month', p_periodo)::date;
  v_mes text := (array['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
                       'septiembre', 'octubre', 'noviembre', 'diciembre'])[extract(month from p_periodo)::integer]
                || ' de ' || extract(year from p_periodo)::integer;
  v_creados integer;
begin
  if p_periodo is null then
    raise exception 'Falta el mes.' using errcode = 'P0001';
  end if;
  if not ((select public.tiene_permiso('cargos.editar')) and (select public.tiene_permiso('precios.ver'))) then
    raise exception 'Tu rol no puede generar las rentas.' using errcode = '42501';
  end if;

  insert into public.cargos
    (cuenta_id, contrato_id, tipo, concepto, cantidad, unidad, precio_unitario, moneda,
     tarifa_id, periodo, orden_compra_id, notas)
  select
    r.cuenta_id, r.contrato_id, 'renta', r.concepto || ' · ' || v_mes, 1, 'mes', r.precio, r.moneda,
    r.tarifa_id, v_inicio, r.orden_compra_id,
    case when r.parcial
      then 'El contrato empieza o termina dentro de este mes: revisa si se cobra completo.' end
  from public.rentas_del_mes(v_inicio) r
  where r.cargo_id is null
  on conflict do nothing;
  get diagnostics v_creados = row_count;
  return v_creados;
end;
$$;
comment on function public.generar_rentas_mes(date) is
  'Genera los cargos de renta que falten en un mes. Repetirlo no duplica cargos.';
revoke all on function public.generar_rentas_mes(date) from public, anon;
grant execute on function public.generar_rentas_mes(date) to authenticated;
