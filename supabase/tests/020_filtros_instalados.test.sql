-- Filtros instalados: un Robox no tiene dos filtros iguales a la vez; al cerrar
-- una orden que usó un filtro, el sistema anota el cambio.
begin;
select plan(20);

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

create table pruebas.d (clave text primary key, id uuid);
grant select on pruebas.d to authenticated;
with p as (insert into public.partes (nombre, tipo, es_filtro) values ('ZZ Filtro A', 'parte', true) returning id)
insert into pruebas.d select 'filtro_a', id from p;
with p as (insert into public.partes (nombre, tipo, es_filtro) values ('ZZ Filtro B', 'parte', true) returning id)
insert into pruebas.d select 'filtro_b', id from p;
with p as (insert into public.partes (nombre, tipo) values ('ZZ Manguera', 'parte') returning id)
insert into pruebas.d select 'manguera', id from p;
with r as (insert into public.robox (numero_serie) values ('ZZ-F1') returning id)
insert into pruebas.d select 'robox', id from r;
with o as (insert into public.ordenes_servicio (tipo, robox_id, tecnico_id, fecha_programada, estado, fecha_real)
  select 'taller', (select id from pruebas.d where clave = 'robox'), id, '2035-06-01', 'en_curso', '2035-06-02'
  from pruebas.u where rol = 'tecnico' returning id)
insert into pruebas.d select 'orden', id from o;

create function pruebas.id(p_clave text) returns uuid language sql stable as
  $$select id from pruebas.d where clave = p_clave$$;
grant execute on all functions in schema pruebas to authenticated;

select is(
  (select count(*)::int from public.partes where es_filtro and nombre like 'Filtro%'), 3,
  'los tres filtros del catálogo vienen marcados como filtro'
);

-- Registrar a mano ------------------------------------------------------------
select pruebas.entrar('tecnico');
select is(public.filtro_cambio_meses(), 6, 'el técnico conoce cada cuántos meses se cambia un filtro');
select lives_ok(
  $$insert into public.filtros_instalados (robox_id, parte_id, fecha_instalacion)
    values (pruebas.id('robox'), pruebas.id('filtro_a'), '2035-01-10')$$,
  'el técnico registra el filtro que tiene un Robox'
);
select throws_ok(
  $$insert into public.filtros_instalados (robox_id, parte_id, fecha_instalacion)
    values (pruebas.id('robox'), pruebas.id('filtro_a'), '2035-03-01')$$,
  '23505', null, 'un Robox no tiene dos filtros iguales instalados a la vez'
);
select lives_ok(
  $$insert into public.filtros_instalados (robox_id, parte_id, fecha_instalacion)
    values (pruebas.id('robox'), pruebas.id('filtro_b'), '2035-01-10')$$,
  'pero sí filtros de distinto tipo'
);
select throws_ok(
  $$insert into public.filtros_instalados (robox_id, parte_id, fecha_instalacion)
    values (pruebas.id('robox'), pruebas.id('manguera'), '2035-01-10')$$,
  'P0001', null, 'solo se da seguimiento a partes marcadas como filtro'
);
select throws_ok(
  $$update public.filtros_instalados set fecha_retiro = '2034-12-31'
    where robox_id = pruebas.id('robox') and parte_id = pruebas.id('filtro_b')$$,
  '23514', null, 'el retiro no puede ser anterior a la instalación'
);
select throws_ok(
  $$delete from public.filtros_instalados where robox_id = pruebas.id('robox')$$,
  '42501', null, 'los registros de filtros no se borran'
);

-- Cambio de filtro al cerrar la orden ---------------------------------------------
select public.guardar_captura_orden(pruebas.id('orden'), jsonb_build_object(
  'partes', jsonb_build_array(
    jsonb_build_object('id', pruebas.id('filtro_a'), 'cantidad', '1'),
    jsonb_build_object('id', pruebas.id('manguera'), 'cantidad', '2')),
  'firmas', jsonb_build_object('tecnico',
    jsonb_build_object('nombre', 'Prueba', 'trazos', '[[1,2,3,4]]'::jsonb))));
