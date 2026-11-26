-- Portal de clientes: el cliente ve solo las visitas cerradas de su cuenta.
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
insert into pruebas.u values ('cliente_b', pruebas.crear_usuario('cliente', 'Prueba cliente B'));
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
grant select, insert on pruebas.d to authenticated;
create function pruebas.id(p_clave text) returns uuid language sql stable as
  $$select id from pruebas.d where clave = p_clave$$;

create function pruebas.armar(p text) returns void language plpgsql as $$
begin
  with c as (insert into public.cuentas (nombre) values ('ZZ Portal ' || p) returning id)
  insert into pruebas.d select 'cuenta_' || p, id from c;
  with x as (insert into public.plantas (cuenta_id, nombre, municipio) values (pruebas.id('cuenta_' || p), 'Planta ' || p, 'Celaya') returning id)
  insert into pruebas.d select 'planta_' || p, id from x;
  with x as (insert into public.equipos_cliente (planta_id, identificador) values (pruebas.id('planta_' || p), 'EQ-' || p) returning id)
  insert into pruebas.d select 'equipo_' || p, id from x;
end $$;
select pruebas.armar('a');
select pruebas.armar('b');
insert into public.usuarios_portal (perfil_id, cuenta_id) values
  (pruebas.uid('cliente'), pruebas.id('cuenta_a')), (pruebas.uid('cliente_b'), pruebas.id('cuenta_b'));

create function pruebas.firma(p_nombre text) returns jsonb language sql immutable as
  $$select jsonb_build_object('nombre', p_nombre, 'cargo', 'Mantenimiento', 'fecha', '2037-02-01',
                              'trazos', '[[10,20,30,40,50,60]]'::jsonb)$$;
-- Visita de una cuenta; si p_cerrar, capturada, firmada y cerrada.
create function pruebas.visita(p_clave text, p text, p_cerrar boolean) returns void language plpgsql as $$
declare v uuid;
begin
  insert into public.ordenes_servicio (tipo, cuenta_id, planta_id, equipo_cliente_id, tecnico_id, fecha_programada, notas)
  values ('visita', pruebas.id('cuenta_' || p), pruebas.id('planta_' || p), pruebas.id('equipo_' || p),
          pruebas.uid('tecnico'), '2037-02-01', 'NOTA INTERNA')
  returning id into v;
  insert into pruebas.d values (p_clave, v);
  if p_cerrar then
    update public.ordenes_servicio set estado = 'en_curso', fecha_real = '2037-02-02' where id = v;
    perform public.guardar_captura_orden(v, jsonb_build_object(
      'observaciones', 'Se cambió el filtro',
      'actividades', jsonb_build_array(jsonb_build_object('id', (select id from public.actividades where activo order by orden, nombre limit 1), 'cantidad', '')),
      'firmas', jsonb_build_object('tecnico', pruebas.firma('Técnico MOT'), 'cliente', pruebas.firma('Responsable'))));
    update public.ordenes_servicio set estado = 'cerrada' where id = v;
  end if;
end $$;
grant execute on all functions in schema pruebas to authenticated;

select pruebas.entrar('tecnico');
select pruebas.visita('a_cerrada', 'a', true);
select pruebas.visita('a_programada', 'a', false);
select pruebas.visita('b_cerrada', 'b', true);
select is(
  (select estado from public.ordenes_servicio where id = pruebas.id('a_cerrada')), 'cerrada',
  'la visita de prueba queda cerrada'
);

select pruebas.entrar('cliente');
select is((select count(*)::int from public.portal_ordenes()), 1, 'el cliente ve solo su visita cerrada');
select is(
  (select row(fecha, planta, equipo, tecnico)::text from public.portal_ordenes()),
  '(2037-02-02,"Planta a",EQ-a,"Prueba tecnico")', 'con su fecha real, planta, equipo y técnico'
);
select is(
  (select row(j -> 'orden' ->> 'cliente', j -> 'orden' -> 'direccion' ->> 'municipio', j -> 'equipo' ->> 'identificador',
              j -> 'filas' -> 'orden' ->> 'observaciones', jsonb_array_length(j -> 'filas' -> 'firmas'),
              jsonb_array_length(j -> 'filas' -> 'actividades'))::text
   from public.portal_orden(pruebas.id('a_cerrada')) j),
  '("ZZ Portal a",Celaya,EQ-a,"Se cambió el filtro",2,1)', 'la abre con lo capturado y las dos firmas'
);
select ok(
  jsonb_array_length(public.portal_orden(pruebas.id('a_cerrada')) -> 'catalogos' -> 'actividades') >= 1,
  'trae el catálogo de actividades para dibujar las casillas'
);
select is(
  jsonb_array_length(public.portal_orden(pruebas.id('a_cerrada')) -> 'catalogos' -> 'partes'), 0,
  'del catálogo de partes solo vería las usadas'
);
select ok(public.portal_orden(pruebas.id('a_cerrada'))::text not like '%NOTA INTERNA%', 'sin las notas internas de la orden');
select is(public.portal_orden(pruebas.id('a_programada')), null, 'no abre una visita sin cerrar');
select is(public.portal_orden(pruebas.id('b_cerrada')), null, 'ni la visita de otra cuenta');
select is(
  (select count(*)::int from public.ordenes_servicio) + (select count(*)::int from public.os_firmas), 0,
  'no lee las tablas de órdenes ni de firmas'
);

select pruebas.entrar('cliente_b');
select is(
  (select planta from public.portal_ordenes()), 'Planta b', 'la otra cuenta ve solo la suya'
);
select pruebas.entrar('laboratorio');
select is((select count(*)::int from public.portal_ordenes()), 0, 'un usuario interno no obtiene nada por el portal');

select * from finish();
rollback;
