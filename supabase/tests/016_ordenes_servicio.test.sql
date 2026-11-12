-- Órdenes de servicio: folio automático, el técnico solo edita las suyas y
-- una orden cerrada ya no cambia.
begin;
select plan(24);

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
insert into pruebas.u select clave, pruebas.crear_usuario(clave, 'Prueba ' || clave) from public.roles
where clave <> 'tecnico';
insert into pruebas.u values
  ('tecnico', pruebas.crear_usuario('tecnico', 'Daniel Vargas Reséndiz')),
  ('tecnico_2', pruebas.crear_usuario('tecnico', 'Zoe Quintero'));
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
with c as (insert into public.cuentas (nombre) values ('ZZ Órdenes A') returning id)
insert into pruebas.d select 'cuenta_a', id from c;
with c as (insert into public.cuentas (nombre) values ('ZZ Órdenes B') returning id)
insert into pruebas.d select 'cuenta_b', id from c;
create function pruebas.id(p_clave text) returns uuid language sql stable as
  $$select id from pruebas.d where clave = p_clave$$;
with p as (insert into public.plantas (cuenta_id, nombre) values (pruebas.id('cuenta_a'), 'Planta A') returning id)
insert into pruebas.d select 'planta_a', id from p;
with p as (insert into public.plantas (cuenta_id, nombre) values (pruebas.id('cuenta_b'), 'Planta B') returning id)
insert into pruebas.d select 'planta_b', id from p;
with e as (insert into public.equipos_cliente (planta_id, identificador) values (pruebas.id('planta_b'), 'EQ-B') returning id)
insert into pruebas.d select 'equipo_b', id from e;
grant execute on all functions in schema pruebas to authenticated;

-- Crear y folio -----------------------------------------------------------------
select pruebas.entrar('tecnico');
select lives_ok(
  $$insert into public.ordenes_servicio (tipo, cuenta_id, planta_id, tecnico_id, fecha_programada)
    values ('visita', pruebas.id('cuenta_a'), pruebas.id('planta_a'), pruebas.uid('tecnico'), '2031-11-02')$$,
  'un técnico crea una orden a su nombre'
);
select is(
  (select folio from public.ordenes_servicio where tecnico_id = pruebas.uid('tecnico')),
  '311102 DV', 'el folio es la fecha programada más las iniciales del técnico'
);
insert into public.ordenes_servicio (tipo, cuenta_id, planta_id, tecnico_id, fecha_programada)
values ('visita', pruebas.id('cuenta_a'), pruebas.id('planta_a'), pruebas.uid('tecnico'), '2031-11-02');
select is(
  (select count(*)::int from public.ordenes_servicio where folio = '311102 DV 2'), 1,
  'la segunda orden del mismo técnico y día lleva consecutivo'
);
select lives_ok(
  $$insert into public.ordenes_servicio (tipo, tecnico_id, fecha_programada)
    values ('taller', pruebas.uid('tecnico'), '2031-11-03')$$,
  'una orden de taller no necesita cliente'
);
select throws_ok(
  $$insert into public.ordenes_servicio (tipo, tecnico_id, fecha_programada)
    values ('visita', pruebas.uid('tecnico'), '2031-11-03')$$,
  '23514', null, 'una visita necesita cliente y planta'
);
select throws_ok(
  $$insert into public.ordenes_servicio (tipo, cuenta_id, planta_id, tecnico_id, fecha_programada)
    values ('visita', pruebas.id('cuenta_a'), pruebas.id('planta_b'), pruebas.uid('tecnico'), '2031-11-03')$$,
  '23503', null, 'la planta debe ser del cliente'
);
select throws_ok(
  $$insert into public.ordenes_servicio (tipo, cuenta_id, planta_id, equipo_cliente_id, tecnico_id, fecha_programada)
    values ('visita', pruebas.id('cuenta_a'), pruebas.id('planta_a'), pruebas.id('equipo_b'), pruebas.uid('tecnico'), '2031-11-03')$$,
  '23503', null, 'el equipo debe ser de la planta'
);
select throws_ok(
  $$insert into public.ordenes_servicio (tipo, cuenta_id, planta_id, tecnico_id, acompanante_id, fecha_programada)
    values ('visita', pruebas.id('cuenta_a'), pruebas.id('planta_a'), pruebas.uid('tecnico'), pruebas.uid('tecnico'), '2031-11-03')$$,
  '23514', null, 'el acompañante no puede ser el mismo técnico'
);
select throws_ok(
  $$insert into public.ordenes_servicio (tipo, tecnico_id, fecha_programada)
    values ('taller', pruebas.uid('tecnico_2'), '2031-11-03')$$,
  '42501', null, 'un técnico no crea órdenes a nombre de otro'
);

