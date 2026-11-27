-- Correcciones de la revisión de código: lo que no se puede dar de alta ya "hecho" y la renta del mes de un contrato terminado.
begin;
select plan(11);

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

with c as (insert into public.cuentas (nombre) values ('ZZ Revisión') returning id)
insert into pruebas.d select 'cuenta', id from c;
with p as (insert into public.plantas (cuenta_id, nombre) values (pruebas.id('cuenta'), 'Planta R') returning id)
insert into pruebas.d select 'planta', id from p;
with r as (insert into public.razones_sociales (cuenta_id, razon_social, rfc)
  values (pruebas.id('cuenta'), 'ZZ Revisión SA de CV', 'ZZR010101AAA') returning id)
insert into pruebas.d select 'razon', id from r;

-- Órdenes ------------------------------------------------------------------------------
select pruebas.entrar('tecnico');
select throws_ok(
  $$insert into public.ordenes_servicio (tipo, cuenta_id, planta_id, tecnico_id, fecha_programada, estado)
    values ('visita', pruebas.id('cuenta'), pruebas.id('planta'), pruebas.uid('tecnico'), '2037-02-01', 'cerrada')$$,
  'P0001', null, 'una orden no se da de alta ya cerrada'
);
select lives_ok(
  $$insert into public.ordenes_servicio (tipo, cuenta_id, planta_id, tecnico_id, fecha_programada, fecha_cierre)
    values ('visita', pruebas.id('cuenta'), pruebas.id('planta'), pruebas.uid('tecnico'), '2037-02-01', now())$$,
  'programada sí se da de alta'
);
select is(
  (select row(estado, fecha_cierre)::text from public.ordenes_servicio where cuenta_id = pruebas.id('cuenta')),
  '(programada,)', 'y nace sin fecha de cierre'
);

-- Facturas y cargos ----------------------------------------------------------------------
select pruebas.entrar('administracion');
insert into public.facturas (cuenta_id, razon_social_id, moneda, estado, folio, uuid_fiscal, timbrado, emitida_at, xml_ruta, es_anticipo)
values (pruebas.id('cuenta'), pruebas.id('razon'), 'USD', 'emitida', 'ZZ-1', gen_random_uuid(), 'manual', now(), 'otra/factura.xml', true);
select is(
  (select row(estado, uuid_fiscal, timbrado, emitida_at, xml_ruta, es_anticipo)::text
   from public.facturas where cuenta_id = pruebas.id('cuenta')),
  '(borrador,,,,,f)', 'una factura insertada como emitida nace en borrador y sin datos de emisión'
);
update public.facturas set deleted_at = now() where cuenta_id = pruebas.id('cuenta');
select throws_ok(
  $$update public.facturas set deleted_at = null where cuenta_id = pruebas.id('cuenta')$$,
  'P0001', null, 'una factura eliminada no se recupera'
);
select throws_ok(
  $$insert into public.cargos (cuenta_id, tipo, concepto, cantidad, unidad, precio_unitario, moneda, estado)
    values (pruebas.id('cuenta'), 'servicio', 'Trampa', 1, 'servicio', 10, 'USD', 'facturado')$$,
  'P0001', null, 'un cargo no se da de alta ya facturado'
);
select lives_ok(
  $$insert into public.cargos (cuenta_id, tipo, concepto, cantidad, unidad, precio_unitario, moneda)
    values (pruebas.id('cuenta'), 'servicio', 'Normal', 1, 'servicio', 10, 'USD')$$,
  'pendiente sí'
);

-- Rentas del mes de un contrato que se terminó después ------------------------------------
select pruebas.entrar('direccion');
with k as (insert into public.contratos (cuenta_id, planta_id, tipo, estado, fecha_inicio, fecha_termino, moneda)
  values (pruebas.id('cuenta'), pruebas.id('planta'), 'renta', 'vigente', '2036-01-01', '2037-03-31', 'USD') returning id)
insert into pruebas.d select 'contrato', id from k;
insert into public.contrato_tarifas (contrato_id, planta_id, concepto, unidad, precio)
values (pruebas.id('contrato'), pruebas.id('planta'), 'Renta Robox', 'mes', 300);
update public.contratos set estado = 'terminado' where id = pruebas.id('contrato');
select is(
  (select count(*)::int from public.rentas_del_mes('2037-03-01') where contrato_id = pruebas.id('contrato')), 1,
  'el contrato terminado todavía debe la renta de su último mes'
);
select is(
  (select count(*)::int from public.rentas_del_mes('2037-04-01') where contrato_id = pruebas.id('contrato')), 0,
  'pero no la de los meses posteriores a su término'
);
update public.contratos set fecha_termino = null where id = pruebas.id('contrato');
select is(
  (select count(*)::int from public.rentas_del_mes('2037-03-01') where contrato_id = pruebas.id('contrato')), 0,
  'terminado y sin fecha de término no genera: no se sabe hasta cuándo sirvió'
);
select pruebas.entrar('administracion');
update public.contratos set estado = 'terminado' where false;
select is(
  (select public.generar_rentas_mes('2037-03-01')), 0, 'y generar el mes no crea nada para él'
);

select * from finish();
rollback;
