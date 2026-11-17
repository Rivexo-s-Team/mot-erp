-- Facturas en borrador: se arman con cargos pendientes de una cuenta y
-- moneda; el cargo queda tomado y la base calcula importes e IVA.
begin;
select plan(36);

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
with c as (insert into public.cuentas (nombre) values ('ZZ Facturas') returning id)
insert into pruebas.d select 'cuenta', id from c;
with c as (insert into public.cuentas (nombre) values ('ZZ Facturas otra') returning id)
insert into pruebas.d select 'cuenta_otra', id from c;
with r as (insert into public.razones_sociales (cuenta_id, razon_social, rfc, uso_cfdi)
  values (pruebas.id('cuenta'), 'ZZ SA de CV', 'ZZZ010101AAA', 'G03') returning id)
insert into pruebas.d select 'razon', id from r;
with r as (insert into public.razones_sociales (cuenta_id, razon_social, rfc)
  values (pruebas.id('cuenta'), 'ZZ Sin Crédito SA', 'ZZZ020202BBB') returning id)
insert into pruebas.d select 'razon_sin', id from r;
insert into public.condiciones_credito (razon_social_id, cuenta_id, dias_credito, metodo_pago, forma_pago)
values (pruebas.id('razon'), pruebas.id('cuenta'), 30, 'PPD', '99');
with p as (insert into public.plantas (cuenta_id, nombre) values (pruebas.id('cuenta'), 'Planta') returning id)
insert into pruebas.d select 'planta', id from p;
with k as (insert into public.contratos (cuenta_id, planta_id, tipo, estado)
  values (pruebas.id('cuenta'), pruebas.id('planta'), 'servicio', 'vigente') returning id)
insert into pruebas.d select 'contrato', id from k;
with o as (insert into public.ordenes_compra (contrato_id, numero) values (pruebas.id('contrato'), 'OC-77') returning id)
insert into pruebas.d select 'oc', id from o;

create function pruebas.cargo(p_clave text, p_cuenta text, p_cantidad numeric, p_precio numeric,
                              p_moneda text default 'USD', p_oc text default null)
returns void language plpgsql as $$
declare v_id uuid;
begin
  insert into public.cargos (cuenta_id, tipo, concepto, cantidad, unidad, precio_unitario, moneda, orden_compra_id)
  values (pruebas.id(p_cuenta), 'servicio', 'Cargo ' || p_clave, p_cantidad, 'servicio', p_precio, p_moneda, pruebas.id(p_oc))
  returning id into v_id;
  insert into pruebas.d values (p_clave, v_id);
end $$;
select pruebas.cargo('a', 'cuenta', 3, 289.99, 'USD', 'oc');
select pruebas.cargo('b', 'cuenta', 1, 0.05, 'USD', 'oc');
select pruebas.cargo('c', 'cuenta', 1, 100);
select pruebas.cargo('pesos', 'cuenta', 1, 1000, 'MXN');
select pruebas.cargo('incompleto', 'cuenta', 1, null);
select pruebas.cargo('otro', 'cuenta_otra', 1, 50);
select pruebas.cargo('cancelado', 'cuenta', 1, 50);
update public.cargos set estado = 'cancelado' where id = pruebas.id('cancelado');

create table pruebas.f (clave text primary key, id uuid);
grant select, insert on pruebas.f to authenticated;
create function pruebas.fac(p_clave text) returns uuid language sql stable as
  $$select id from pruebas.f where clave = p_clave$$;
grant execute on all functions in schema pruebas to authenticated;