-- Editar: solo las propias ------------------------------------------------------
with c as (update public.ordenes_servicio set estado = 'en_curso', fecha_real = '2031-11-02'
           where folio = '311102 DV' returning 1)
select is((select count(*)::int from c), 1, 'el técnico inicia su orden');
update public.ordenes_servicio set folio = 'OTRO' where folio = '311102 DV 2';
select is(
  (select count(*)::int from public.ordenes_servicio where folio = '311102 DV 2'), 1,
  'el folio no se puede cambiar'
);

select pruebas.entrar('tecnico_2');
select is(
  (select count(*)::int from public.ordenes_servicio where tecnico_id = pruebas.uid('tecnico')), 3,
  'otro técnico ve las órdenes'
);
with c as (update public.ordenes_servicio set notas = 'x' where folio = '311102 DV' returning 1)
select is((select count(*)::int from c), 0, 'pero no edita las que no son suyas');

select pruebas.entrar('direccion');
with c as (update public.ordenes_servicio set acompanante_id = pruebas.uid('tecnico_2')
           where folio = '311102 DV' returning 1)
select is((select count(*)::int from c), 1, 'dirección edita cualquier orden');
select lives_ok(
  $$insert into public.ordenes_servicio (tipo, tecnico_id, fecha_programada)
    values ('taller', pruebas.uid('tecnico_2'), '2031-11-05')$$,
  'dirección crea órdenes a nombre de un técnico'
);
select is(
  (select folio from public.ordenes_servicio where fecha_programada = '2031-11-05'), '311105 ZQ',
  'el folio usa las iniciales del técnico asignado, no de quien la captura'
);

select pruebas.entrar('tecnico_2');
with c as (update public.ordenes_servicio set notas = 'Apoyo en la visita' where folio = '311102 DV' returning 1)
select is((select count(*)::int from c), 1, 'el acompañante sí puede editar la orden');

-- Cerrada: ya no cambia -----------------------------------------------------------
select pruebas.entrar('tecnico');
update public.ordenes_servicio set estado = 'cerrada' where folio = '311102 DV';
select throws_ok(
  $$update public.ordenes_servicio set notas = 'cambio' where folio = '311102 DV'$$,
  'P0001', null, 'una orden cerrada ya no se edita'
);
select pruebas.entrar('direccion');
select throws_ok(
  $$update public.ordenes_servicio set estado = 'en_curso' where folio = '311102 DV'$$,
  'P0001', null, 'ni Dirección reabre una orden cerrada'
);
select throws_ok(
  $$delete from public.ordenes_servicio where folio = '311102 DV 2'$$, '42501', null,
  'las órdenes no se borran'
);

-- Quién ve ---------------------------------------------------------------------
select pruebas.entrar('administracion');
select cmp_ok((select count(*)::int from public.ordenes_servicio), '>=', 4, 'administración consulta las órdenes');
select throws_ok(
  $$insert into public.ordenes_servicio (tipo, tecnico_id, fecha_programada)
    values ('taller', pruebas.uid('administracion'), '2031-11-06')$$,
  '42501', null, 'administración no crea órdenes'
);
select cmp_ok(
  (select count(*)::int from public.directorio_tecnicos() where asignable), '>=', 3,
  'el directorio lista a quienes pueden llevar una orden'
);
select pruebas.entrar('cliente');
select is(
  (select count(*)::int from public.ordenes_servicio) + (select count(*)::int from public.directorio_tecnicos()), 0,
  'cliente no ve órdenes ni el directorio'
);

select * from finish();
rollback;
