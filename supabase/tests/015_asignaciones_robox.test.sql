-- Asignaciones, carrusel y movimientos: un Robox está en un solo lugar a la
-- vez, su estado sigue a la asignación y la ubicación se calcula.
begin;
select plan(27);

create schema pruebas;
grant usage on schema pruebas to authenticated;

create function pruebas.crear_usuario(p_rol text) returns uuid language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email)
  values (v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'prueba-' || v_id || '@mot.test');
  insert into public.perfiles (id, nombre, correo, rol_id)
  select v_id, 'Prueba ' || p_rol, 'prueba-' || v_id || '@mot.test', id
  from public.roles where clave = p_rol;
  return v_id;
end $$;

create table pruebas.u (rol text primary key, id uuid);
insert into pruebas.u select clave, pruebas.crear_usuario(clave) from public.roles;
grant select on pruebas.u to authenticated;

create function pruebas.entrar(p_rol text) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from pruebas.u where rol = p_rol), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- Una cuenta con dos plantas, un contrato por planta, tanques y dos Robox.
create table pruebas.d (clave text primary key, id uuid);
grant select, insert on pruebas.d to authenticated;
with c as (insert into public.cuentas (nombre) values ('ZZ Asignaciones') returning id)
insert into pruebas.d select 'cuenta', id from c;
with p as (insert into public.plantas (cuenta_id, nombre)
  select id, 'Planta 1' from pruebas.d where clave = 'cuenta' returning id)
insert into pruebas.d select 'planta_1', id from p;
with p as (insert into public.plantas (cuenta_id, nombre)
  select id, 'Planta 2' from pruebas.d where clave = 'cuenta' returning id)
insert into pruebas.d select 'planta_2', id from p;

create function pruebas.id(p_clave text) returns uuid language sql stable as
  $$select id from pruebas.d where clave = p_clave$$;
grant execute on all functions in schema pruebas to authenticated;

with k as (insert into public.contratos (cuenta_id, planta_id, tipo, estado)
  values (pruebas.id('cuenta'), pruebas.id('planta_1'), 'renta', 'vigente') returning id)
insert into pruebas.d select 'contrato_1', id from k;
with k as (insert into public.contratos (cuenta_id, planta_id, tipo, estado)
  values (pruebas.id('cuenta'), pruebas.id('planta_2'), 'renta', 'vigente') returning id)
insert into pruebas.d select 'contrato_2', id from k;
with e as (insert into public.equipos_cliente (planta_id, identificador)
  values (pruebas.id('planta_1'), 'T-1') returning id)
insert into pruebas.d select 'tanque_1', id from e;
with e as (insert into public.equipos_cliente (planta_id, identificador)
  values (pruebas.id('planta_1'), 'T-2') returning id)
insert into pruebas.d select 'tanque_2', id from e;
with e as (insert into public.equipos_cliente (planta_id, identificador)
  values (pruebas.id('planta_2'), 'T-9') returning id)
insert into pruebas.d select 'tanque_otra_planta', id from e;
with r as (insert into public.robox (numero_serie) values ('ZZ-A1') returning id)
insert into pruebas.d select 'robox_1', id from r;
with r as (insert into public.robox (numero_serie, estado) values ('ZZ-A2', 'baja') returning id)
insert into pruebas.d select 'robox_baja', id from r;

-- Asignar ---------------------------------------------------------------------
select pruebas.entrar('tecnico');
select lives_ok(
  $$insert into public.asignaciones_robox (robox_id, contrato_id, planta_id, fecha_inicio)
    values (pruebas.id('robox_1'), pruebas.id('contrato_1'), pruebas.id('planta_1'), '2026-01-10')$$,
  'técnico asigna un Robox a un contrato'
);
insert into pruebas.d
select 'asignacion_1', id from public.asignaciones_robox where robox_id = pruebas.id('robox_1');
select is(
  (select estado from public.robox where id = pruebas.id('robox_1')), 'en_cliente',
  'al asignarlo, el Robox queda en cliente'
);
select throws_ok(
  $$insert into public.asignaciones_robox (robox_id, contrato_id, planta_id, fecha_inicio)
    values (pruebas.id('robox_1'), pruebas.id('contrato_2'), pruebas.id('planta_2'), '2026-03-01')$$,
  '23P01', null, 'un Robox no puede estar en dos contratos a la vez'
);
select throws_ok(
  $$insert into public.asignaciones_robox (robox_id, contrato_id, planta_id, fecha_inicio, fecha_fin)
    values (pruebas.id('robox_1'), pruebas.id('contrato_1'), pruebas.id('planta_2'), '2025-01-01', '2025-02-01')$$,
  '23503', null, 'la planta de la asignación es la del contrato'
);
select throws_ok(
  $$insert into public.asignaciones_robox (robox_id, contrato_id, planta_id, fecha_inicio)
    values (pruebas.id('robox_baja'), pruebas.id('contrato_2'), pruebas.id('planta_2'), '2026-01-01')$$,
  'P0001', null, 'no se asigna un Robox dado de baja'
);
select throws_ok(
  $$update public.robox set estado = 'disponible' where id = pruebas.id('robox_1')$$,
  'P0001', null, 'un Robox asignado no se marca disponible a mano'
);
select throws_ok(
  $$update public.robox set deleted_at = now() where id = pruebas.id('robox_1')$$,
  'P0001', null, 'un Robox asignado no se elimina'
);
select lives_ok(
  $$update public.robox set estado = 'en_taller' where id = pruebas.id('robox_1')$$,
  'un Robox asignado sí puede pasar a taller'
);