-- Armar -----------------------------------------------------------------------------
select pruebas.entrar('administracion');
insert into pruebas.f select 'uno', public.crear_factura(pruebas.id('razon'), array[pruebas.id('a'), pruebas.id('b')]);
select is(
  (select row(estado, moneda, metodo_pago, forma_pago, uso_cfdi, dias_credito, orden_compra,
              cuenta_id = pruebas.id('cuenta'), created_by = pruebas.uid('administracion'))::text
   from public.facturas where id = pruebas.fac('uno')),
  '(borrador,USD,PPD,99,G03,30,OC-77,t,t)',
  'nace en borrador con la moneda de los cargos, las condiciones de la razón social y su orden de compra'
);
select is(
  (select string_agg(row(descripcion, cantidad, unidad, precio_unitario, importe, iva_tasa, iva)::text, ' ' order by orden)
   from public.factura_conceptos where factura_id = pruebas.fac('uno')),
  '("Cargo a",3,servicio,289.99,869.97,0.16,139.20) ("Cargo b",1,servicio,0.05,0.05,0.16,0.01)',
  'cada cargo es un concepto con sus datos; importe e IVA los calcula la base por concepto'
);
select is(
  (select row(subtotal, iva, total, conceptos)::text from public.factura_totales where factura_id = pruebas.fac('uno')),
  '(870.02,139.21,1009.23,2)', 'los totales suman los conceptos'
);
select is(
  (select count(*)::int from public.cargos where factura_id = pruebas.fac('uno')), 2,
  'los cargos quedan tomados por la factura'
);

select throws_ok(
  $$select public.crear_factura(pruebas.id('razon'), array[pruebas.id('a')])$$,
  'P0001', 'El cargo ya está en otra factura.', 'un cargo no entra en dos facturas'
);
select throws_ok(
  $$select public.crear_factura(pruebas.id('razon'), array[pruebas.id('c'), pruebas.id('pesos')])$$,
  'P0001', 'El cargo está en otra moneda.', 'no se mezclan monedas'
);
select throws_ok(
  $$select public.crear_factura(pruebas.id('razon'), array[pruebas.id('otro')])$$,
  'P0001', 'El cargo es de otro cliente.', 'ni cargos de otro cliente'
);
select throws_ok(
  $$select public.crear_factura(pruebas.id('razon'), array[pruebas.id('incompleto')])$$,
  'P0001', 'Al cargo le falta la cantidad o el precio.', 'ni cargos por completar'
);
select throws_ok(
  $$select public.crear_factura(pruebas.id('razon'), array[pruebas.id('cancelado')])$$,
  'P0001', 'El cargo no está pendiente de facturar.', 'ni cargos cancelados'
);
select throws_ok(
  $$select public.crear_factura(pruebas.id('razon'), array[]::uuid[])$$,
  'P0001', 'Elige al menos un cargo.', 'ni una factura vacía'
);
select throws_ok(
  $$select public.crear_factura(pruebas.id('razon'), array[pruebas.id('c'), gen_random_uuid()])$$,
  'P0001', 'Alguno de los cargos no existe.', 'si un cargo no existe no se crea nada'
);
select is((select count(*)::int from public.facturas where cuenta_id = pruebas.id('cuenta')), 1,
  'los intentos fallidos no dejan facturas a medias');
select is((select factura_id from public.cargos where id = pruebas.id('c')), null,
  'ni cargos tomados');

insert into pruebas.f select 'sin', public.crear_factura(pruebas.id('razon_sin'), array[pruebas.id('pesos')]);
select is(
  (select row(moneda, metodo_pago, uso_cfdi, dias_credito, orden_compra)::text from public.facturas where id = pruebas.fac('sin')),
  '(MXN,,,0,)', 'sin condiciones de crédito capturadas, la factura nace sin método ni días'
);

-- El cargo tomado no cambia ------------------------------------------------------------
select throws_ok(
  $$update public.cargos set precio_unitario = 1 where id = pruebas.id('a')$$,
  'P0001', null, 'un cargo en una factura no cambia de precio'
);
select throws_ok(
  $$update public.cargos set estado = 'cancelado' where id = pruebas.id('a')$$,
  'P0001', null, 'ni se cancela'
);
select throws_ok(
  $$update public.cargos set factura_id = null where id = pruebas.id('a')$$,
  'P0001', null, 'ni se suelta a mano'
);
select throws_ok(
  $$update public.cargos set factura_id = pruebas.fac('uno') where id = pruebas.id('c')$$,
  'P0001', null, 'ni se toma a mano'
);
select lives_ok(
  $$update public.cargos set notas = 'Revisado' where id = pruebas.id('a')$$,
  'sus notas sí se pueden anotar'
);

