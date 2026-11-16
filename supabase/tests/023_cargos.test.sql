-- Cargos por facturar: nacen al cerrar una orden por evento (litros × tarifa)
-- o se capturan a mano; son importes y solo los ve quien ve precios.
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
with c as (insert into public.cuentas (nombre) values ('ZZ Cargos') returning id)
insert into pruebas.d select 'cuenta', id from c;
with c as (insert into public.cuentas (nombre) values ('ZZ Cargos otra') returning id)
insert into pruebas.d select 'cuenta_otra', id from c;
with p as (insert into public.plantas (cuenta_id, nombre) values (pruebas.id('cuenta'), 'Planta') returning id)
insert into pruebas.d select 'planta', id from p;
with e as (insert into public.equipos_cliente (planta_id, identificador, volumen_reservorio_l)
  values (pruebas.id('planta'), 'T-1', 2000) returning id)
insert into pruebas.d select 'equipo', id from e;
with e as (insert into public.equipos_cliente (planta_id, identificador)
  values (pruebas.id('planta'), 'T-2') returning id)
insert into pruebas.d select 'equipo_sin_volumen', id from e;
with k as (insert into public.contratos (cuenta_id, planta_id, tipo, estado, moneda)
  values (pruebas.id('cuenta'), pruebas.id('planta'), 'por_evento', 'vigente', 'USD') returning id)
insert into pruebas.d select 'evento', id from k;
with k as (insert into public.contratos (cuenta_id, planta_id, tipo, estado)
  values (pruebas.id('cuenta'), pruebas.id('planta'), 'renta', 'vigente') returning id)
insert into pruebas.d select 'renta', id from k;
with k as (insert into public.contratos (cuenta_id, planta_id, tipo, estado)
  values (pruebas.id('cuenta'), pruebas.id('planta'), 'por_evento', 'vigente') returning id)
insert into pruebas.d select 'evento_sin_tarifa', id from k;
insert into public.contrato_tarifas (contrato_id, planta_id, concepto, unidad, precio, equipo_cliente_id, orden)
values (pruebas.id('evento'), pruebas.id('planta'), 'Limpieza por litro', 'litro', 3.75, null, 1),
       (pruebas.id('evento'), pruebas.id('planta'), 'Visita', 'servicio', 500, null, 2),
       (pruebas.id('renta'), pruebas.id('planta'), 'Renta', 'mes', 300, null, 1);

-- Crea una orden en curso, firmada, lista para cerrar.
create function pruebas.orden(p_clave text, p_contrato text, p_equipo text, p_volumen numeric default null)
returns void language plpgsql as $$
declare v_id uuid;
begin
  insert into public.ordenes_servicio
    (tipo, cuenta_id, planta_id, contrato_id, equipo_cliente_id, tecnico_id, fecha_programada, estado, volumen_reservorio_l)
  values ('visita', pruebas.id('cuenta'), pruebas.id('planta'), pruebas.id(p_contrato), pruebas.id(p_equipo),
          pruebas.uid('tecnico'), '2037-04-01', 'en_curso', p_volumen)
  returning id into v_id;
  insert into public.os_firmas (orden_id, rol, nombre, trazos)
  select v_id, r, 'Prueba', '[[1,2,3,4]]'::jsonb from unnest(array['tecnico', 'cliente']) r;
  insert into pruebas.d values (p_clave, v_id);
end $$;
select pruebas.orden('o_evento', 'evento', 'equipo');
select pruebas.orden('o_evento_medido', 'evento', 'equipo', 1850.5);
select pruebas.orden('o_renta', 'renta', 'equipo');
select pruebas.orden('o_sin_volumen', 'evento', 'equipo_sin_volumen');
select pruebas.orden('o_sin_tarifa', 'evento_sin_tarifa', 'equipo');
grant execute on all functions in schema pruebas to authenticated;

-- Cargo automático al cerrar ----------------------------------------------------
select pruebas.entrar('tecnico');
update public.ordenes_servicio set estado = 'cerrada' where id = pruebas.id('o_evento');
select is((select count(*)::int from public.cargos), 0, 'el técnico cierra la orden pero no ve cargos');

select pruebas.entrar('administracion');
select is(
  (select row(tipo, cantidad, unidad, precio_unitario, importe, moneda, estado,
              cuenta_id = pruebas.id('cuenta'), contrato_id = pruebas.id('evento'))::text
   from public.cargos where orden_id = pruebas.id('o_evento')),
  '(evento_litro,2000,litro,3.75,7500.00,USD,pendiente,t,t)',
  'al cerrar una orden por evento nace el cargo: reservorio × tarifa por litro'
);
select matches(
  (select concepto from public.cargos where orden_id = pruebas.id('o_evento')),
  '^Limpieza de aceite por evento, orden 370401 P. ?.*, equipo T-1$',
  'el concepto dice la orden y el equipo'
);
select is(
  (select created_by from public.cargos where orden_id = pruebas.id('o_evento')), pruebas.uid('tecnico'),
  'queda anotado quién cerró la orden'
);

