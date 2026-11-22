-- Rol de Coordinación: programa y lleva órdenes; consulta lo operativo; nada de dinero.
begin;
select plan(12);

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
with c as (insert into public.cuentas (nombre) values ('ZZ Coordinación') returning id)
insert into pruebas.d select 'cuenta', id from c;
with p as (insert into public.plantas (cuenta_id, nombre) values (pruebas.id('cuenta'), 'Planta') returning id)
insert into pruebas.d select 'planta', id from p;
with e as (insert into public.equipos_cliente (planta_id, identificador) values (pruebas.id('planta'), 'EQ-1') returning id)
insert into pruebas.d select 'equipo', id from e;
insert into public.equipos_cliente_costos (equipo_cliente_id, costo_aceite_virgen, moneda) values (pruebas.id('equipo'), 5, 'USD');
insert into public.cargos (cuenta_id, tipo, concepto, cantidad, unidad, precio_unitario, moneda)
  values (pruebas.id('cuenta'), 'servicio', 'Cargo de prueba', 1, 'servicio', 100, 'USD');
grant select, insert on pruebas.d to authenticated;

select is(
  (select string_agg(p.clave, ', ' order by p.clave)
   from public.rol_permisos rp join public.permisos p on p.id = rp.permiso_id
   join public.roles r on r.id = rp.rol_id where r.clave = 'coordinacion'),
  'catalogos.ver, clientes.ver, contratos.ver, documentos_acceso.ver, flota.ver, inventario.ver, laboratorio.ver, ordenes.administrar, ordenes.editar, ordenes.ver',
  'sus permisos son exactamente los acordados'
);

select pruebas.entrar('coordinacion');
select lives_ok(
  $$with o as (insert into public.ordenes_servicio (tipo, cuenta_id, planta_id, equipo_cliente_id, tecnico_id, fecha_programada)
      values ('visita', pruebas.id('cuenta'), pruebas.id('planta'), pruebas.id('equipo'), pruebas.uid('tecnico'), date '2037-05-10') returning id)
    insert into pruebas.d select 'orden', id from o$$,
  'programa una visita y la asigna a un técnico'
);
select lives_ok(
  $$update public.ordenes_servicio set fecha_programada = date '2037-05-12' where id = pruebas.id('orden')$$,
  'corrige una orden que no es suya'
);
select is((select fecha_programada from public.ordenes_servicio where id = pruebas.id('orden')), date '2037-05-12',
  'y el cambio queda guardado');
select is((select count(*)::int from public.cuentas where id = pruebas.id('cuenta')), 1, 'consulta clientes');
select is((select count(*)::int from public.equipos_cliente_costos), 0, 'no ve costos');
select is((select count(*)::int from public.cargos), 0, 'no ve cargos');
select is((select count(*)::int from public.facturas), 0, 'ni facturas');
select is((select count(*)::int from public.oportunidades), 0, 'ni oportunidades');
with c as (update public.cuentas set nombre = 'ZZ Otro' where id = pruebas.id('cuenta') returning 1)
select is((select count(*)::int from c), 0, 'no edita clientes');
select throws_ok(
  $$insert into public.robox (numero_serie) values ('ZZ-COORD-1')$$,
  '42501', null, 'no da de alta Robox'
);

select pruebas.entrar('tecnico');
select is((select count(*)::int from public.ordenes_servicio where id = pruebas.id('orden')), 1,
  'el técnico ve la orden que le asignó Coordinación');

select * from finish();
rollback;
