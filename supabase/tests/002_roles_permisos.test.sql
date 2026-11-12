-- Un usuario de cada rol ve solo lo que le corresponde.
begin;
select plan(43);

-- Todo lo de la prueba vive en un esquema temporal y se deshace con el rollback.
create schema pruebas;
grant usage on schema pruebas to authenticated;

-- Usuarios propios de la prueba (no depende del seed).
create function pruebas.crear_usuario(p_rol text, p_activo boolean default true)
returns uuid language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email)
  values (v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'prueba-' || v_id || '@mot.test');
  insert into public.perfiles (id, nombre, correo, rol_id, activo)
  select v_id, 'Prueba ' || p_rol, 'prueba-' || v_id || '@mot.test', id, p_activo
  from public.roles where clave = p_rol;
  return v_id;
end $$;

-- Cuántos parámetros hay en total (para no fijar el número en las pruebas).
create table pruebas.total_parametros as select count(*)::int as n from public.parametros_negocio;
grant select on pruebas.total_parametros to authenticated;

create table pruebas.u (rol text primary key, id uuid);
insert into pruebas.u
select clave, pruebas.crear_usuario(clave) from public.roles;
insert into pruebas.u values ('direccion_inactiva', pruebas.crear_usuario('direccion', false));
grant select on pruebas.u to authenticated;

-- Simula la sesión de un usuario.
create function pruebas.entrar(p_rol text) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from pruebas.u where rol = p_rol), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
grant execute on all functions in schema pruebas to authenticated;

create function pruebas.cuenta(p_tabla text) returns int language plpgsql as $$
declare n int;
begin
  execute format('select count(*) from public.%I', p_tabla) into n;
  return n;
end $$;

select is((select count(*)::int from public.roles), 6, 'hay 6 roles');
select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity),
  0, 'todas las tablas de public tienen RLS activado'
);

-- Dirección: ve todo --------------------------------------------------------
select pruebas.entrar('direccion');
select is(pruebas.cuenta('parametros_negocio'), (select n from pruebas.total_parametros), 'dirección ve los parámetros');
select cmp_ok(pruebas.cuenta('bitacora'), '>', 0, 'dirección ve la bitácora');
select cmp_ok(pruebas.cuenta('perfiles'), '>=', 7, 'dirección ve todos los perfiles');
select is(pruebas.cuenta('roles'), 6, 'dirección ve todos los roles');
select cmp_ok(pruebas.cuenta('permisos'), '>=', 5, 'dirección ve los permisos');
select ok(public.tiene_permiso('usuarios.administrar'), 'dirección administra usuarios');

-- Comercial y Administración: precios sí, usuarios y bitácora no -------------
select pruebas.entrar('comercial');
select is(pruebas.cuenta('parametros_negocio'), (select n from pruebas.total_parametros), 'comercial ve los parámetros');
select is(pruebas.cuenta('bitacora'), 0, 'comercial no ve la bitácora');
select is(pruebas.cuenta('perfiles'), 1, 'comercial solo ve su perfil');
select is(pruebas.cuenta('roles'), 1, 'comercial solo ve su rol');
select is(pruebas.cuenta('rol_permisos'), 0, 'comercial no ve la matriz');
select ok(public.tiene_permiso('precios.ver'), 'comercial ve precios');
select ok(public.tiene_permiso('contratos.ver') and not public.tiene_permiso('contratos.editar'), 'comercial consulta contratos pero no los edita');
select ok(not public.tiene_permiso('usuarios.administrar'), 'comercial no administra usuarios');

with cambio as (
  update public.parametros_negocio set valor = 0.10
  where clave = 'cotizador_porcentaje_aceite_nuevo' returning 1
)
select is((select count(*)::int from cambio), 0, 'comercial no puede cambiar parámetros');