select pruebas.entrar('tecnico');
update public.ordenes_servicio set estado = 'cerrada' where id = pruebas.id('o_evento_medido');
update public.ordenes_servicio set estado = 'cerrada' where id = pruebas.id('o_renta');
update public.ordenes_servicio set estado = 'cerrada' where id = pruebas.id('o_sin_volumen');
update public.ordenes_servicio set estado = 'cerrada' where id = pruebas.id('o_sin_tarifa');
select pruebas.entrar('administracion');
select is(
  (select row(cantidad, importe)::text from public.cargos where orden_id = pruebas.id('o_evento_medido')),
  '(1850.5,6939.38)', 'si en la visita se anotó el volumen, se cobra ese (redondeado a centavos)'
);
select is(
  (select count(*)::int from public.cargos where orden_id = pruebas.id('o_renta')), 0,
  'una orden de un contrato de renta no genera cargo'
);
select is(
  (select row(cantidad, precio_unitario, importe, notas)::text from public.cargos
   where orden_id = pruebas.id('o_sin_volumen')),
  '(,3.75,,"Generado al cerrar la orden. Falta el volumen del reservorio.")',
  'sin volumen, el cargo nace por completar y dice qué falta'
);
select is(
  (select row(cantidad, precio_unitario, importe)::text from public.cargos
   where orden_id = pruebas.id('o_sin_tarifa')),
  '(2000,,)', 'sin tarifa por litro, también nace por completar'
);

-- Tarifa propia del equipo le gana a la general.
insert into public.contrato_tarifas (contrato_id, planta_id, concepto, unidad, precio, equipo_cliente_id, orden)
values (pruebas.id('evento'), pruebas.id('planta'), 'Litro especial T-1', 'litro', 4.10, pruebas.id('equipo'), 9);
select set_config('role', 'postgres', true);
select pruebas.orden('o_tarifa_equipo', 'evento', 'equipo');
select pruebas.entrar('direccion');
update public.ordenes_servicio set estado = 'cerrada' where id = pruebas.id('o_tarifa_equipo');
select is(
  (select precio_unitario from public.cargos where orden_id = pruebas.id('o_tarifa_equipo')), 4.10::numeric,
  'la tarifa por litro propia del equipo manda sobre la general'
);

-- Corregir y capturar a mano --------------------------------------------------------
select pruebas.entrar('administracion');
with c as (update public.cargos set cantidad = 1900 where orden_id = pruebas.id('o_sin_volumen') returning importe)
select is((select importe from c), 7125.00::numeric, 'administración completa el cargo y el importe se calcula solo');
select throws_ok(
  $$update public.cargos set importe = 1 where orden_id = pruebas.id('o_evento')$$,
  '428C9', null, 'el importe no se escribe a mano'
);
select lives_ok(
  $$insert into public.cargos (cuenta_id, orden_id, tipo, concepto, cantidad, unidad, precio_unitario, moneda)
    values (pruebas.id('cuenta'), pruebas.id('o_evento'), 'partes_mal_uso', 'Bomba dañada por el cliente', 1, 'pieza', 850, 'USD')$$,
  'administración captura un cargo por partes dañadas'
);
select throws_ok(
  $$insert into public.cargos (cuenta_id, orden_id, tipo, concepto, cantidad, precio_unitario)
    values (pruebas.id('cuenta'), pruebas.id('o_evento'), 'evento_litro', 'Duplicado', 1, 1)$$,
  '23505', null, 'una orden no tiene dos cargos por litros'
);
select throws_ok(
  $$insert into public.cargos (cuenta_id, contrato_id, tipo, concepto, cantidad, precio_unitario)
    values (pruebas.id('cuenta_otra'), pruebas.id('evento'), 'otro', 'Mezcla', 1, 1)$$,
  '23503', null, 'el contrato del cargo debe ser del mismo cliente'
);
select throws_ok(
  $$insert into public.cargos (cuenta_id, tipo, concepto, cantidad, precio_unitario)
    values (pruebas.id('cuenta'), 'otro', 'Negativo', 1, -5)$$,
  '23514', null, 'el precio no puede ser negativo'
);
select throws_ok(
  $$insert into public.cargos (cuenta_id, tipo, concepto, cantidad, precio_unitario)
    values (pruebas.id('cuenta'), 'renta_mensual', 'Renta', 1, 300)$$,
  '23514', null, 'las rentas mensuales no se capturan aquí (llegan con la facturación)'
);
with c as (update public.cargos set estado = 'cancelado' where orden_id = pruebas.id('o_sin_tarifa') returning 1)
select is((select count(*)::int from c), 1, 'administración cancela un cargo');
select throws_ok(
  $$delete from public.cargos where orden_id = pruebas.id('o_evento')$$, '42501', null,
  'los cargos no se borran'
);

-- Bitácora y permisos --------------------------------------------------------------
select pruebas.entrar('direccion');
select cmp_ok(
  (select count(*)::int from public.bitacora where tabla = 'cargos'), '>=', 7,
  'altas y cambios de cargos quedan en la bitácora'
);
select pruebas.entrar('comercial');
select cmp_ok((select count(*)::int from public.cargos), '>=', 5, 'comercial consulta los cargos');
with c as (update public.cargos set notas = 'x' returning 1)
select is((select count(*)::int from c), 0, 'comercial no los cambia');
select throws_ok(
  $$insert into public.cargos (cuenta_id, tipo, concepto, cantidad, precio_unitario)
    values (pruebas.id('cuenta'), 'otro', 'X', 1, 1)$$,
  '42501', null, 'ni los captura'
);
select pruebas.entrar('laboratorio');
select is((select count(*)::int from public.cargos), 0, 'laboratorio no ve cargos');
select pruebas.entrar('cliente');
select is((select count(*)::int from public.cargos), 0, 'cliente no ve cargos');

select * from finish();
rollback;
