-- Anticipos: el pago único del contrato se vuelve cargo, el anticipo se
-- factura aparte y solo se aplica lo que el cliente ya pagó.
begin;
select plan(32);

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
with c as (insert into public.cuentas (nombre) values ('ZZ Anticipos') returning id)
insert into pruebas.d select 'cuenta', id from c;
with r as (insert into public.razones_sociales (cuenta_id, razon_social, rfc)
  values (pruebas.id('cuenta'), 'ZZ SA de CV', 'ZZZ010101AAA') returning id)
insert into pruebas.d select 'razon', id from r;
with r as (insert into public.razones_sociales (cuenta_id, razon_social, rfc)
  values (pruebas.id('cuenta'), 'ZZ Otra SA de CV', 'ZZZ020202BBB') returning id)
insert into pruebas.d select 'razon_otra', id from r;
with p as (insert into public.plantas (cuenta_id, nombre) values (pruebas.id('cuenta'), 'Planta') returning id)
insert into pruebas.d select 'planta', id from p;
with k as (insert into public.contratos (cuenta_id, planta_id, tipo, estado, moneda)
  values (pruebas.id('cuenta'), pruebas.id('planta'), 'renta', 'vigente', 'USD') returning id)
insert into pruebas.d select 'contrato', id from k;
with k as (insert into public.contratos (cuenta_id, planta_id, tipo, estado)
  values (pruebas.id('cuenta'), pruebas.id('planta'), 'renta', 'borrador') returning id)
insert into pruebas.d select 'borrador', id from k;
create function pruebas.tarifa(p_clave text, p_contrato text, p_concepto text, p_unidad text, p_precio numeric,
                               p_anticipo boolean default false) returns void language plpgsql as $$
declare v_id uuid;
begin
  insert into public.contrato_tarifas (contrato_id, planta_id, concepto, unidad, precio, es_anticipo)
  values (pruebas.id(p_contrato), pruebas.id('planta'), p_concepto, p_unidad, p_precio, p_anticipo)
  returning id into v_id;
  insert into pruebas.d values (p_clave, v_id);
end $$;
select pruebas.tarifa('t_renta', 'contrato', 'Renta Robox', 'mes', 300);
select pruebas.tarifa('t_anticipo', 'contrato', 'Anticipo de 2 meses', 'unico', 600, true);
select pruebas.tarifa('t_instalacion', 'contrato', 'Instalación', 'unico', 1000);
select pruebas.tarifa('t_borrador', 'borrador', 'Anticipo borrador', 'unico', 600, true);

create table pruebas.f (clave text primary key, id uuid);
grant select, insert on pruebas.f to authenticated;
create function pruebas.fac(p_clave text) returns uuid language sql stable as
  $$select id from pruebas.f where clave = p_clave$$;
create function pruebas.emitir(p_clave text) returns void language sql as $$
  update public.facturas set estado = 'emitida', folio = p_clave, uuid_fiscal = gen_random_uuid(), tipo_cambio = 18
  where id = pruebas.fac(p_clave)
$$;
create function pruebas.cargo_de(p_tarifa text) returns uuid language sql stable as
  $$select id from public.cargos where tarifa_id = pruebas.id(p_tarifa) and deleted_at is null$$;
create function pruebas.anticipo() returns text language sql stable as
  $$select row(pagado, aplicado, disponible)::text from public.anticipo_saldos where factura_id = pruebas.fac('anticipo')$$;
create function pruebas.pagar(p_factura text, p_monto numeric) returns uuid language sql as $$
  select public.registrar_pago(pruebas.id('razon'),
    jsonb_build_object('fecha', '2037-06-10', 'monto', p_monto, 'moneda', 'USD', 'forma_pago', '03'),
    jsonb_build_array(jsonb_build_object('factura_id', pruebas.fac(p_factura), 'monto', p_monto)))
$$;
grant execute on all functions in schema pruebas to authenticated;

