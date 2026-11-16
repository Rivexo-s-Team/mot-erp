-- Etapa 3, paso 7: cargos (DISENO §4.4 y §4.6). Un cargo es algo que se le
-- debe facturar al cliente. Por ahora solo se registran y quedan "pendientes
-- de facturar": las facturas son de la Etapa 5 (D26).
--
-- Dos cargos nacen de la operación:
--   · Orden por evento: al cerrarla, volumen del reservorio × tarifa por litro.
--   · Falla "componente dañado por el cliente": permite generar un cargo (lo
--     decide una persona; no es automático).
-- También se pueden capturar a mano.
--
-- Son importes: los ve quien tiene precios.ver, con bitácora.
-- PENDIENTE(P4): tentativo. Los consultan Dirección, Administración y
-- Comercial; los capturan y corrigen Dirección y Administración.

create table public.cargos (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references public.cuentas (id),
  contrato_id uuid,
  orden_id uuid references public.ordenes_servicio (id),
  tipo text not null
    check (tipo in ('evento_litro', 'partes_mal_uso', 'servicio', 'laboratorio', 'otro')),
  concepto text not null check (length(btrim(concepto)) > 0),
  cantidad numeric check (cantidad > 0),
  unidad text,
  -- Sin IVA. Vacío mientras falte un dato: el cargo queda "por completar".
  precio_unitario numeric check (precio_unitario >= 0),
  importe numeric generated always as (round(cantidad * precio_unitario, 2)) stored,
  moneda text not null default 'USD' check (moneda ~ '^[A-Z]{3}$'),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'facturado', 'cancelado')),
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  foreign key (contrato_id, cuenta_id) references public.contratos (id, cuenta_id)
);
comment on table public.cargos is
  'Lo que se debe facturar al cliente. Nace de una orden de servicio o se captura a mano; la factura llega en la Etapa 5.';
comment on column public.cargos.importe is 'Cantidad × precio unitario, sin IVA. Lo calcula la base.';
create index cargos_cuenta_idx on public.cargos (cuenta_id);
create index cargos_contrato_idx on public.cargos (contrato_id);
create index cargos_orden_idx on public.cargos (orden_id);
create index cargos_estado_idx on public.cargos (estado) where deleted_at is null;
-- Una orden por evento genera un solo cargo por litros.
create unique index cargos_evento_orden_key on public.cargos (orden_id)
  where tipo = 'evento_litro' and deleted_at is null;

create trigger cargos_set_updated_at before update on public.cargos
  for each row execute function public.set_updated_at();
create trigger cargos_set_created_by before insert on public.cargos
  for each row execute function public.set_created_by();
create trigger cargos_bitacora after insert or update or delete on public.cargos
  for each row execute function public.registrar_bitacora();

insert into public.permisos (clave, descripcion) values
  ('cargos.ver', 'Consultar los cargos por facturar (requiere además ver precios).'),
  ('cargos.editar', 'Capturar, corregir y cancelar cargos por facturar.');
insert into public.rol_permisos (rol_id, permiso_id)
select r.id, p.id
from (values
  ('direccion', 'cargos.ver'), ('administracion', 'cargos.ver'), ('comercial', 'cargos.ver'),
  ('direccion', 'cargos.editar'), ('administracion', 'cargos.editar')
) as m (rol, permiso)
join public.roles r on r.clave = m.rol
join public.permisos p on p.clave = m.permiso;

alter table public.cargos enable row level security;
revoke all on public.cargos from anon, authenticated;
grant select, insert, update on public.cargos to authenticated;
create policy cargos_select on public.cargos for select to authenticated
  using ((select public.tiene_permiso('cargos.ver')) and (select public.tiene_permiso('precios.ver')));
create policy cargos_insert on public.cargos for insert to authenticated
  with check ((select public.tiene_permiso('cargos.editar')) and (select public.tiene_permiso('precios.ver')));
create policy cargos_update on public.cargos for update to authenticated
  using ((select public.tiene_permiso('cargos.editar')) and (select public.tiene_permiso('precios.ver')))
  with check ((select public.tiene_permiso('cargos.editar')) and (select public.tiene_permiso('precios.ver')));

-- Al cerrar una orden de un contrato por evento, el sistema genera el cargo:
-- volumen del reservorio × tarifa por litro. Lo hace aunque quien cierra (el
-- técnico) no vea precios. Si falta el volumen o la tarifa, el cargo nace
-- "por completar" y lo dice en sus notas: nada se pierde en silencio.
create function public.ordenes_servicio_generar_cargo_evento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contrato public.contratos;
  v_volumen numeric;
  v_precio numeric;
  v_equipo text;
  v_falta text := '';
begin
  if not (new.estado = 'cerrada' and old.estado <> 'cerrada' and new.contrato_id is not null) then
    return new;
  end if;
  select * into v_contrato from public.contratos where id = new.contrato_id;
  if v_contrato.tipo <> 'por_evento' then
    return new;
  end if;

  select e.identificador, coalesce(new.volumen_reservorio_l, e.volumen_reservorio_l)
    into v_equipo, v_volumen
  from public.equipos_cliente e where e.id = new.equipo_cliente_id;
  v_volumen := coalesce(v_volumen, new.volumen_reservorio_l);

  -- La tarifa por litro del equipo, si tiene una propia; si no, la general del contrato.
  select t.precio into v_precio
  from public.contrato_tarifas t
  where t.contrato_id = new.contrato_id and t.unidad = 'litro' and t.deleted_at is null
    and (t.equipo_cliente_id = new.equipo_cliente_id or t.equipo_cliente_id is null)
  order by (t.equipo_cliente_id is null), t.orden, t.created_at
  limit 1;

  if v_volumen is null then
    v_falta := v_falta || ' Falta el volumen del reservorio.';
  end if;
  if v_precio is null then
    v_falta := v_falta || ' El contrato no tiene tarifa por litro.';
  end if;

  insert into public.cargos
    (cuenta_id, contrato_id, orden_id, tipo, concepto, cantidad, unidad, precio_unitario, moneda, notas, created_by)
  values (
    v_contrato.cuenta_id, new.contrato_id, new.id, 'evento_litro',
    'Limpieza de aceite por evento, orden ' || new.folio
      || coalesce(', equipo ' || v_equipo, ''),
    v_volumen, 'litro', v_precio, v_contrato.moneda,
    nullif('Generado al cerrar la orden.' || v_falta, 'Generado al cerrar la orden.'),
    (select auth.uid())
  );
  return new;
end;
$$;
create trigger ordenes_servicio_generar_cargo_evento after update on public.ordenes_servicio
  for each row execute function public.ordenes_servicio_generar_cargo_evento();
