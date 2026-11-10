-- Usuarios, roles y permisos (DISENO §4.7).
-- La matriz rol × permiso vive en datos: se cambia sin tocar el código.
--
-- PENDIENTE(P4): los 6 roles y sus alcances son tentativos hasta que el Director
-- General de MOT confirme usuarios y permisos. El "vendedor externo ve solo sus
-- oportunidades" se aplicará en las políticas de oportunidades (Etapa 1).

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique check (clave ~ '^[a-z][a-z0-9_]*$'),
  nombre text not null,
  descripcion text not null,
  es_interno boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);
comment on table public.roles is 'Roles del sistema. es_interno = false para usuarios del portal de clientes.';

create table public.permisos (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique check (clave ~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$'),
  descripcion text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);
comment on table public.permisos is 'Permisos con forma modulo.accion, p. ej. precios.ver.';

create table public.rol_permisos (
  id uuid primary key default gen_random_uuid(),
  rol_id uuid not null references public.roles (id) on delete cascade,
  permiso_id uuid not null references public.permisos (id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  unique (rol_id, permiso_id)
);
comment on table public.rol_permisos is 'Matriz rol × permiso.';
create index rol_permisos_permiso_idx on public.rol_permisos (permiso_id);

create table public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null check (length(btrim(nombre)) > 0),
  correo text not null unique check (correo = lower(btrim(correo)) and correo like '%_@_%'),
  puesto text,
  rol_id uuid not null references public.roles (id),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);
comment on table public.perfiles is
  'Datos del usuario (uno por usuario de Supabase Auth). Un perfil inactivo no tiene ningún permiso.';
comment on column public.perfiles.correo is
  'Copia del correo de acceso, para listar y contactar usuarios sin consultar auth.users.';
create index perfiles_rol_idx on public.perfiles (rol_id);

-- ---------------------------------------------------------------------------
-- Triggers estándar y bitácora
-- ---------------------------------------------------------------------------

create trigger roles_set_updated_at before update on public.roles
  for each row execute function public.set_updated_at();
create trigger roles_set_created_by before insert on public.roles
  for each row execute function public.set_created_by();

create trigger permisos_set_updated_at before update on public.permisos
  for each row execute function public.set_updated_at();
create trigger permisos_set_created_by before insert on public.permisos
  for each row execute function public.set_created_by();

create trigger rol_permisos_set_created_by before insert on public.rol_permisos
  for each row execute function public.set_created_by();
create trigger rol_permisos_bitacora after insert or update or delete on public.rol_permisos
  for each row execute function public.registrar_bitacora();

create trigger perfiles_set_updated_at before update on public.perfiles
  for each row execute function public.set_updated_at();
create trigger perfiles_set_created_by before insert on public.perfiles
  for each row execute function public.set_created_by();
create trigger perfiles_bitacora after insert or update or delete on public.perfiles
  for each row execute function public.registrar_bitacora();

-- ---------------------------------------------------------------------------
-- Funciones de apoyo para RLS
-- ---------------------------------------------------------------------------

-- security definer: leen la matriz aunque el usuario no pueda consultar esas tablas.
create function public.tiene_permiso(p_clave text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.perfiles pf
    join public.rol_permisos rp on rp.rol_id = pf.rol_id
    join public.permisos pe on pe.id = rp.permiso_id
    where pf.id = (select auth.uid())
      and pf.activo
      and pe.clave = p_clave
  );
$$;
comment on function public.tiene_permiso(text) is
  'Verdadero si el usuario actual está activo y su rol tiene el permiso. Base de las políticas RLS.';

create function public.mis_permisos()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(pe.clave order by pe.clave), '{}')
  from public.perfiles pf
  join public.rol_permisos rp on rp.rol_id = pf.rol_id
  join public.permisos pe on pe.id = rp.permiso_id
  where pf.id = (select auth.uid())
    and pf.activo;
$$;
comment on function public.mis_permisos() is
  'Permisos del usuario actual; la app los usa para armar el menú. La seguridad real está en RLS.';

create function public.mi_rol_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select rol_id from public.perfiles where id = (select auth.uid());
$$;
comment on function public.mi_rol_id() is 'Rol del usuario actual (para políticas RLS).';

revoke execute on function public.tiene_permiso(text) from public, anon;
revoke execute on function public.mis_permisos() from public, anon;
revoke execute on function public.mi_rol_id() from public, anon;
grant execute on function public.tiene_permiso(text) to authenticated;
grant execute on function public.mis_permisos() to authenticated;
grant execute on function public.mi_rol_id() to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.roles enable row level security;
alter table public.permisos enable row level security;
alter table public.rol_permisos enable row level security;
alter table public.perfiles enable row level security;

