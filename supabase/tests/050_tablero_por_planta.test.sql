-- Tablero de dirección: ingresos por cliente y planta.
begin;
select plan(8);

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

with c as (insert into public.cuentas (nombre) values ('ZZ Plantas') returning id)
insert into pruebas.d select 'cuenta', id from c;
with r as (insert into public.razones_sociales (cuenta_id, razon_social, rfc)
  values (pruebas.id('cuenta'), 'ZZ Plantas SA de CV', 'ZZP010101AAA') returning id)
insert into pruebas.d select 'razon', id from r;
with p as (insert into public.plantas (cuenta_id, nombre) values (pruebas.id('cuenta'), 'Planta Norte') returning id)
insert into pruebas.d select 'norte', id from p;
with p as (insert into public.plantas (cuenta_id, nombre) values (pruebas.id('cuenta'), 'Planta Sur') returning id)
insert into pruebas.d select 'sur', id from p;
with k as (insert into public.contratos (cuenta_id, planta_id, tipo, estado, moneda)
  values (pruebas.id('cuenta'), pruebas.id('norte'), 'renta', 'vigente', 'USD') returning id)
insert into pruebas.d select 'k_norte', id from k;
with k as (insert into public.contratos (cuenta_id, planta_id, tipo, estado, moneda)
  values (pruebas.id('cuenta'), pruebas.id('sur'), 'por_evento', 'vigente', 'USD') returning id)
insert into pruebas.d select 'k_sur', id from k;
insert into public.contrato_tarifas (contrato_id, planta_id, concepto, unidad, precio) values
  (pruebas.id('k_norte'), pruebas.id('norte'), 'Renta Robox 1', 'mes', 300),
  (pruebas.id('k_norte'), pruebas.id('norte'), 'Renta Robox 2', 'mes', 250);
with r as (insert into public.robox (numero_serie) values ('ZZ-TP-1') returning id)
insert into pruebas.d select 'robox', id from r;
insert into public.asignaciones_robox (robox_id, contrato_id, planta_id, fecha_inicio)
values (pruebas.id('robox'), pruebas.id('k_sur'), pruebas.id('sur'), '2036-01-10');

-- Factura emitida con un cargo por contrato (o sin contrato).
create function pruebas.factura(p_clave text, p_contrato text, p_precio numeric, p_fecha date)
returns void language plpgsql as $$
declare v_cargo uuid; v_factura uuid;
begin
  insert into public.cargos (cuenta_id, contrato_id, tipo, concepto, cantidad, unidad, precio_unitario, moneda)
  values (pruebas.id('cuenta'), pruebas.id(p_contrato), 'servicio', 'Cargo ' || p_clave, 1, 'servicio', p_precio, 'USD')
  returning id into v_cargo;
  v_factura := public.crear_factura(pruebas.id('razon'), array[v_cargo]);
  update public.facturas set fecha = p_fecha where id = v_factura;
  update public.facturas set estado = 'emitida', folio = p_clave, uuid_fiscal = gen_random_uuid(), tipo_cambio = 18
  where id = v_factura;
end $$;
create function pruebas.fila(p_planta text) returns text language sql stable as $$
  select row(planta, moneda, facturado, renta_mensual, robox)::text
  from public.tablero_por_planta('2037-01-01', '2037-12-31')
  where cuenta_id = pruebas.id('cuenta') and planta_id is not distinct from pruebas.id(p_planta)
$$;
grant execute on all functions in schema pruebas to authenticated;

select pruebas.entrar('administracion');
select pruebas.factura('P1', 'k_norte', 100, '2037-03-10');
select pruebas.factura('P2', 'k_norte', 200, '2037-05-10');
select pruebas.factura('P3', 'k_sur', 80, '2037-05-11');
select pruebas.factura('P4', 'nada', 40, '2037-06-01');
select pruebas.factura('P5', 'k_norte', 999, '2036-12-31');

select pruebas.entrar('direccion');
select is(pruebas.fila('norte'), '("Planta Norte",USD,300.00,550,0)',
  'la planta con renta: lo facturado en el periodo sin IVA y su renta mensual');
select is(pruebas.fila('sur'), '("Planta Sur",USD,80.00,0,1)',
  'la planta por litro: lo facturado y su Robox asignado, sin renta');
select is(pruebas.fila('nada'), '(,USD,40.00,0,0)', 'lo facturado sin contrato ni orden queda sin planta');
select is(
  (select count(*)::int from public.tablero_por_planta('2037-01-01', '2037-12-31') where cuenta_id = pruebas.id('cuenta')), 3,
  'un renglón por planta y moneda'
);
select is(
  (select sum(facturado) from public.tablero_por_planta('2037-05-01', '2037-05-31') where cuenta_id = pruebas.id('cuenta')),
  280.00::numeric, 'el periodo acota lo facturado'
);

select pruebas.entrar('comercial');
select is(pruebas.fila('norte'), '("Planta Norte",USD,300.00,550,0)', 'comercial ve las mismas cifras');
select pruebas.entrar('tecnico');
select is((select count(*)::int from public.tablero_por_planta('2037-01-01', '2037-12-31')), 0, 'técnico no obtiene nada');
select pruebas.entrar('cliente');
select is((select count(*)::int from public.tablero_por_planta('2037-01-01', '2037-12-31')), 0, 'ni un usuario del portal');

select * from finish();
rollback;