-- Carrusel y movimientos ------------------------------------------------------
select is(
  (select equipo_cliente_id from public.robox_ubicacion where robox_id = pruebas.id('robox_1')), null,
  'sin carrusel ni movimientos no hay tanque actual'
);
select lives_ok(
  $$insert into public.carrusel_equipos (asignacion_id, planta_id, equipo_cliente_id, orden, id_caso)
    values (pruebas.id('asignacion_1'), pruebas.id('planta_1'), pruebas.id('tanque_1'), 1, 'ZZ1-01')$$,
  'técnico agrega un tanque al carrusel'
);
select is(
  (select equipo_cliente_id from public.robox_ubicacion where robox_id = pruebas.id('robox_1')),
  pruebas.id('tanque_1'), 'con un solo tanque en el carrusel, ese es el tanque actual'
);
select throws_ok(
  $$insert into public.carrusel_equipos (asignacion_id, planta_id, equipo_cliente_id)
    values (pruebas.id('asignacion_1'), pruebas.id('planta_1'), pruebas.id('tanque_1'))$$,
  '23505', null, 'un tanque no se repite en el carrusel'
);
select throws_ok(
  $$insert into public.carrusel_equipos (asignacion_id, planta_id, equipo_cliente_id)
    values (pruebas.id('asignacion_1'), pruebas.id('planta_1'), pruebas.id('tanque_otra_planta'))$$,
  '23503', null, 'el carrusel solo admite tanques de la planta de la asignación'
);
insert into public.carrusel_equipos (asignacion_id, planta_id, equipo_cliente_id, orden)
values (pruebas.id('asignacion_1'), pruebas.id('planta_1'), pruebas.id('tanque_2'), 2);
select is(
  (select equipo_cliente_id from public.robox_ubicacion where robox_id = pruebas.id('robox_1')), null,
  'con dos tanques y sin movimientos, el tanque actual queda sin definir'
);
select lives_ok(
  $$insert into public.movimientos_robox (asignacion_id, planta_id, fecha, equipo_destino_id, movido_por)
    values (pruebas.id('asignacion_1'), pruebas.id('planta_1'), '2026-01-10', pruebas.id('tanque_1'), 'mot'),
           (pruebas.id('asignacion_1'), pruebas.id('planta_1'), '2026-02-10', pruebas.id('tanque_2'), 'cliente')$$,
  'se registran la instalación y una rotación'
);
update public.movimientos_robox set equipo_origen_id = pruebas.id('tanque_1') where fecha = '2026-02-10'
  and asignacion_id = pruebas.id('asignacion_1');
select is(
  (select equipo_cliente_id from public.robox_ubicacion where robox_id = pruebas.id('robox_1')),
  pruebas.id('tanque_2'), 'el tanque actual es el destino del último movimiento'
);
select throws_ok(
  $$insert into public.movimientos_robox (asignacion_id, planta_id, fecha, equipo_origen_id, equipo_destino_id, movido_por)
    values (pruebas.id('asignacion_1'), pruebas.id('planta_1'), '2026-03-01', pruebas.id('tanque_2'), pruebas.id('tanque_2'), 'mot')$$,
  '23514', null, 'un movimiento va de un tanque a otro distinto'
);
select throws_ok(
  $$insert into public.movimientos_robox (asignacion_id, planta_id, fecha, equipo_destino_id, movido_por)
    values (pruebas.id('asignacion_1'), pruebas.id('planta_1'), '2026-03-01', pruebas.id('tanque_1'), 'vecino')$$,
  '23514', null, 'lo mueve MOT o el cliente'
);
select throws_ok(
  $$delete from public.movimientos_robox where asignacion_id = pruebas.id('asignacion_1')$$,
  '42501', null, 'los movimientos no se borran'
);

-- Terminar la asignación --------------------------------------------------------
update public.robox set estado = 'en_cliente' where id = pruebas.id('robox_1');
with c as (
  update public.asignaciones_robox set fecha_fin = '2026-06-30'
  where id = pruebas.id('asignacion_1') returning 1
)
select is((select count(*)::int from c), 1, 'técnico termina la asignación');
select is(
  (select estado from public.robox where id = pruebas.id('robox_1')), 'disponible',
  'al terminar, el Robox vuelve a estar disponible'
);
select is(
  (select count(*)::int from public.robox_ubicacion where robox_id = pruebas.id('robox_1')), 0,
  'un Robox sin asignación activa no tiene ubicación'
);
select lives_ok(
  $$insert into public.asignaciones_robox (robox_id, contrato_id, planta_id, fecha_inicio)
    values (pruebas.id('robox_1'), pruebas.id('contrato_2'), pruebas.id('planta_2'), '2026-06-30')$$,
  'el mismo día que termina puede iniciar otra asignación'
);

-- Quién ve y quién edita ------------------------------------------------------
select pruebas.entrar('administracion');
select is(
  (select count(*)::int from public.asignaciones_robox where robox_id = pruebas.id('robox_1')), 2,
  'administración consulta las asignaciones'
);
select throws_ok(
  $$insert into public.movimientos_robox (asignacion_id, planta_id, fecha, equipo_destino_id, movido_por)
    values (pruebas.id('asignacion_1'), pruebas.id('planta_1'), '2026-03-05', pruebas.id('tanque_1'), 'mot')$$,
  '42501', null, 'administración no registra movimientos'
);
with c as (
  update public.asignaciones_robox set notas = 'x' where robox_id = pruebas.id('robox_1') returning 1
)
select is((select count(*)::int from c), 0, 'administración no edita asignaciones');

select pruebas.entrar('cliente');
select is(
  (select count(*)::int from public.asignaciones_robox)
  + (select count(*)::int from public.carrusel_equipos)
  + (select count(*)::int from public.movimientos_robox)
  + (select count(*)::int from public.robox_ubicacion), 0,
  'cliente no ve asignaciones, carrusel, movimientos ni ubicación'
);

select * from finish();
rollback;
