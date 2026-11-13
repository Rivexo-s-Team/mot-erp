-- Inventario: la existencia es la suma de los movimientos; las partes de una
-- orden salen al cerrarla; los movimientos no se editan ni se borran.
begin;
select plan(27);

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
with p as (insert into public.partes (nombre, tipo) values ('ZZ Filtro de prueba', 'parte') returning id)
insert into pruebas.d select 'filtro', id from p;
with p as (insert into public.partes (nombre, tipo) values ('ZZ O-ring de prueba', 'parte') returning id)
insert into pruebas.d select 'oring', id from p;
with o as (insert into public.ordenes_servicio (tipo, tecnico_id, fecha_programada, estado, fecha_real)
  select 'taller', id, '2034-03-01', 'en_curso', '2034-03-02' from pruebas.u where rol = 'tecnico' returning id)
insert into pruebas.d select 'orden', id from o;

create function pruebas.id(p_clave text) returns uuid language sql stable as
  $$select id from pruebas.d where clave = p_clave$$;
create function pruebas.existencia(p_clave text) returns numeric language sql stable as
  $$select existencia from public.inventario_existencias where parte_id = pruebas.id(p_clave)$$;
grant execute on all functions in schema pruebas to authenticated;

-- Movimientos y existencia -----------------------------------------------------
select pruebas.entrar('administracion');
select is(pruebas.existencia('filtro'), 0::numeric, 'una parte sin movimientos tiene existencia cero');
select lives_ok(
  $$insert into public.inventario_movimientos (parte_id, tipo, cantidad, fecha, referencia)
    values (pruebas.id('filtro'), 'entrada', 10, '2034-02-01', 'Factura SKF 123')$$,
  'administración registra una entrada'
);
select lives_ok(
  $$insert into public.inventario_movimientos (parte_id, tipo, cantidad)
    values (pruebas.id('filtro'), 'salida', -2)$$,
  'y una salida, con la fecha de hoy por defecto'
);
select is(pruebas.existencia('filtro'), 8::numeric, 'la existencia es la suma de los movimientos');
select throws_ok(
  $$insert into public.inventario_movimientos (parte_id, tipo, cantidad) values (pruebas.id('filtro'), 'entrada', -1)$$,
  '23514', null, 'una entrada no puede restar'
);
select throws_ok(
  $$insert into public.inventario_movimientos (parte_id, tipo, cantidad) values (pruebas.id('filtro'), 'salida', 3)$$,
  '23514', null, 'una salida no puede sumar'
);
select throws_ok(
  $$insert into public.inventario_movimientos (parte_id, tipo, cantidad) values (pruebas.id('filtro'), 'ajuste', 0)$$,
  '23514', null, 'un ajuste de cero no es un movimiento'
);
select throws_ok(
  $$insert into public.inventario_movimientos (parte_id, tipo, cantidad, orden_id)
    values (pruebas.id('filtro'), 'salida', -1, pruebas.id('orden'))$$,
  '42501', null, 'a mano no se atribuye un movimiento a una orden'
);
select throws_ok(
  $$update public.inventario_movimientos set cantidad = 99 where parte_id = pruebas.id('filtro')$$,
  '42501', null, 'los movimientos no se editan'
);
select throws_ok(
  $$delete from public.inventario_movimientos where parte_id = pruebas.id('filtro')$$,
  '42501', null, 'ni se borran'
);

-- Ajuste por conteo -----------------------------------------------------------------
select is(public.ajustar_existencia(pruebas.id('filtro'), 5, 'Conteo de marzo'), -3::numeric,
  'el ajuste registra la diferencia contra lo contado');
select is(pruebas.existencia('filtro'), 5::numeric, 'y la existencia queda en lo contado');
select is(public.ajustar_existencia(pruebas.id('filtro'), 5), 0::numeric, 'si ya coincide, la diferencia es cero');
select is(
  (select count(*)::int from public.inventario_movimientos where parte_id = pruebas.id('filtro') and tipo = 'ajuste'),
  1, 'y no registra un movimiento de más'
);
select throws_ok(
  $$select public.ajustar_existencia(pruebas.id('filtro'), -1)$$, '23514', null,
  'no se puede contar una existencia negativa'
);

