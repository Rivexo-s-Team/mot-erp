-- Etapa 3, paso 3: fotos (evidencias), firmas y cierre de la orden (DISENO §4.4).
--
-- Las fotos van a un bucket privado de Storage. Las firmas se guardan como
-- trazos (los puntos que dibujó el dedo), no como imagen: pesan poco, viajan
-- con el borrador del celular aunque no haya señal y se dibujan igual en
-- pantalla y en el PDF.

-- ---------------------------------------------------------------------------
-- Fotos de la visita
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evidencias', 'evidencias', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic']);

-- Las ve quien ve las órdenes; las sube quien puede llenar esa orden. La
-- carpeta del archivo es el id de la orden. Sin update ni delete: una foto
-- subida no se reemplaza ni se borra desde la app.
create policy evidencias_select on storage.objects for select to authenticated
  using (bucket_id = 'evidencias' and (select public.tiene_permiso('ordenes.ver')));
create policy evidencias_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'evidencias'
    and case
      when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then public.puede_llenar_orden(((storage.foldername(name))[1])::uuid)
      else false
    end
  );

create table public.os_evidencias (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid not null references public.ordenes_servicio (id),
  tipo text not null
    check (tipo in ('pantalla_robox', 'termometro', 'frasco', 'instalacion', 'otro')),
  nombre text not null check (length(btrim(nombre)) > 0),
  -- Ruta dentro del bucket evidencias: <orden_id>/<archivo>.
  ruta text not null unique,
  tipo_mime text not null,
  tamano_bytes bigint not null check (tamano_bytes > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  constraint os_evidencias_ruta_check check (ruta like orden_id::text || '/%')
);
comment on table public.os_evidencias is
  'Fotos de una orden de servicio: pantalla del Robox, termómetro, frascos, instalación. El archivo está en Storage.';
create index os_evidencias_orden_idx on public.os_evidencias (orden_id);

-- ---------------------------------------------------------------------------
-- Firmas
-- ---------------------------------------------------------------------------
create table public.os_firmas (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid not null references public.ordenes_servicio (id),
  -- Quién firma: el técnico de MOT o el responsable del cliente que recibe.
  rol text not null check (rol in ('tecnico', 'cliente')),
  nombre text not null check (length(btrim(nombre)) > 0),
  cargo text,
  fecha date,
  -- Cada trazo es una lista [x1, y1, x2, y2, …] en un lienzo de 600 × 240.
  trazos jsonb not null
    check (jsonb_typeof(trazos) = 'array' and jsonb_array_length(trazos) > 0
           and pg_column_size(trazos) < 200000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  unique (orden_id, rol)
);
comment on table public.os_firmas is
  'Firma dibujada del técnico de MOT y del responsable del cliente, con nombre, cargo y fecha.';

do $$
declare t text;
begin
  foreach t in array array['os_evidencias', 'os_firmas'] loop
    execute format(
      'create trigger %1$s_set_updated_at before update on public.%1$I
         for each row execute function public.set_updated_at()', t);
    execute format(
      'create trigger %1$s_set_created_by before insert on public.%1$I
         for each row execute function public.set_created_by()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
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
  end loop;
end $$;
-- Las fotos no se borran (quitar una solo la oculta); una firma sí se puede
-- borrar para volver a firmar, mientras la orden no esté cerrada.
grant select, insert, update on public.os_evidencias to authenticated;
grant select, insert, update, delete on public.os_firmas to authenticated;
create policy os_firmas_delete on public.os_firmas for delete to authenticated
  using (public.puede_llenar_orden(orden_id));

-- ---------------------------------------------------------------------------
-- Cierre de la orden
-- ---------------------------------------------------------------------------
-- Solo se cierra una orden en curso y firmada: siempre por el técnico y, si es
-- una visita, también por el responsable del cliente.
create function public.ordenes_servicio_validar_cierre()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.estado = 'cerrada' and old.estado <> 'cerrada' then
    if old.estado <> 'en_curso' then
      raise exception 'Solo se cierra una orden en curso.' using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.os_firmas f where f.orden_id = new.id and f.rol = 'tecnico') then
      raise exception 'Falta la firma del técnico.' using errcode = 'P0001';
    end if;
    if new.tipo = 'visita'
       and not exists (select 1 from public.os_firmas f where f.orden_id = new.id and f.rol = 'cliente') then
      raise exception 'Falta la firma del responsable del cliente.' using errcode = 'P0001';
    end if;
    new.fecha_cierre := now();
  end if;
  return new;
end;
$$;
alter table public.ordenes_servicio add column fecha_cierre timestamptz;
comment on column public.ordenes_servicio.fecha_cierre is 'Cuándo se cerró la orden. Se llena sola.';
create trigger ordenes_servicio_validar_cierre before update on public.ordenes_servicio
  for each row execute function public.ordenes_servicio_validar_cierre();

-- ---------------------------------------------------------------------------
-- La captura ahora incluye las firmas
-- ---------------------------------------------------------------------------
-- "firmas": {"tecnico": {"nombre", "cargo", "fecha", "trazos": [[…]]}, "cliente": {…}}
-- Una firma sin trazos se quita. Lo demás no cambia.
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