select pruebas.entrar('administracion');
select is(pruebas.cuenta('parametros_negocio'), (select n from pruebas.total_parametros), 'administración ve los parámetros');
select is(pruebas.cuenta('bitacora'), 0, 'administración no ve la bitácora');
select ok(public.tiene_permiso('precios.ver'), 'administración ve precios');
select ok(public.tiene_permiso('contratos.editar'), 'administración edita contratos');
select ok(public.tiene_permiso('ordenes.ver') and not public.tiene_permiso('ordenes.editar'), 'administración consulta órdenes pero no las llena');

-- Técnico, Laboratorio y Cliente: sin precios -------------------------------
select pruebas.entrar('tecnico');
select is(pruebas.cuenta('parametros_negocio'), 0, 'técnico no ve los parámetros');
select is(pruebas.cuenta('bitacora'), 0, 'técnico no ve la bitácora');
select is(pruebas.cuenta('perfiles'), 1, 'técnico solo ve su perfil');
select ok(not public.tiene_permiso('precios.ver'), 'técnico no ve precios');
select ok(public.tiene_permiso('ordenes.editar') and not public.tiene_permiso('ordenes.administrar'), 'técnico llena órdenes pero no administra las de otros');
select ok(public.tiene_permiso('contratos.ver') and not public.tiene_permiso('contratos.editar'), 'técnico consulta contratos pero no los edita');

with cambio as (
  update public.perfiles set rol_id = (select public.mi_rol_id()), nombre = 'Otro'
  where id = (select auth.uid()) returning 1
)
select is((select count(*)::int from cambio), 0, 'técnico no puede editar su propio perfil');

select throws_ok(
  $$insert into public.rol_permisos (rol_id, permiso_id)
    select public.mi_rol_id(), gen_random_uuid()$$,
  '42501', null, 'técnico no puede darse permisos'
);

select pruebas.entrar('laboratorio');
select is(pruebas.cuenta('parametros_negocio'), 0, 'laboratorio no ve los parámetros');
select ok(not public.tiene_permiso('precios.ver'), 'laboratorio no ve precios');
select is(pruebas.cuenta('perfiles'), 1, 'laboratorio solo ve su perfil');

select pruebas.entrar('cliente');
select is(pruebas.cuenta('parametros_negocio'), 0, 'cliente no ve los parámetros');
select is(pruebas.cuenta('bitacora'), 0, 'cliente no ve la bitácora');
select is(pruebas.cuenta('perfiles'), 1, 'cliente solo ve su perfil');
select is(public.mis_permisos(), '{}'::text[], 'cliente no tiene permisos internos');

-- Usuario inactivo: nada ----------------------------------------------------
select pruebas.entrar('direccion_inactiva');
select is(pruebas.cuenta('parametros_negocio'), 0, 'un usuario inactivo no ve nada');
select ok(not public.tiene_permiso('usuarios.administrar'), 'un usuario inactivo no tiene permisos');

-- Dirección: cambia parámetros y usuarios, pero no su propio perfil ----------
select pruebas.entrar('direccion');
with cambio as (
  update public.parametros_negocio set valor = 0.65
  where clave = 'cotizador_porcentaje_aceite_nuevo' returning 1
)
select is((select count(*)::int from cambio), 1, 'dirección puede cambiar parámetros');

with cambio as (
  update public.perfiles set activo = false where id = (select id from pruebas.u where rol = 'tecnico') returning 1
)
select is((select count(*)::int from cambio), 1, 'dirección puede desactivar a otro usuario');

with cambio as (
  update public.perfiles set activo = false where id = (select auth.uid()) returning 1
)
select is((select count(*)::int from cambio), 0, 'dirección no puede desactivarse a sí misma');

select is(
  (select usuario_id from public.bitacora
    where tabla = 'parametros_negocio' and operacion = 'UPDATE' order by created_at desc limit 1),
  (select id from pruebas.u where rol = 'direccion'),
  'la bitácora registra quién hizo el cambio'
);

select * from finish();
rollback;