select is(
  (select count(*)::int from public.filtros_instalados where robox_id = pruebas.id('robox')), 2,
  'con la orden abierta no cambia nada'
);
update public.ordenes_servicio set estado = 'cerrada' where id = pruebas.id('orden');
select is(
  (select fecha_retiro from public.filtros_instalados
   where robox_id = pruebas.id('robox') and parte_id = pruebas.id('filtro_a') and fecha_instalacion = '2035-01-10'),
  date '2035-06-02', 'al cerrar la orden, el filtro anterior queda retirado en la fecha del servicio'
);
select is(
  (select row(fecha_instalacion, fecha_retiro, orden_id = pruebas.id('orden'))::text
   from public.filtros_instalados
   where robox_id = pruebas.id('robox') and parte_id = pruebas.id('filtro_a') and fecha_retiro is null),
  '(2035-06-02,,t)', 'y el nuevo queda instalado desde ese día, ligado a la orden'
);
select is(
  (select count(*)::int from public.filtros_instalados
   where robox_id = pruebas.id('robox') and parte_id = pruebas.id('filtro_b') and fecha_retiro is null),
  1, 'el filtro de otro tipo sigue instalado'
);
select is(
  (select count(*)::int from public.filtros_instalados where parte_id = pruebas.id('manguera')), 0,
  'una parte que no es filtro no genera registro'
);

-- Una orden sin Robox que usa un filtro no registra nada (no se sabe en cuál).
insert into public.ordenes_servicio (tipo, tecnico_id, fecha_programada, estado)
select 'taller', id, '2035-07-01', 'en_curso' from pruebas.u where rol = 'tecnico';
select public.guardar_captura_orden((select id from public.ordenes_servicio where fecha_programada = '2035-07-01'),
  jsonb_build_object(
    'partes', jsonb_build_array(jsonb_build_object('id', pruebas.id('filtro_b'), 'cantidad', '1')),
    'firmas', jsonb_build_object('tecnico', jsonb_build_object('nombre', 'Prueba', 'trazos', '[[1,2,3,4]]'::jsonb))));
update public.ordenes_servicio set estado = 'cerrada' where fecha_programada = '2035-07-01';
select is(
  (select count(*)::int from public.filtros_instalados where parte_id = pruebas.id('filtro_b')), 1,
  'una orden sin Robox no registra cambio de filtro'
);

-- Retirar a mano -------------------------------------------------------------------
with c as (
  update public.filtros_instalados set fecha_retiro = '2035-08-01'
  where robox_id = pruebas.id('robox') and parte_id = pruebas.id('filtro_b') returning 1
)
select is((select count(*)::int from c), 1, 'el técnico retira un filtro a mano');
select lives_ok(
  $$insert into public.filtros_instalados (robox_id, parte_id, fecha_instalacion)
    values (pruebas.id('robox'), pruebas.id('filtro_b'), '2035-08-01')$$,
  'y entonces puede registrar el nuevo'
);

-- Quién ve y quién edita --------------------------------------------------------------
select pruebas.entrar('administracion');
select cmp_ok(
  (select count(*)::int from public.filtros_instalados where robox_id = pruebas.id('robox')), '>=', 4,
  'administración consulta el historial de filtros'
);
select throws_ok(
  $$insert into public.filtros_instalados (robox_id, parte_id, fecha_instalacion)
    values (pruebas.id('robox'), pruebas.id('filtro_a'), '2036-01-01')$$,
  '42501', null, 'administración no registra filtros (es de quien edita la flota)'
);
select pruebas.entrar('cliente');
select is((select count(*)::int from public.filtros_instalados), 0, 'cliente no ve filtros');
select is(public.filtro_cambio_meses(), null, 'ni el parámetro');

select * from finish();
rollback;