revoke all on public.roles, public.permisos, public.rol_permisos, public.perfiles from anon, authenticated;
grant select on public.roles, public.permisos to authenticated;
grant select, insert, delete on public.rol_permisos to authenticated;
grant select, insert, update on public.perfiles to authenticated;

-- Cada quien ve su propio rol; quien administra usuarios ve todos.
create policy roles_select on public.roles for select to authenticated
  using (
    (select public.tiene_permiso('usuarios.administrar'))
    or id = (select public.mi_rol_id())
  );

create policy permisos_select on public.permisos for select to authenticated
  using ((select public.tiene_permiso('usuarios.administrar')));

create policy rol_permisos_select on public.rol_permisos for select to authenticated
  using ((select public.tiene_permiso('usuarios.administrar')));
create policy rol_permisos_insert on public.rol_permisos for insert to authenticated
  with check ((select public.tiene_permiso('usuarios.administrar')));
create policy rol_permisos_delete on public.rol_permisos for delete to authenticated
  using ((select public.tiene_permiso('usuarios.administrar')));

-- Cada quien ve su propio perfil; quien administra usuarios ve y edita todos.
-- Nadie cambia su propio perfil desde aquí (ni su rol ni su estado).
create policy perfiles_select on public.perfiles for select to authenticated
  using (id = (select auth.uid()) or (select public.tiene_permiso('usuarios.administrar')));
create policy perfiles_insert on public.perfiles for insert to authenticated
  with check ((select public.tiene_permiso('usuarios.administrar')));
create policy perfiles_update on public.perfiles for update to authenticated
  using ((select public.tiene_permiso('usuarios.administrar')) and id <> (select auth.uid()))
  with check ((select public.tiene_permiso('usuarios.administrar')) and id <> (select auth.uid()));

-- Tablas del paso anterior: ahora sí con políticas por permiso.
create policy parametros_negocio_select on public.parametros_negocio for select to authenticated
  using ((select public.tiene_permiso('parametros.ver')));
create policy parametros_negocio_update on public.parametros_negocio for update to authenticated
  using ((select public.tiene_permiso('parametros.editar')))
  with check ((select public.tiene_permiso('parametros.editar')));

create policy bitacora_select on public.bitacora for select to authenticated
  using ((select public.tiene_permiso('bitacora.ver')));

-- ---------------------------------------------------------------------------
-- Datos: roles, permisos y matriz inicial
-- ---------------------------------------------------------------------------

insert into public.roles (clave, nombre, descripcion, es_interno) values
  ('direccion', 'Dirección', 'Ve y hace todo, incluidos precios, costos y márgenes.', true),
  ('comercial', 'Comercial', 'Pipeline, cuentas, contactos y cotizaciones.', true),
  ('tecnico', 'Técnico', 'Agenda, órdenes de servicio, flota y equipos del cliente. Sin precios.', true),
  ('laboratorio', 'Laboratorio', 'Muestras, resultados e informes. Sin precios.', true),
  ('administracion', 'Administración', 'Contratos, facturación, cobranza e inventario.', true),
  ('cliente', 'Cliente (portal)', 'Sus informes publicados, sus órdenes de servicio y sus facturas.', false);

insert into public.permisos (clave, descripcion) values
  ('usuarios.administrar', 'Dar de alta usuarios, cambiar su rol y activarlos o desactivarlos.'),
  ('precios.ver', 'Ver precios, costos y márgenes.'),
  ('parametros.ver', 'Ver los parámetros de negocio (porcentaje y piso del cotizador, umbrales).'),
  ('parametros.editar', 'Cambiar los parámetros de negocio.'),
  ('bitacora.ver', 'Consultar la bitácora de cambios.');

insert into public.rol_permisos (rol_id, permiso_id)
select r.id, p.id
from (values
  ('direccion', 'usuarios.administrar'),
  ('direccion', 'precios.ver'),
  ('direccion', 'parametros.ver'),
  ('direccion', 'parametros.editar'),
  ('direccion', 'bitacora.ver'),
  ('comercial', 'precios.ver'),
  ('comercial', 'parametros.ver'),
  ('administracion', 'precios.ver'),
  ('administracion', 'parametros.ver')
) as m (rol, permiso)
join public.roles r on r.clave = m.rol
join public.permisos p on p.clave = m.permiso;
