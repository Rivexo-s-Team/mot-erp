-- Etapa 1, paso 3: pipeline comercial (DISENO §4.2, decisiones D9 y D11).

-- ---------------------------------------------------------------------------
-- Canales de venta: vendedores externos (D9)
-- ---------------------------------------------------------------------------

create table public.canales_venta (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique check (length(btrim(nombre)) > 0),
  telefono text,
  correo text check (correo like '%_@_%'),
  notas text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);
comment on table public.canales_venta is
  'Vendedores externos. No son usuarios del sistema: solo traen la venta y comisionan; el seguimiento lo lleva un responsable interno.';

-- ---------------------------------------------------------------------------
-- Oportunidades
-- ---------------------------------------------------------------------------

create table public.oportunidades (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references public.cuentas (id),
  planta_id uuid,
  nombre text not null check (length(btrim(nombre)) > 0),
  responsable_id uuid not null references public.perfiles (id),
  canal_venta_id uuid references public.canales_venta (id),
  tipo text not null check (tipo in ('nuevo', 'ampliacion')),
  origen text not null
    check (origen in ('referencia', 'recomendacion', 'cliente_anterior', 'prospeccion')),
  etapa text not null default 'primer_contacto'
    check (etapa in (
      'primer_contacto', 'presentacion', 'visita', 'muestra',
      'resultados_laboratorio', 'cotizacion', 'seguimiento', 'ganada', 'perdida'
    )),
  volumen_estimado_l numeric check (volumen_estimado_l > 0),
  motivo_perdida text,
  notas text,
  fecha_cierre timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  foreign key (planta_id, cuenta_id) references public.plantas (id, cuenta_id),
  constraint oportunidades_motivo_perdida_check
    -- coalesce: sin él, un motivo nulo dejaría pasar la regla.
    check (etapa <> 'perdida' or coalesce(length(btrim(motivo_perdida)), 0) > 0)
);
comment on table public.oportunidades is
  'Una venta posible. Ganada = pendiente de contrato (el contrato se crea en la Etapa 2).';
comment on column public.oportunidades.responsable_id is 'Persona interna que da seguimiento.';
comment on column public.oportunidades.canal_venta_id is 'Vendedor externo que trajo la venta, si lo hubo.';
comment on column public.oportunidades.fecha_cierre is 'Cuándo se marcó como ganada o perdida. Se llena sola.';
create index oportunidades_cuenta_idx on public.oportunidades (cuenta_id);
create index oportunidades_etapa_idx on public.oportunidades (etapa) where deleted_at is null;
create index oportunidades_responsable_idx on public.oportunidades (responsable_id);

-- Al cerrar (ganada o perdida) se anota la fecha; al reabrir se limpia junto con el motivo.
create function public.oportunidades_al_cambiar_etapa()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.etapa in ('ganada', 'perdida') then
    if tg_op = 'INSERT' or old.etapa is distinct from new.etapa then
      new.fecha_cierre := now();
    end if;
  else
    new.fecha_cierre := null;
  end if;
  if new.etapa <> 'perdida' then
    new.motivo_perdida := null;
  end if;
  return new;
end;
$$;

create trigger oportunidades_al_cambiar_etapa before insert or update on public.oportunidades
  for each row execute function public.oportunidades_al_cambiar_etapa();

-- ---------------------------------------------------------------------------
-- Actividades comerciales
-- ---------------------------------------------------------------------------

-- DISENO §4.2 la llama "actividades"; ese nombre ya lo usa el catálogo de
-- actividades de servicio, así que esta es actividades_comerciales.
create table public.actividades_comerciales (
  id uuid primary key default gen_random_uuid(),
  oportunidad_id uuid not null references public.oportunidades (id),
  tipo text not null check (tipo in (
    'llamada', 'correo', 'presentacion_email', 'presentacion_presencial', 'visita', 'seguimiento'
  )),
  fecha date not null,
  responsable_id uuid not null references public.perfiles (id),
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz
);
comment on table public.actividades_comerciales is
  'Llamadas, correos, presentaciones, visitas y seguimientos de una oportunidad.';
create index actividades_comerciales_oportunidad_idx
  on public.actividades_comerciales (oportunidad_id, fecha desc);

-- Triggers estándar ---------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['canales_venta', 'oportunidades', 'actividades_comerciales'] loop
    execute format(
      'create trigger %1$s_set_updated_at before update on public.%1$I
         for each row execute function public.set_updated_at()', t);
    execute format(
      'create trigger %1$s_set_created_by before insert on public.%1$I
         for each row execute function public.set_created_by()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------

-- PENDIENTE(P4): el pipeline lo ven y editan Dirección y Comercial. Tentativo
-- hasta que el Director General confirme alcances.
insert into public.permisos (clave, descripcion) values
  ('oportunidades.ver', 'Consultar el pipeline: oportunidades, actividades y canales de venta.'),
  ('oportunidades.editar', 'Crear y editar oportunidades, actividades y canales de venta.');

insert into public.rol_permisos (rol_id, permiso_id)
select r.id, p.id
from public.roles r
join public.permisos p on p.clave in ('oportunidades.ver', 'oportunidades.editar')
where r.clave in ('direccion', 'comercial');

-- Nombres de los usuarios internos, para asignar responsables y mostrarlos sin
-- abrir la tabla de perfiles (que guarda correo y rol) a todo el equipo comercial.
create function public.directorio_comercial()
returns table (id uuid, nombre text, asignable boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    pf.id,
    pf.nombre,
    pf.activo and exists (
      select 1
      from public.rol_permisos rp
      join public.permisos pe on pe.id = rp.permiso_id
      where rp.rol_id = pf.rol_id and pe.clave = 'oportunidades.editar'
    ) as asignable
  from public.perfiles pf
  join public.roles r on r.id = pf.rol_id
  where r.es_interno
    and (select public.tiene_permiso('oportunidades.ver'));
$$;
comment on function public.directorio_comercial() is
  'Id y nombre de los usuarios internos; asignable = puede ser responsable de una oportunidad. Solo responde a quien ve el pipeline.';
revoke execute on function public.directorio_comercial() from public, anon;
grant execute on function public.directorio_comercial() to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['canales_venta', 'oportunidades', 'actividades_comerciales'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format(
      'create policy %1$s_select on public.%1$I for select to authenticated
         using ((select public.tiene_permiso(''oportunidades.ver'')))', t);
    execute format(
      'create policy %1$s_insert on public.%1$I for insert to authenticated
         with check ((select public.tiene_permiso(''oportunidades.editar'')))', t);
    execute format(
      'create policy %1$s_update on public.%1$I for update to authenticated
         using ((select public.tiene_permiso(''oportunidades.editar'')))
         with check ((select public.tiene_permiso(''oportunidades.editar'')))', t);
  end loop;
end $$;
