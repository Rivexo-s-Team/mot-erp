-- Tablero de dirección: ingresos, rentas vigentes y por facturar; quién lo ve.
begin;
select plan(13);

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

with c as (insert into public.cuentas (nombre) values ('ZZ Tablero') returning id)
insert into pruebas.d select 'cuenta', id from c;
with r as (insert into public.razones_sociales (cuenta_id, razon_social, rfc)
  values (pruebas.id('cuenta'), 'ZZ Tablero SA de CV', 'ZZT010101AAA') returning id)
insert into pruebas.d select 'razon', id from r;
with p as (insert into public.plantas (cuenta_id, nombre) values (pruebas.id('cuenta'), 'Planta T') returning id)
insert into pruebas.d select 'planta', id from p;

-- Lo que ya había antes de esta prueba (datos de desarrollo), para medir solo la diferencia.
create table pruebas.antes as
select
  (select coalesce(sum(t.precio), 0) from public.contratos c join public.contrato_tarifas t on t.contrato_id = c.id
   where c.estado = 'vigente' and c.deleted_at is null and t.unidad = 'mes' and t.deleted_at is null and c.moneda = 'USD') as renta,
  (select coalesce(sum(importe), 0) from public.cargos
   where estado = 'pendiente' and deleted_at is null and moneda = 'USD') as por_facturar;
grant select on pruebas.antes to authenticated;

-- Factura de un solo cargo, con fecha. Total con IVA = precio × 1.16.
create function pruebas.factura(p_clave text, p_precio numeric, p_fecha date, p_emitir boolean default true)
returns void language plpgsql as $$
declare v_cargo uuid; v_factura uuid;
begin
  insert into public.cargos (cuenta_id, tipo, concepto, cantidad, unidad, precio_unitario, moneda)
  values (pruebas.id('cuenta'), 'servicio', 'Cargo ' || p_clave, 1, 'servicio', p_precio, 'USD')
  returning id into v_cargo;
  v_factura := public.crear_factura(pruebas.id('razon'), array[v_cargo]);
  update public.facturas set fecha = p_fecha where id = v_factura;
  if p_emitir then
    update public.facturas set estado = 'emitida', folio = p_clave, uuid_fiscal = gen_random_uuid(), tipo_cambio = 18
    where id = v_factura;
  end if;
  insert into pruebas.d values ('f_' || p_clave, v_factura);
end $$;
grant execute on all functions in schema pruebas to authenticated;

select pruebas.entrar('administracion');
select pruebas.factura('T1', 100, '2037-03-10');
select pruebas.factura('T2', 300, '2037-03-25');
select pruebas.factura('T3', 50, '2037-04-02');
select pruebas.factura('T4', 70, '2037-04-05');
select pruebas.factura('T5', 999, '2037-04-06', false);
update public.facturas set estado = 'cancelada', motivo_cancelacion = 'Se refacturó' where id = pruebas.id('f_T4');
select public.registrar_pago(pruebas.id('razon'),
  jsonb_build_object('fecha', '2037-04-15', 'monto', 200, 'moneda', 'USD', 'forma_pago', '03',
                     'referencia', '', 'tipo_cambio', '', 'notas', ''),
  jsonb_build_array(jsonb_build_object('factura_id', pruebas.id('f_T1'), 'monto', 116)));
insert into public.cargos (cuenta_id, tipo, concepto, cantidad, unidad, precio_unitario, moneda)
values (pruebas.id('cuenta'), 'servicio', 'Pendiente', 2, 'servicio', 40, 'USD');
select pruebas.entrar('direccion');
with k as (insert into public.contratos (cuenta_id, planta_id, tipo, estado, moneda)
  values (pruebas.id('cuenta'), pruebas.id('planta'), 'renta', 'vigente', 'USD') returning id)
insert into pruebas.d select 'contrato', id from k;
insert into public.contrato_tarifas (contrato_id, planta_id, concepto, unidad, precio) values
  (pruebas.id('contrato'), pruebas.id('planta'), 'Renta Robox 1', 'mes', 300),
  (pruebas.id('contrato'), pruebas.id('planta'), 'Renta Robox 2', 'mes', 250),
  (pruebas.id('contrato'), pruebas.id('planta'), 'Instalación', 'unico', 1000);

select ok(public.tiene_permiso('direccion.ver'), 'dirección ve el tablero');
select is(
  (select string_agg(row(mes, moneda, facturas, facturado, facturado_total, cobrado)::text, ' ' order by mes)
   from public.tablero_ingresos('2037-01-01', '2037-12-31')),
  '(2037-03-01,USD,2,400.00,464.00,0) (2037-04-01,USD,1,50.00,58.00,200)',
  'facturado por mes sin y con IVA, sin canceladas ni borradores, y lo cobrado en su mes'
);
select is(
  (select count(*)::int from public.tablero_ingresos('2037-03-01', '2037-03-31')), 1,
  'el rango de fechas acota los meses'
);
select is(
  (select renta_mensual - (select renta from pruebas.antes) from public.tablero_rentas_vigentes() where moneda = 'USD'),
  550::numeric, 'la renta vigente suma las tarifas mensuales, no los pagos únicos'
);
update public.contratos set estado = 'terminado' where id = pruebas.id('contrato');
select is(
  (select coalesce(sum(renta_mensual), 0) - (select renta from pruebas.antes) from public.tablero_rentas_vigentes() where moneda = 'USD'),
  0::numeric, 'un contrato terminado deja de contar'
);
select is(
  (select importe - (select por_facturar from pruebas.antes) from public.tablero_por_facturar() where moneda = 'USD'),
  1149::numeric, 'por facturar: los cargos pendientes, sueltos o en borrador, y el de la factura cancelada, que volvió'
);

select pruebas.entrar('comercial');
select ok(public.tiene_permiso('direccion.ver'), 'comercial ve el tablero');
select is((select count(*)::int from public.tablero_ingresos('2037-01-01', '2037-12-31')), 2, 'y sus cifras');
select pruebas.entrar('administracion_coordinacion');
select ok(public.tiene_permiso('direccion.ver'), 'administración y coordinación ve el tablero');

select pruebas.entrar('tecnico');
select ok(not public.tiene_permiso('direccion.ver'), 'técnico no ve el tablero');
select is(
  (select count(*)::int from public.tablero_ingresos('2037-01-01', '2037-12-31'))
  + (select count(*)::int from public.tablero_rentas_vigentes()) + (select count(*)::int from public.tablero_por_facturar()),
  0, 'y las funciones no le devuelven nada'
);
select pruebas.entrar('coordinacion');
select is(
  (select count(*)::int from public.tablero_ingresos('2037-01-01', '2037-12-31'))
  + (select count(*)::int from public.tablero_rentas_vigentes()) + (select count(*)::int from public.tablero_por_facturar()),
  0, 'coordinación tampoco'
);
select pruebas.entrar('cliente');
select is(
  (select count(*)::int from public.tablero_ingresos('2037-01-01', '2037-12-31'))
  + (select count(*)::int from public.tablero_rentas_vigentes()) + (select count(*)::int from public.tablero_por_facturar()),
  0, 'ni un usuario del portal'
);

select * from finish();
rollback;
