-- Etapa 3, paso 5 (primera parte): inventario de partes y accesorios, y las
-- partes usadas en una orden de servicio (DISENO §4.4).
--
-- La existencia de cada parte no se guarda: es la suma de sus movimientos
-- (entradas, salidas y ajustes). Un movimiento no se edita ni se borra; un
-- error se corrige con otro movimiento. Al cerrar una orden, sus partes
-- salen del inventario solas.
--
-- PENDIENTE(P4): accesos tentativos. Todos los internos consultan; registran
-- movimientos Dirección, Administración y Técnico (falta definir quién
-- llevará el almacén). Los costos de las partes quedan para después.

-- ---------------------------------------------------------------------------
-- Partes usadas en una orden
-- ---------------------------------------------------------------------------
create table public.os_partes (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid not null references public.ordenes_servicio (id),
  parte_id uuid not null references public.partes (id),
  cantidad numeric not null check (cantidad > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  unique (orden_id, parte_id)
);
comment on table public.os_partes is
  'Partes cambiadas y accesorios instalados en una orden. Salen del inventario al cerrar la orden.';
create index os_partes_parte_idx on public.os_partes (parte_id);

create trigger os_partes_set_updated_at before update on public.os_partes
  for each row execute function public.set_updated_at();
create trigger os_partes_set_created_by before insert on public.os_partes
  for each row execute function public.set_created_by();

alter table public.os_partes enable row level security;
revoke all on public.os_partes from anon, authenticated;
grant select, insert, update, delete on public.os_partes to authenticated;
create policy os_partes_select on public.os_partes for select to authenticated
  using ((select public.tiene_permiso('ordenes.ver')));
create policy os_partes_insert on public.os_partes for insert to authenticated
  with check (public.puede_llenar_orden(orden_id));
create policy os_partes_update on public.os_partes for update to authenticated
  using (public.puede_llenar_orden(orden_id))
  with check (public.puede_llenar_orden(orden_id));
create policy os_partes_delete on public.os_partes for delete to authenticated
  using (public.puede_llenar_orden(orden_id));

-- ---------------------------------------------------------------------------
-- Movimientos de inventario
-- ---------------------------------------------------------------------------
create table public.inventario_movimientos (
  id uuid primary key default gen_random_uuid(),
  parte_id uuid not null references public.partes (id),
  tipo text not null check (tipo in ('entrada', 'salida', 'ajuste')),
  -- Con signo: las entradas suman, las salidas restan y un ajuste puede ir en cualquier sentido.
  cantidad numeric not null,
  fecha date not null default (now() at time zone 'America/Mexico_City')::date,
  -- Factura o remisión de la compra, u otro dato para ubicar el movimiento.
  referencia text,
  -- Orden de servicio que usó la parte. Solo lo llena el sistema al cerrar la orden.
  orden_id uuid references public.ordenes_servicio (id),
  notas text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  constraint inventario_movimientos_signo_check check (
    (tipo = 'entrada' and cantidad > 0)
    or (tipo = 'salida' and cantidad < 0)
    or (tipo = 'ajuste' and cantidad <> 0)
  ),
  constraint inventario_movimientos_orden_check check (orden_id is null or tipo = 'salida')
);
comment on table public.inventario_movimientos is
  'Entradas (compras), salidas (uso en órdenes u otras) y ajustes de cada parte. La existencia es la suma de las cantidades.';
create index inventario_movimientos_parte_idx on public.inventario_movimientos (parte_id, fecha);
create index inventario_movimientos_orden_idx on public.inventario_movimientos (orden_id);

create trigger inventario_movimientos_set_created_by before insert on public.inventario_movimientos
  for each row execute function public.set_created_by();

insert into public.permisos (clave, descripcion) values
  ('inventario.ver', 'Consultar existencias y movimientos de partes.'),
  ('inventario.editar', 'Registrar entradas, salidas y ajustes de inventario.');
insert into public.rol_permisos (rol_id, permiso_id)
select r.id, p.id
from (values
  ('direccion', 'inventario.ver'), ('comercial', 'inventario.ver'), ('tecnico', 'inventario.ver'),
  ('laboratorio', 'inventario.ver'), ('administracion', 'inventario.ver'),
  ('direccion', 'inventario.editar'), ('administracion', 'inventario.editar'), ('tecnico', 'inventario.editar')
) as m (rol, permiso)
join public.roles r on r.clave = m.rol
join public.permisos p on p.clave = m.permiso;

-- Solo se consulta y se agrega: sin update ni delete.
alter table public.inventario_movimientos enable row level security;
revoke all on public.inventario_movimientos from anon, authenticated;
grant select, insert on public.inventario_movimientos to authenticated;
create policy inventario_movimientos_select on public.inventario_movimientos for select to authenticated
  using ((select public.tiene_permiso('inventario.ver')));
-- A mano no se puede atribuir un movimiento a una orden.
create policy inventario_movimientos_insert on public.inventario_movimientos for insert to authenticated
  with check ((select public.tiene_permiso('inventario.editar')) and orden_id is null);

-- Existencia de cada parte del catálogo.
create view public.inventario_existencias
with (security_invoker = true) as
select
  p.id as parte_id,
  coalesce(sum(m.cantidad), 0) as existencia,
  max(m.fecha) as ultimo_movimiento
from public.partes p
left join public.inventario_movimientos m on m.parte_id = p.id
group by p.id;
comment on view public.inventario_existencias is
  'Existencia de cada parte = suma de sus movimientos. Respeta RLS de quien consulta.';
revoke all on public.inventario_existencias from anon, authenticated;
grant select on public.inventario_existencias to authenticated;

-- Ajuste por conteo: se indica cuántas piezas hay de verdad y el sistema
-- registra la diferencia. Si ya coincide, no registra nada.
create function public.ajustar_existencia(p_parte uuid, p_contada numeric, p_notas text default null)
returns numeric
language plpgsql
set search_path = ''
as $$
declare
  v_diferencia numeric;
begin
  if p_contada is null or p_contada < 0 then
    raise exception 'La existencia contada no puede ser negativa.' using errcode = '23514';
  end if;
  select p_contada - coalesce(sum(cantidad), 0) into v_diferencia
  from public.inventario_movimientos where parte_id = p_parte;
  if v_diferencia <> 0 then
    insert into public.inventario_movimientos (parte_id, tipo, cantidad, notas)
    values (p_parte, 'ajuste', v_diferencia, nullif(btrim(p_notas), ''));
  end if;
  return v_diferencia;
end;
$$;
comment on function public.ajustar_existencia(uuid, numeric, text) is
  'Deja la existencia de una parte en lo contado, registrando la diferencia como ajuste. Corre con los permisos de quien la llama.';
revoke execute on function public.ajustar_existencia(uuid, numeric, text) from public, anon;
grant execute on function public.ajustar_existencia(uuid, numeric, text) to authenticated;

-- Al cerrar una orden, sus partes salen del inventario. Lo hace el sistema,
-- aunque quien cierra no pueda registrar movimientos a mano.
create function public.ordenes_servicio_descontar_partes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.estado = 'cerrada' and old.estado <> 'cerrada' then
    insert into public.inventario_movimientos (parte_id, tipo, cantidad, fecha, orden_id, created_by)
    select p.parte_id, 'salida', -p.cantidad,
           coalesce(new.fecha_real, (now() at time zone 'America/Mexico_City')::date),
           new.id, (select auth.uid())
    from public.os_partes p
    where p.orden_id = new.id;
  end if;
  return new;
end;
$$;
create trigger ordenes_servicio_descontar_partes after update on public.ordenes_servicio
  for each row execute function public.ordenes_servicio_descontar_partes();

-- ---------------------------------------------------------------------------
-- La captura ahora incluye las partes
-- ---------------------------------------------------------------------------
-- "partes": [{"id": uuid, "cantidad": n}]. Lo demás no cambia.
create or replace function public.guardar_captura_orden(p_orden uuid, p_captura jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_momento text;
  v_l jsonb;
  v_rol text;
  v_f jsonb;
begin
  if not public.puede_llenar_orden(p_orden) then
    raise exception 'No puedes capturar en esta orden.' using errcode = '42501';
  end if;

  update public.ordenes_servicio set
    id_caso = nullif(btrim(p_captura->>'id_caso'), ''),
    temperatura_aceite_c = nullif(p_captura->>'temperatura_aceite_c', '')::numeric,
    volumen_reservorio_l = nullif(p_captura->>'volumen_reservorio_l', '')::numeric,
    observaciones = nullif(btrim(p_captura->>'observaciones'), '')
  where id = p_orden;

  foreach v_momento in array array['inicial', 'posterior'] loop
    v_l := jsonb_strip_nulls(coalesce(p_captura->'lecturas'->v_momento, '{}'::jsonb));
    if not exists (select 1 from jsonb_each_text(v_l) e where btrim(e.value) <> '') then
      delete from public.os_lecturas where orden_id = p_orden and momento = v_momento;
    else
      insert into public.os_lecturas (
        orden_id, momento, modelo, numero_serie, programa, presion_filtro,
        filter_used_dias, filter_lifetime_dias, runtime_dias,
        ack_flow_l, presion_bar, flujo_l_min, temperatura_c
      ) values (
        p_orden, v_momento,
        nullif(btrim(v_l->>'modelo'), ''), nullif(btrim(v_l->>'numero_serie'), ''),
        nullif(btrim(v_l->>'programa'), ''), nullif(btrim(v_l->>'presion_filtro'), ''),
        nullif(v_l->>'filter_used_dias', '')::integer, nullif(v_l->>'filter_lifetime_dias', '')::integer,
        nullif(v_l->>'runtime_dias', '')::integer,
        nullif(v_l->>'ack_flow_l', '')::numeric, nullif(v_l->>'presion_bar', '')::numeric,
        nullif(v_l->>'flujo_l_min', '')::numeric, nullif(v_l->>'temperatura_c', '')::numeric
      )
      on conflict (orden_id, momento) do update set
        modelo = excluded.modelo, numero_serie = excluded.numero_serie,
        programa = excluded.programa, presion_filtro = excluded.presion_filtro,
        filter_used_dias = excluded.filter_used_dias, filter_lifetime_dias = excluded.filter_lifetime_dias,
        runtime_dias = excluded.runtime_dias, ack_flow_l = excluded.ack_flow_l,
        presion_bar = excluded.presion_bar, flujo_l_min = excluded.flujo_l_min,
        temperatura_c = excluded.temperatura_c;
    end if;
  end loop;

  delete from public.os_actividades a
  where a.orden_id = p_orden
    and not exists (
      select 1 from jsonb_array_elements(coalesce(p_captura->'actividades', '[]'::jsonb)) x
      where (x->>'id')::uuid = a.actividad_id
    );
  insert into public.os_actividades (orden_id, actividad_id, cantidad)
  select p_orden, (x->>'id')::uuid, nullif(x->>'cantidad', '')::integer
  from jsonb_array_elements(coalesce(p_captura->'actividades', '[]'::jsonb)) x
  on conflict (orden_id, actividad_id) do update set cantidad = excluded.cantidad;

  delete from public.os_fallas f
  where f.orden_id = p_orden
    and not exists (
      select 1 from jsonb_array_elements_text(coalesce(p_captura->'fallas', '[]'::jsonb)) x
      where x::uuid = f.falla_id
    );
  insert into public.os_fallas (orden_id, falla_id)
  select p_orden, x::uuid
  from jsonb_array_elements_text(coalesce(p_captura->'fallas', '[]'::jsonb)) x
  on conflict (orden_id, falla_id) do nothing;

  -- Partes y accesorios: si la captura no trae la llave "partes", no se tocan.
  if p_captura ? 'partes' then
    delete from public.os_partes p
    where p.orden_id = p_orden
      and not exists (
        select 1 from jsonb_array_elements(p_captura->'partes') x
        where (x->>'id')::uuid = p.parte_id
      );
    insert into public.os_partes (orden_id, parte_id, cantidad)
    select p_orden, (x->>'id')::uuid, (x->>'cantidad')::numeric
    from jsonb_array_elements(p_captura->'partes') x
    on conflict (orden_id, parte_id) do update set cantidad = excluded.cantidad;
  end if;

  -- Firmas: si la captura no trae la llave "firmas", no se tocan.
  if p_captura ? 'firmas' then
    foreach v_rol in array array['tecnico', 'cliente'] loop
      v_f := coalesce(p_captura->'firmas'->v_rol, '{}'::jsonb);
      if jsonb_array_length(coalesce(v_f->'trazos', '[]'::jsonb)) = 0 then
        delete from public.os_firmas where orden_id = p_orden and rol = v_rol;
      else
        insert into public.os_firmas (orden_id, rol, nombre, cargo, fecha, trazos)
        values (
          p_orden, v_rol, btrim(v_f->>'nombre'), nullif(btrim(v_f->>'cargo'), ''),
          nullif(v_f->>'fecha', '')::date, v_f->'trazos'
        )
        on conflict (orden_id, rol) do update set
          nombre = excluded.nombre, cargo = excluded.cargo,
          fecha = excluded.fecha, trazos = excluded.trazos;
      end if;
    end loop;
  end if;
end;
$$;