-- 1. Pagos únicos como cargos ------------------------------------------------------------
select throws_ok(
  $$update public.contrato_tarifas set es_anticipo = true where id = pruebas.id('t_renta')$$,
  '23514', null, 'solo un pago único puede ser anticipo'
);
select pruebas.entrar('administracion');
select is(
  (select string_agg(concepto || ':' || es_anticipo || ':' || (cargo_id is null), ', ' order by concepto)
   from public.pagos_unicos_de_contrato(pruebas.id('contrato'))),
  'Anticipo de 2 meses:true:true, Instalación:false:true',
  'el contrato lista sus pagos únicos por cobrar (no las rentas)'
);
select lives_ok($$select public.generar_cargo_unico(pruebas.id('t_anticipo'))$$, 'se genera el cargo del anticipo');
select lives_ok($$select public.generar_cargo_unico(pruebas.id('t_instalacion'))$$, 'y el de la instalación');
select is(
  (select string_agg(row(tipo, concepto, cantidad, unidad, precio_unitario, importe, moneda, estado)::text, ' ' order by tipo)
   from public.cargos where contrato_id = pruebas.id('contrato')),
  '(anticipo,"Anticipo de 2 meses",1,pago,600,600.00,USD,pendiente) (pago_unico,Instalación,1,pago,1000,1000.00,USD,pendiente)',
  'cada cargo toma concepto, precio y moneda del contrato; el anticipo queda marcado'
);
select throws_ok(
  $$select public.generar_cargo_unico(pruebas.id('t_anticipo'))$$,
  'P0001', 'Ese pago único ya tiene su cargo.', 'un pago único se cobra una sola vez'
);
select throws_ok(
  $$select public.generar_cargo_unico(pruebas.id('t_renta'))$$,
  'P0001', 'Esa tarifa no es un pago único.', 'una renta no es un pago único'
);
select throws_ok(
  $$select public.generar_cargo_unico(pruebas.id('t_borrador'))$$,
  'P0001', 'El contrato no está vigente.', 'un contrato en borrador no genera cargos'
);
select lives_ok(
  $$insert into public.cargos (cuenta_id, tipo, concepto, cantidad, precio_unitario)
    values (pruebas.id('cuenta'), 'anticipo', 'Anticipo sin contrato', 1, 50)$$,
  'un anticipo también se puede capturar a mano, sin tarifa'
);
select throws_ok(
  $$insert into public.cargos (cuenta_id, tipo, concepto, cantidad, precio_unitario)
    values (pruebas.id('cuenta'), 'pago_unico', 'Pago único a mano', 1, 50)$$,
  '23514', null, 'un pago único de contrato siempre lleva su tarifa'
);

-- 2. La factura de anticipo va aparte ------------------------------------------------------
select throws_ok(
  $$select public.crear_factura(pruebas.id('razon'), array[pruebas.cargo_de('t_anticipo'), pruebas.cargo_de('t_instalacion')])$$,
  'P0001', 'Un anticipo se factura aparte: no se mezcla con otros cargos.', 'el anticipo no se mezcla con otros cargos'
);
insert into pruebas.f select 'anticipo', public.crear_factura(pruebas.id('razon'), array[pruebas.cargo_de('t_anticipo')]);
insert into pruebas.f select 'instalacion', public.crear_factura(pruebas.id('razon'), array[pruebas.cargo_de('t_instalacion')]);
select is(
  (select string_agg(es_anticipo::text, ',' order by es_anticipo desc) from public.facturas
   where id in (pruebas.fac('anticipo'), pruebas.fac('instalacion'))),
  'true,false', 'la factura del anticipo queda marcada; la otra no'
);
update public.facturas set es_anticipo = true where id = pruebas.fac('instalacion');
select is((select es_anticipo from public.facturas where id = pruebas.fac('instalacion')), false,
  'eso no se cambia a mano');
select pruebas.emitir('anticipo');   -- total 696.00
select pruebas.emitir('instalacion'); -- total 1160.00
select is(pruebas.anticipo(), '(0,0,0)', 'un anticipo sin pagar no tiene nada disponible');

