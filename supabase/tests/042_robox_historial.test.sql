-- Historial de almacén del Robox: se agrega, no se corrige ni se borra.
begin;
select plan(8);

create schema pruebas;
grant usage on schema pruebas to authenticated;

create function pruebas.crear_usuario(p_rol text, p_nombre text) returns uuid language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email)
  values (v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'prueba-' || v_id || '@mot.test');
  insert into public.perfiles (id, nombre, correo, rol_id)
  select v_id, p_nombre, 'prueba-' || v_id || '@mot.test', id
  from public.roles where clave = p_rol;
  return v_id;
end $$;

create table pruebas.u (rol text primary key, id uuid);
insert into pruebas.u select clave, pruebas.crear_usuario(clave, 'Prueba ' || clave) from public.roles;
grant select on pruebas.u to authenticated;

create function pruebas.entrar(p_rol text) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from pruebas.u where rol = p_rol), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pruebas.uid(p_rol text) returns uuid language sql stable as
  $$select id from pruebas.u where rol = p_rol$$;

create table pruebas.d (clave text primary key, id uuid);
grant select on pruebas.d to authenticated;
create function pruebas.id(p_clave text) returns uuid language sql stable as
  $$select id from pruebas.d where clave = p_clave$$;
with r as (insert into public.robox (numero_serie) values ('ZZ-HIST-1') returning id)
insert into pruebas.d select 'robox', id from r;

select pruebas.entrar('tecnico');
select lives_ok(
  $$insert into public.robox_historial (robox_id, fecha, movimiento, documento, detalle)
    values (pruebas.id('robox'), date '2037-01-10', 'salida_almacen', 'Pase de salida 37-001', 'Hacia planta de prueba')$$,
  'operación registra una salida de almacén con su pase'
);
select is(
  (select row(origen, created_by = pruebas.uid('tecnico'))::text from public.robox_historial where robox_id = pruebas.id('robox')),
  '(sistema,t)', 'queda con su origen y quién lo registró'
);
select throws_ok(
  $$insert into public.robox_historial (robox_id, fecha, movimiento) values (pruebas.id('robox'), date '2037-01-11', 'prestamo')$$,
  '23514', null, 'solo existen los movimientos del catálogo'
);
select throws_ok(
  $$update public.robox_historial set detalle = 'otro' where robox_id = pruebas.id('robox')$$,
  '42501', null, 'el historial no se corrige'
);
select throws_ok(
  $$delete from public.robox_historial where robox_id = pruebas.id('robox')$$,
  '42501', null, 'ni se borra'
);

select pruebas.entrar('comercial');
select is((select count(*)::int from public.robox_historial where robox_id = pruebas.id('robox')), 1,
  'comercial consulta el historial');
select throws_ok(
  $$insert into public.robox_historial (robox_id, fecha, movimiento) values (pruebas.id('robox'), date '2037-01-12', 'limpieza')$$,
  '42501', null, 'pero no lo registra'
);

select pruebas.entrar('cliente');
select is((select count(*)::int from public.robox_historial), 0, 'un usuario del portal no ve nada');

select * from finish();
rollback;