-- Partes en la orden --------------------------------------------------------------
select pruebas.entrar('tecnico');
select lives_ok(
  $$select public.guardar_captura_orden(pruebas.id('orden'), jsonb_build_object('partes', jsonb_build_array(
      jsonb_build_object('id', pruebas.id('filtro'), 'cantidad', '1'),
      jsonb_build_object('id', pruebas.id('oring'), 'cantidad', '4'))))$$,
  'el técnico captura las partes usadas en su orden'
);
select public.guardar_captura_orden(pruebas.id('orden'), jsonb_build_object('partes', jsonb_build_array(
  jsonb_build_object('id', pruebas.id('filtro'), 'cantidad', '2'))));
select is(
  (select string_agg(cantidad::text, ',') from public.os_partes where orden_id = pruebas.id('orden')),
  '2', 'quitar una parte la borra y la cantidad se actualiza'
);
select public.guardar_captura_orden(pruebas.id('orden'), jsonb_build_object('observaciones', 'Sin tocar partes'));
select is(
  (select count(*)::int from public.os_partes where orden_id = pruebas.id('orden')), 1,
  'una captura que no trae partes no las borra'
);
select throws_ok(
  $$select public.guardar_captura_orden(pruebas.id('orden'), jsonb_build_object('partes', jsonb_build_array(
      jsonb_build_object('id', pruebas.id('filtro'), 'cantidad', '0'))))$$,
  '23514', null, 'la cantidad de una parte debe ser mayor que cero'
);
select is(pruebas.existencia('filtro'), 5::numeric, 'mientras la orden está abierta no sale nada del inventario');

-- Al cerrar, las partes salen del inventario.
select public.guardar_captura_orden(pruebas.id('orden'), jsonb_build_object(
  'partes', jsonb_build_array(
    jsonb_build_object('id', pruebas.id('filtro'), 'cantidad', '2'),
    jsonb_build_object('id', pruebas.id('oring'), 'cantidad', '4')),
  'firmas', jsonb_build_object('tecnico',
    jsonb_build_object('nombre', 'Prueba', 'trazos', '[[1,2,3,4]]'::jsonb))));
update public.ordenes_servicio set estado = 'cerrada' where id = pruebas.id('orden');
select is(pruebas.existencia('filtro'), 3::numeric, 'al cerrar la orden, sus partes salen del inventario');
select is(pruebas.existencia('oring'), -4::numeric,
  'si no había existencia registrada queda en negativo (no se bloquea el cierre)');
select is(
  (select row(tipo, cantidad, fecha, orden_id = pruebas.id('orden'), created_by = (select auth.uid()))::text
   from public.inventario_movimientos where parte_id = pruebas.id('filtro') and orden_id is not null),
  '(salida,-2,2034-03-02,t,t)', 'la salida lleva la fecha del servicio, la orden y quién la cerró'
);

-- Quién ve y quién registra ------------------------------------------------------
select lives_ok(
  $$insert into public.inventario_movimientos (parte_id, tipo, cantidad) values (pruebas.id('oring'), 'entrada', 20)$$,
  'técnico registra movimientos (tentativo)'
);
select pruebas.entrar('comercial');
select is(pruebas.existencia('oring'), 16::numeric, 'comercial consulta existencias');
select throws_ok(
  $$insert into public.inventario_movimientos (parte_id, tipo, cantidad) values (pruebas.id('oring'), 'entrada', 1)$$,
  '42501', null, 'comercial no registra movimientos'
);
select pruebas.entrar('cliente');
select is(
  (select count(*)::int from public.inventario_movimientos) + (select count(*)::int from public.os_partes)
  + (select count(*)::int from public.inventario_existencias), 0,
  'cliente no ve inventario ni partes de órdenes'
);

select * from finish();
rollback;
