-- Portal de clientes, paso 1: quién entra y a qué cuenta pertenece (D62).
-- Un usuario del portal es un perfil con rol no interno ligado a UNA cuenta.
-- El cliente nunca lee las tablas internas: lo que ve se lo dan funciones
-- `portal_*` que devuelven solo las columnas que le tocan, de su cuenta.

create table public.usuarios_portal (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null unique references public.perfiles (id) on delete cascade,
  cuenta_id uuid not null references public.cuentas (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);
comment on table public.usuarios_portal is
  'Usuarios del cliente que entran al portal: cada uno pertenece a una sola cuenta. Se activan o desactivan en su perfil.';
create index usuarios_portal_cuenta_idx on public.usuarios_portal (cuenta_id);

create trigger usuarios_portal_set_updated_at before update on public.usuarios_portal
  for each row execute function public.set_updated_at();
create trigger usuarios_portal_set_created_by before insert on public.usuarios_portal
  for each row execute function public.set_created_by();
create trigger usuarios_portal_bitacora after insert or update or delete on public.usuarios_portal
  for each row execute function public.registrar_bitacora();

-- Solo perfiles con rol de portal; un usuario interno no se liga a una cuenta.
create function public.usuarios_portal_validar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.perfiles pf join public.roles r on r.id = pf.rol_id
    where pf.id = new.perfil_id and r.es_interno
  ) then
    raise exception 'Un usuario interno de MOT no puede ser usuario del portal.'
      using errcode = '23514';
  end if;
  if exists (select 1 from public.cuentas c where c.id = new.cuenta_id and c.deleted_at is not null) then
    raise exception 'La cuenta ya no está vigente.' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger usuarios_portal_validar before insert or update on public.usuarios_portal
  for each row execute function public.usuarios_portal_validar();

-- Y al revés: a quien ya es del portal no se le da un rol interno.
create function public.perfiles_proteger_portal()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.rol_id is distinct from old.rol_id
     and exists (select 1 from public.usuarios_portal up where up.perfil_id = new.id)
     and exists (select 1 from public.roles r where r.id = new.rol_id and r.es_interno) then
    raise exception 'Este usuario es del portal de un cliente: no puede tener un rol interno.'
      using errcode = '23514';
  end if;
  return new;
end $$;
create trigger perfiles_proteger_portal before update on public.perfiles
  for each row execute function public.perfiles_proteger_portal();

alter table public.usuarios_portal enable row level security;
revoke all on public.usuarios_portal from anon, authenticated;
grant select, insert on public.usuarios_portal to authenticated;

-- Los administra quien administra usuarios; cada quien ve su propia liga.
create policy usuarios_portal_select on public.usuarios_portal for select to authenticated
  using (perfil_id = (select auth.uid()) or (select public.tiene_permiso('usuarios.administrar')));
create policy usuarios_portal_insert on public.usuarios_portal for insert to authenticated
  with check ((select public.tiene_permiso('usuarios.administrar')));

-- Cuenta del usuario del portal actual: activo, con rol de portal y cuenta vigente.
-- Es la base de todo lo que el cliente puede leer.
create function public.mi_cuenta_portal()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select up.cuenta_id
  from public.usuarios_portal up
  join public.perfiles pf on pf.id = up.perfil_id
  join public.roles r on r.id = pf.rol_id
  join public.cuentas c on c.id = up.cuenta_id
  where up.perfil_id = (select auth.uid())
    and pf.activo
    and not r.es_interno
    and c.deleted_at is null;
$$;
comment on function public.mi_cuenta_portal() is
  'Cuenta a la que pertenece el usuario del portal actual, o null. Base de las funciones portal_*.';

create function public.portal_mi_cuenta()
returns table (cuenta_id uuid, nombre text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.nombre from public.cuentas c where c.id = public.mi_cuenta_portal();
$$;
comment on function public.portal_mi_cuenta() is
  'Portal: nombre de la cuenta del usuario actual. Nada más de la cuenta se expone.';

-- Alta en un solo paso (perfil + liga a la cuenta), con los permisos de quien la hace.
create function public.crear_usuario_portal(
  p_usuario uuid, p_cuenta uuid, p_nombre text, p_correo text, p_puesto text
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare v_rol uuid;
begin
  select id into v_rol from public.roles where clave = 'cliente';
  if v_rol is null then
    raise exception 'No tienes permiso para dar acceso al portal.' using errcode = '42501';
  end if;
  insert into public.perfiles (id, nombre, correo, puesto, rol_id)
  values (p_usuario, p_nombre, p_correo, nullif(btrim(p_puesto), ''), v_rol);
  insert into public.usuarios_portal (perfil_id, cuenta_id) values (p_usuario, p_cuenta);
  return p_usuario;
end $$;
comment on function public.crear_usuario_portal(uuid, uuid, text, text, text) is
  'Da de alta a un usuario del portal de una cuenta: su perfil con rol cliente y su liga, todo o nada.';

revoke execute on function public.mi_cuenta_portal() from public, anon;
revoke execute on function public.portal_mi_cuenta() from public, anon;
revoke execute on function public.crear_usuario_portal(uuid, uuid, text, text, text) from public, anon;
grant execute on function public.mi_cuenta_portal() to authenticated;
grant execute on function public.portal_mi_cuenta() to authenticated;
grant execute on function public.crear_usuario_portal(uuid, uuid, text, text, text) to authenticated;
