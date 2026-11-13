-- Etapa 3, paso 2: lo que el técnico captura en la visita (DISENO §4.4):
-- datos del equipo, lecturas del Robox (inicial y posterior), actividades y
-- fallas. Todo se guarda de una sola vez con guardar_captura_orden(), para
-- que el celular pueda enviar lo capturado sin señal en cuanto la recupere.

-- Datos del encabezado del formato que se toman en la visita.
alter table public.ordenes_servicio
  add column id_caso text,
  add column temperatura_aceite_c numeric,
  add column volumen_reservorio_l numeric check (volumen_reservorio_l > 0),
  add column observaciones text;
comment on column public.ordenes_servicio.id_caso is
  'ID de caso anotado en la visita (ej. RAS1-08). PENDIENTE(P1): texto libre mientras se confirma su regla.';
comment on column public.ordenes_servicio.temperatura_aceite_c is 'Temperatura del aceite medida en la visita, en °C.';
comment on column public.ordenes_servicio.volumen_reservorio_l is 'Volumen del reservorio anotado en la visita, en litros.';
comment on column public.ordenes_servicio.observaciones is 'Renglón "Otros / Notas" del formato.';

-- En el formato, "Toma de muestra(s)" y "Cambio de filtro(s)" llevan un espacio para la cantidad.
alter table public.actividades add column lleva_cantidad boolean not null default false;
comment on column public.actividades.lleva_cantidad is
  'Verdadero si al marcarla en una orden se pregunta cuántas (muestras tomadas, filtros cambiados).';
update public.actividades set lleva_cantidad = true
where nombre in ('Toma de muestras', 'Cambio de filtros');

-- ¿El usuario actual puede llenar esta orden? (responsable, acompañante o
-- quien administra órdenes, y la orden no está cerrada ni eliminada).
create function public.puede_llenar_orden(p_orden uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select public.tiene_permiso('ordenes.editar')) and exists (
    select 1 from public.ordenes_servicio o
    where o.id = p_orden
      and o.estado <> 'cerrada'
      and o.deleted_at is null
      and (
        o.tecnico_id = (select auth.uid())
        or o.acompanante_id = (select auth.uid())
        or (select public.tiene_permiso('ordenes.administrar'))
      )
  );
$$;
comment on function public.puede_llenar_orden(uuid) is
  'Verdadero si el usuario actual puede capturar en esa orden (para políticas RLS).';
revoke execute on function public.puede_llenar_orden(uuid) from public, anon;
grant execute on function public.puede_llenar_orden(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Lecturas del Robox
-- ---------------------------------------------------------------------------
create table public.os_lecturas (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid not null references public.ordenes_servicio (id),
  momento text not null check (momento in ('inicial', 'posterior')),
  modelo text,
  numero_serie text,
  programa text,
  presion_filtro text,
  filter_used_dias integer check (filter_used_dias >= 0),
  filter_lifetime_dias integer check (filter_lifetime_dias >= 0),
  runtime_dias integer check (runtime_dias >= 0),
  ack_flow_l numeric check (ack_flow_l >= 0),
  presion_bar numeric check (presion_bar >= 0),
  flujo_l_min numeric check (flujo_l_min >= 0),
  temperatura_c numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  unique (orden_id, momento)
);
comment on table public.os_lecturas is
  'Parámetros que muestra la pantalla del Robox, al llegar ("inicial") y al terminar ("posterior").';
comment on column public.os_lecturas.presion_filtro is 'Renglón "Presión / Filtro" del formato (ej. "3.5 / HY").';
comment on column public.os_lecturas.ack_flow_l is 'Litros acumulados que ha filtrado el Robox.';

-- ---------------------------------------------------------------------------
-- Actividades y fallas marcadas
-- ---------------------------------------------------------------------------
create table public.os_actividades (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid not null references public.ordenes_servicio (id),
  actividad_id uuid not null references public.actividades (id),
  -- Cuántas (ej. muestras tomadas o filtros cambiados). Opcional.
  cantidad integer check (cantidad > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  unique (orden_id, actividad_id)
);
comment on table public.os_actividades is 'Actividades del catálogo que se hicieron en la orden.';
create index os_actividades_actividad_idx on public.os_actividades (actividad_id);

create table public.os_fallas (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid not null references public.ordenes_servicio (id),
  falla_id uuid not null references public.fallas (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  unique (orden_id, falla_id)
);
comment on table public.os_fallas is 'Fallas del catálogo que se encontraron en la orden.';
create index os_fallas_falla_idx on public.os_fallas (falla_id);

-- Triggers estándar y RLS. Aquí sí se permite borrar: desmarcar una actividad
-- o falla quita su renglón (mientras la orden no esté cerrada).
do $$
declare t text;
begin
  foreach t in array array['os_lecturas', 'os_actividades', 'os_fallas'] loop
    execute format(
      'create trigger %1$s_set_updated_at before update on public.%1$I
         for each row execute function public.set_updated_at()', t);
    execute format(
      'create trigger %1$s_set_created_by before insert on public.%1$I
         for each row execute function public.set_created_by()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format(
      'create policy %1$s_select on public.%1$I for select to authenticated
         using ((select public.tiene_permiso(''ordenes.ver'')))', t);
    execute format(
      'create policy %1$s_insert on public.%1$I for insert to authenticated
         with check (public.puede_llenar_orden(orden_id))', t);
    execute format(
      'create policy %1$s_update on public.%1$I for update to authenticated
         using (public.puede_llenar_orden(orden_id))
         with check (public.puede_llenar_orden(orden_id))', t);
    execute format(
      'create policy %1$s_delete on public.%1$I for delete to authenticated
         using (public.puede_llenar_orden(orden_id))', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Guardar toda la captura de una vez
-- ---------------------------------------------------------------------------
-- p_captura: {
--   "id_caso", "temperatura_aceite_c", "volumen_reservorio_l", "observaciones",
--   "lecturas": {"inicial": {…}, "posterior": {…}},   -- vacío o ausente = sin lectura
--   "actividades": [{"id": uuid, "cantidad": n | null}],
--   "fallas": [uuid]
-- }
-- Reemplaza lo que hubiera: enviar dos veces lo mismo deja el mismo resultado.
create function public.guardar_captura_orden(p_orden uuid, p_captura jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_momento text;
  v_l jsonb;
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
end;
$$;
comment on function public.guardar_captura_orden(uuid, jsonb) is
  'Guarda de una vez lo capturado en la visita. Corre con los permisos de quien la llama (RLS).';
revoke execute on function public.guardar_captura_orden(uuid, jsonb) from public, anon;
grant execute on function public.guardar_captura_orden(uuid, jsonb) to authenticated;