-- 3. Aplicar el anticipo ---------------------------------------------------------------------
select throws_ok(
  $$select public.aplicar_anticipo(pruebas.fac('anticipo'), pruebas.fac('instalacion'), 100, '2037-07-01')$$,
  'P0001', 'El anticipo disponible no alcanza: solo se aplica lo que el cliente ya pagó.',
  'no se aplica un anticipo que el cliente no ha pagado'
);
select pruebas.pagar('anticipo', 696);
select is(pruebas.anticipo(), '(696,0,696)', 'pagado el anticipo, queda todo disponible');
select lives_ok(
  $$select public.aplicar_anticipo(pruebas.fac('anticipo'), pruebas.fac('instalacion'), 500, '2037-07-01')$$,
  'se aplica parte del anticipo a otra factura'
);
select is(
  (select row(monto, forma_pago, moneda, anticipo_factura_id = pruebas.fac('anticipo'), referencia)::text
   from public.pagos where anticipo_factura_id is not null),
  '(500,30,USD,t,"Anticipo de la factura anticipo")',
  'queda como un pago con forma 30 (aplicación de anticipos), ligado a su anticipo'
);
select is(pruebas.anticipo(), '(696,500,196)', 'baja lo disponible del anticipo');
select is(
  (select row(pagado, saldo)::text from public.factura_saldos where factura_id = pruebas.fac('instalacion')),
  '(500,660.00)', 'y el saldo de la factura a la que se aplicó'
);
select throws_ok(
  $$select public.aplicar_anticipo(pruebas.fac('anticipo'), pruebas.fac('instalacion'), 196.01, '2037-07-02')$$,
  'P0001', null, 'no se aplica más de lo disponible'
);
select lives_ok(
  $$select public.aplicar_anticipo(pruebas.fac('anticipo'), pruebas.fac('instalacion'), 196, '2037-07-02')$$,
  'sí el resto exacto'
);
select throws_ok(
  $$select public.aplicar_anticipo(pruebas.fac('instalacion'), pruebas.fac('anticipo'), 1, '2037-07-02')$$,
  'P0001', 'Esa factura no es un anticipo emitido.', 'solo sale dinero de una factura de anticipo'
);
select throws_ok(
  $$insert into public.pagos (cuenta_id, razon_social_id, fecha, monto, moneda, forma_pago)
    values (pruebas.id('cuenta'), pruebas.id('razon'), '2037-07-02', 10, 'USD', '30')$$,
  '23514', null, 'la forma 30 siempre va ligada a su anticipo'
);
select throws_ok(
  $$insert into public.pagos (cuenta_id, razon_social_id, fecha, monto, moneda, forma_pago, anticipo_factura_id)
    values (pruebas.id('cuenta'), pruebas.id('razon_otra'), '2037-07-02', 1, 'USD', '30', pruebas.fac('anticipo'))$$,
  'P0001', null, 'el anticipo no se aplica a otra razón social'
);
select throws_ok(
  $$delete from public.pago_aplicaciones where factura_id = pruebas.fac('anticipo')$$,
  'P0001', null, 'no se le quita el pago a un anticipo que ya se aplicó'
);
select throws_ok(
  $$update public.pagos set deleted_at = now() where anticipo_factura_id is null and cuenta_id = pruebas.id('cuenta')$$,
  'P0001', null, 'ni se elimina ese pago'
);
-- Deshacer: eliminar una aplicación devuelve lo disponible.
update public.pagos set deleted_at = now() where anticipo_factura_id is not null and monto = 196;
select is(pruebas.anticipo(), '(696,500,196)', 'al eliminar una aplicación, el anticipo recupera lo disponible');

-- Accesos ------------------------------------------------------------------------------
select pruebas.entrar('comercial');
select is((select disponible from public.anticipo_saldos where factura_id = pruebas.fac('anticipo')), 196::numeric,
  'comercial consulta el anticipo disponible');
select throws_ok(
  $$select public.aplicar_anticipo(pruebas.fac('anticipo'), pruebas.fac('instalacion'), 1, '2037-07-03')$$,
  '42501', null, 'pero no lo aplica'
);
select throws_ok(
  $$select public.generar_cargo_unico(pruebas.id('t_instalacion'))$$,
  '42501', null, 'ni genera cargos'
);
select pruebas.entrar('tecnico');
select is((select count(*)::int from public.anticipo_saldos), 0, 'el técnico no ve anticipos');

select * from finish();
rollback;