-- Corregir el borrador -----------------------------------------------------------------
select lives_ok(
  $$update public.facturas set tipo_cambio = 18.25, fecha = '2037-05-01', orden_compra = 'OC-78', notas = 'x'
    where id = pruebas.fac('uno')$$,
  'en borrador se corrigen fecha, tipo de cambio, orden de compra y notas'
);
update public.facturas set moneda = 'MXN', cuenta_id = pruebas.id('cuenta_otra') where id = pruebas.fac('uno');
select is(
  (select row(moneda, cuenta_id = pruebas.id('cuenta'))::text from public.facturas where id = pruebas.fac('uno')),
  '(USD,t)', 'la moneda y el cliente no cambian'
);
select throws_ok(
  $$update public.facturas set tipo_cambio = 18 where id = pruebas.fac('sin')$$,
  '23514', null, 'una factura en pesos no lleva tipo de cambio'
);
select throws_ok(
  $$update public.facturas set forma_pago = '03' where id = pruebas.fac('uno')$$,
  '23514', null, 'con PPD la forma de pago es 99'
);
select throws_ok(
  $$update public.facturas set estado = 'emitida' where id = pruebas.fac('uno')$$,
  'P0001', null, 'todavía no se emite desde el sistema'
);
update public.factura_conceptos set descripcion = 'Servicio de limpieza', clave_prod_serv = '81141500',
  clave_unidad = 'E48', cantidad = 99, precio_unitario = 99
where factura_id = pruebas.fac('uno') and cargo_id = pruebas.id('a');
select is(
  (select row(descripcion, clave_prod_serv, clave_unidad, cantidad, precio_unitario)::text
   from public.factura_conceptos where cargo_id = pruebas.id('a')),
  '("Servicio de limpieza",81141500,E48,3,289.99)',
  'en un concepto se corrigen la descripción y las claves del SAT, no la cantidad ni el precio'
);
select lives_ok(
  $$insert into public.factura_conceptos (factura_id, cargo_id, descripcion, cantidad, precio_unitario, iva_tasa)
    values (pruebas.fac('uno'), pruebas.id('c'), 'x', 1, 0, 0.16)$$,
  'se le agrega otro cargo'
);
select is(
  (select total from public.factura_totales where factura_id = pruebas.fac('uno')), 1125.23::numeric,
  'y el total se actualiza'
);
delete from public.factura_conceptos where factura_id = pruebas.fac('uno') and cargo_id = pruebas.id('b');
select is((select factura_id from public.cargos where id = pruebas.id('b')), null,
  'al quitar un concepto, su cargo queda libre');

-- Eliminar el borrador -----------------------------------------------------------------
update public.facturas set deleted_at = now() where id = pruebas.fac('uno');
select is((select count(*)::int from public.cargos where factura_id = pruebas.fac('uno')), 0,
  'al eliminar el borrador, sus cargos quedan libres');
select lives_ok(
  $$select public.crear_factura(pruebas.id('razon'), array[pruebas.id('a'), pruebas.id('b'), pruebas.id('c')])$$,
  'y se pueden facturar de nuevo'
);

select is(
  (select string_agg(c.descripcion, ', ' order by c.orden)
   from public.factura_conceptos c join public.facturas f on f.id = c.factura_id
   where f.cuenta_id = pruebas.id('cuenta') and f.deleted_at is null and f.moneda = 'USD'),
  'Cargo a, Cargo b, Cargo c', 'los conceptos quedan en el orden en que se eligieron los cargos'
);

-- Accesos ------------------------------------------------------------------------------
select pruebas.entrar('comercial');
select cmp_ok((select count(*)::int from public.facturas where cuenta_id = pruebas.id('cuenta')), '>=', 2,
  'comercial consulta las facturas');
select throws_ok(
  $$select public.crear_factura(pruebas.id('razon_sin'), array[pruebas.id('pesos')])$$,
  '42501', null, 'pero no las arma'
);
with c as (update public.facturas set notas = 'y' where cuenta_id = pruebas.id('cuenta') returning 1)
select is((select count(*)::int from c), 0, 'ni las cambia');

select pruebas.entrar('tecnico');
select is((select count(*)::int from public.facturas) + (select count(*)::int from public.factura_conceptos)
          + (select count(*)::int from public.factura_totales), 0,
  'el técnico no ve facturas, conceptos ni totales');
select pruebas.entrar('laboratorio');
select is((select public.iva_tasa()), null, 'el laboratorio no ve ni la tasa de IVA');

select * from finish();
rollback;
