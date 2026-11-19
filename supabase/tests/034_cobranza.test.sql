-- Cobranza: saldo de las órdenes de compra y seguimiento de portales de
-- proveedores por factura.
begin;
select plan(19);

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
with c as (insert into public.cuentas (nombre) values ('ZZ Cobranza') returning id)
insert into pruebas.d select 'cuenta', id from c;
with r as (insert into public.razones_sociales (cuenta_id, razon_social, rfc, usa_portal_proveedores)
  values (pruebas.id('cuenta'), 'ZZ SA de CV', 'ZZZ010101AAA', true) returning id)
insert into pruebas.d select 'razon', id from r;
with p as (insert into public.plantas (cuenta_id, nombre) values (pruebas.id('cuenta'), 'Planta') returning id)
insert into pruebas.d select 'planta', id from p;
with k as (insert into public.contratos (cuenta_id, planta_id, tipo, estado, moneda)
  values (pruebas.id('cuenta'), pruebas.id('planta'), 'renta', 'vigente', 'USD') returning id)
insert into pruebas.d select 'contrato', id from k;
with o as (insert into public.ordenes_compra (contrato_id, numero, monto)
  values (pruebas.id('contrato'), 'OC-1', 1000) returning id)
insert into pruebas.d select 'oc', id from o;
with o as (insert into public.ordenes_compra (contrato_id, numero) values (pruebas.id('contrato'), 'OC-ABIERTA') returning id)
insert into pruebas.d select 'oc_abierta', id from o;

create table pruebas.f (clave text primary key, id uuid);
grant select, insert on pruebas.f to authenticated;
create function pruebas.fac(p_clave text) returns uuid language sql stable as
  $$select id from pruebas.f where clave = p_clave$$;
-- Factura de un cargo cubierto (o no) por una orden de compra.
create function pruebas.factura(p_clave text, p_precio numeric, p_oc text, p_emitir boolean default true)
returns void language plpgsql as $$
declare v_cargo uuid; v_factura uuid;
begin
  insert into public.cargos (cuenta_id, tipo, concepto, cantidad, unidad, precio_unitario, moneda, orden_compra_id)
  values (pruebas.id('cuenta'), 'servicio', 'Cargo ' || p_clave, 1, 'servicio', p_precio, 'USD', pruebas.id(p_oc))
  returning id into v_cargo;
  v_factura := public.crear_factura(pruebas.id('razon'), array[v_cargo]);
  if p_emitir then
    update public.facturas set estado = 'emitida', folio = p_clave, uuid_fiscal = gen_random_uuid(), tipo_cambio = 18
    where id = v_factura;
  end if;
  insert into pruebas.f values (p_clave, v_factura);
end $$;
create function pruebas.oc(p_clave text) returns text language sql stable as
  $$select row(monto, facturado, saldo)::text from public.orden_compra_saldos where orden_compra_id = pruebas.id(p_clave)$$;
grant execute on all functions in schema pruebas to authenticated;

-- Saldo de órdenes de compra -----------------------------------------------------------
select pruebas.entrar('administracion');
select is(pruebas.oc('oc'), '(1000,0,1000)', 'una orden sin facturas conserva todo su monto');
select pruebas.factura('f1', 300, 'oc');
select pruebas.factura('f2', 250.50, 'oc');
select pruebas.factura('borrador', 100, 'oc', false);
select pruebas.factura('sin_oc', 999, null);
select pruebas.factura('abierta', 400, 'oc_abierta');
select is(pruebas.oc('oc'), '(1000,550.50,449.50)',
  'baja con lo facturado sin IVA de las facturas emitidas; un borrador o una factura sin orden no cuentan');
select is(pruebas.oc('oc_abierta'), '(,400.00,)', 'una orden sin monto dice lo facturado pero no tiene saldo');
update public.facturas set estado = 'cancelada', motivo_cancelacion = 'prueba' where id = pruebas.fac('f2');
select is(pruebas.oc('oc'), '(1000,300.00,700.00)', 'una factura cancelada devuelve el saldo a la orden');
select pruebas.factura('grande', 900, 'oc');
select is(pruebas.oc('oc'), '(1000,1200.00,-200.00)', 'si se factura de más, el saldo sale negativo (no se oculta)');

-- Portal de proveedores ------------------------------------------------------------------
select lives_ok(
  $$insert into public.portal_proveedor (factura_id) values (pruebas.fac('f1'))$$,
  'se abre el seguimiento de una factura emitida'
);
select is(
  (select row(estado, fecha_subida, created_by = pruebas.uid('administracion'))::text
   from public.portal_proveedor where factura_id = pruebas.fac('f1')),
  '(pendiente_subir,,t)', 'nace pendiente de subir'
);
select throws_ok(
  $$insert into public.portal_proveedor (factura_id) values (pruebas.fac('f1'))$$,
  '23505', null, 'un solo seguimiento por factura'
);
select throws_ok(
  $$update public.portal_proveedor set estado = 'subida' where factura_id = pruebas.fac('f1')$$,
  '23514', null, 'para marcarla subida hace falta la fecha'
);
select lives_ok(
  $$update public.portal_proveedor set estado = 'programada', fecha_subida = '2037-06-01',
      fecha_aprobacion = '2037-06-05', fecha_pago_programado = '2037-07-01', notas = 'Folio de portal 8841'
    where factura_id = pruebas.fac('f1')$$,
  'avanza con sus fechas y notas'
);
select throws_ok(
  $$update public.portal_proveedor set fecha_aprobacion = '2037-05-01' where factura_id = pruebas.fac('f1')$$,
  '23514', null, 'no se aprueba antes de subirla'
);
select throws_ok(
  $$update public.portal_proveedor set estado = 'rechazada' where factura_id = pruebas.fac('f1')$$,
  '23514', null, 'solo existen los cinco estados del portal'
);
select throws_ok(
  $$insert into public.portal_proveedor (factura_id) values (pruebas.fac('borrador'))$$,
  'P0001', 'Solo una factura emitida se sigue en el portal.', 'un borrador no se sigue en el portal'
);
select throws_ok(
  $$delete from public.portal_proveedor where factura_id = pruebas.fac('f1')$$,
  '42501', null, 'el seguimiento no se borra'
);

-- Accesos ------------------------------------------------------------------------------
select pruebas.entrar('comercial');
select is((select estado from public.portal_proveedor where factura_id = pruebas.fac('f1')), 'programada',
  'comercial consulta el seguimiento');
select is((select saldo from public.orden_compra_saldos where orden_compra_id = pruebas.id('oc')), -200.00::numeric,
  'y el saldo de las órdenes de compra');
with c as (update public.portal_proveedor set notas = 'x' where factura_id = pruebas.fac('f1') returning 1)
select is((select count(*)::int from c), 0, 'pero no lo cambia');

select pruebas.entrar('tecnico');
select is((select count(*)::int from public.portal_proveedor), 0, 'el técnico no ve el seguimiento de portales');
select is(
  (select count(*)::int from public.orden_compra_saldos where facturado > 0), 0,
  'ni lo facturado contra las órdenes de compra'
);

select * from finish();
rollback;
