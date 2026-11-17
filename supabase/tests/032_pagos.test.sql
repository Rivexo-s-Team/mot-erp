-- Pagos: se aplican a facturas emitidas de la misma razón social y moneda,
-- sin pasarse del pago ni del saldo de la factura.
begin;
select plan(34);

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
with c as (insert into public.cuentas (nombre) values ('ZZ Pagos') returning id)
insert into pruebas.d select 'cuenta', id from c;
with r as (insert into public.razones_sociales (cuenta_id, razon_social, rfc)
  values (pruebas.id('cuenta'), 'ZZ SA de CV', 'ZZZ010101AAA') returning id)
insert into pruebas.d select 'razon', id from r;
with r as (insert into public.razones_sociales (cuenta_id, razon_social, rfc)
  values (pruebas.id('cuenta'), 'ZZ Otra SA de CV', 'ZZZ020202BBB') returning id)
insert into pruebas.d select 'razon_otra', id from r;

create table pruebas.f (clave text primary key, id uuid);
grant select, insert on pruebas.f to authenticated;
create function pruebas.fac(p_clave text) returns uuid language sql stable as
  $$select id from pruebas.f where clave = p_clave$$;
-- Factura emitida de un solo cargo. Total con IVA = precio × 1.16.
create function pruebas.factura(p_clave text, p_razon text, p_precio numeric, p_moneda text default 'USD',
                                p_emitir boolean default true)
returns void language plpgsql as $$
declare v_cargo uuid; v_factura uuid;
begin
  insert into public.cargos (cuenta_id, tipo, concepto, cantidad, unidad, precio_unitario, moneda)
  values (pruebas.id('cuenta'), 'servicio', 'Cargo ' || p_clave, 1, 'servicio', p_precio, p_moneda)
  returning id into v_cargo;
  v_factura := public.crear_factura(pruebas.id(p_razon), array[v_cargo]);
  if p_emitir then
    update public.facturas set estado = 'emitida', folio = p_clave, uuid_fiscal = gen_random_uuid(),
      tipo_cambio = case when p_moneda = 'MXN' then null else 18 end
    where id = v_factura;
  end if;
  insert into pruebas.f values (p_clave, v_factura);
end $$;
create function pruebas.saldo(p_clave text) returns text language sql stable as
  $$select row(total, pagado, saldo)::text from public.factura_saldos where factura_id = pruebas.fac(p_clave)$$;
create table pruebas.p (clave text primary key, id uuid);
grant select, insert on pruebas.p to authenticated;
create function pruebas.pago(p_clave text) returns uuid language sql stable as
  $$select id from pruebas.p where clave = p_clave$$;
create function pruebas.datos(p_monto numeric, p_moneda text default 'USD') returns jsonb language sql as
  $$select jsonb_build_object('fecha', '2037-06-10', 'monto', p_monto, 'moneda', p_moneda, 'forma_pago', '03',
                              'referencia', ' SPEI 123 ', 'tipo_cambio', '', 'notas', '')$$;
create function pruebas.ap(p_factura text, p_monto numeric) returns jsonb language sql as
  $$select jsonb_build_object('factura_id', pruebas.fac(p_factura), 'monto', p_monto)$$;
grant execute on all functions in schema pruebas to authenticated;

select pruebas.entrar('administracion');
select pruebas.factura('f1', 'razon', 100);          -- total 116.00
select pruebas.factura('f2', 'razon', 300);          -- total 348.00
select pruebas.factura('pesos', 'razon', 1000, 'MXN');
select pruebas.factura('de_otra', 'razon_otra', 100);
select pruebas.factura('borrador', 'razon', 50, 'USD', false);
select is(pruebas.saldo('f1'), '(116.00,0,116.00)', 'una factura emitida sin pagos debe todo su total');

-- Registrar y aplicar ------------------------------------------------------------------
insert into pruebas.p select 'uno',
  public.registrar_pago(pruebas.id('razon'), pruebas.datos(200), jsonb_build_array(pruebas.ap('f1', 116), pruebas.ap('f2', 50)));
select is(
  (select row(monto, moneda, forma_pago, referencia, cuenta_id = pruebas.id('cuenta'),
              created_by = pruebas.uid('administracion'))::text from public.pagos where id = pruebas.pago('uno')),
  '(200,USD,03,"SPEI 123",t,t)', 'el pago queda con sus datos y quién lo registró'
);
select is(pruebas.saldo('f1'), '(116.00,116,0.00)', 'la factura pagada completa queda en cero');
select is(pruebas.saldo('f2'), '(348.00,50,298.00)', 'la pagada en parte conserva su saldo');
select is(
  (select row(aplicado, por_aplicar)::text from public.pago_saldos where pago_id = pruebas.pago('uno')),
  '(166,34)', 'lo que sobra del pago queda por aplicar'
);

select throws_ok(
  $$insert into public.pago_aplicaciones (pago_id, factura_id, monto) values (pruebas.pago('uno'), pruebas.fac('de_otra'), 10)$$,
  'P0001', 'La factura es de otra razón social.', 'un pago no se aplica a la factura de otra razón social'
);
select throws_ok(
  $$insert into public.pago_aplicaciones (pago_id, factura_id, monto) values (pruebas.pago('uno'), pruebas.fac('pesos'), 10)$$,
  'P0001', 'La factura está en otra moneda que el pago.', 'ni a una factura en otra moneda'
);
select throws_ok(
  $$insert into public.pago_aplicaciones (pago_id, factura_id, monto) values (pruebas.pago('uno'), pruebas.fac('borrador'), 10)$$,
  'P0001', 'Un pago solo se aplica a una factura emitida.', 'ni a un borrador'
);
select throws_ok(
  $$insert into public.pago_aplicaciones (pago_id, factura_id, monto) values (pruebas.pago('uno'), pruebas.fac('f2'), 1)$$,
  '23505', null, 'un pago se aplica una sola vez a cada factura'
);
select throws_ok(
  $$insert into public.pago_aplicaciones (pago_id, factura_id, monto) values (pruebas.pago('uno'), pruebas.fac('f2'), 0.005)$$,
  '23514', null, 'los montos van a centavos'
);

select throws_ok(
  $$update public.pago_aplicaciones set monto = 85 where pago_id = pruebas.pago('uno') and factura_id = pruebas.fac('f2')$$,
  'P0001', 'Lo aplicado es más que el monto del pago.', 'no se aplica más de lo que se recibió'
);
select lives_ok(
  $$update public.pago_aplicaciones set monto = 84 where pago_id = pruebas.pago('uno') and factura_id = pruebas.fac('f2')$$,
  'sí se aplica el resto exacto'
);
-- Todo o nada.
select throws_ok(
  $$select public.registrar_pago(pruebas.id('razon'), pruebas.datos(500), jsonb_build_array(pruebas.ap('f2', 300)))$$,
  'P0001', 'Lo aplicado es más que el saldo de la factura.', 'no se paga más que el saldo de la factura'
);
select is((select count(*)::int from public.pagos where cuenta_id = pruebas.id('cuenta')), 1,
  'si una aplicación no procede, el pago tampoco se registra');
insert into pruebas.p select 'dos',
  public.registrar_pago(pruebas.id('razon'), pruebas.datos(264), jsonb_build_array(pruebas.ap('f2', 264)));
select is(pruebas.saldo('f2'), '(348.00,348,0.00)', 'dos pagos liquidan una factura');
insert into pruebas.p select 'anticipado', public.registrar_pago(pruebas.id('razon'), pruebas.datos(1000), '[]');
select is(
  (select por_aplicar from public.pago_saldos where pago_id = pruebas.pago('anticipado')), 1000::numeric,
  'un pago se puede registrar sin aplicarlo todavía'
);

-- Reglas del pago ----------------------------------------------------------------------
select throws_ok(
  $$update public.pagos set monto = 100 where id = pruebas.pago('uno')$$,
  'P0001', null, 'el monto no baja de lo ya aplicado'
);
update public.pagos set moneda = 'MXN', razon_social_id = pruebas.id('razon_otra') where id = pruebas.pago('uno');
select is(
  (select row(moneda, razon_social_id = pruebas.id('razon'))::text from public.pagos where id = pruebas.pago('uno')),
  '(USD,t)', 'la moneda y la razón social del pago no cambian'
);
select throws_ok(
  $$select public.registrar_pago(pruebas.id('razon'), pruebas.datos(10) || '{"forma_pago": "99"}', '[]')$$,
  '23514', null, 'un pago recibido no lleva forma "por definir"'
);
select throws_ok(
  $$select public.registrar_pago(pruebas.id('razon'), pruebas.datos(0), '[]')$$,
  '23514', null, 'ni monto en cero'
);
select throws_ok(
  $$select public.registrar_pago(pruebas.id('razon'), pruebas.datos(10, 'MXN') || '{"tipo_cambio": "18"}', '[]')$$,
  '23514', null, 'un pago en pesos no lleva tipo de cambio'
);

-- Complemento de pago ------------------------------------------------------------------
select throws_ok(
  $$update public.pagos set rep_folio = 'P-1' where id = pruebas.pago('uno')$$,
  '23514', null, 'el complemento lleva folio y folio fiscal juntos'
);
select lives_ok(
  $$update public.pagos set rep_folio = 'P-1', rep_uuid = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' where id = pruebas.pago('uno')$$,
  'se registra el complemento de pago'
);
select throws_ok(
  $$update public.pagos set rep_folio = 'P-2', rep_uuid = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' where id = pruebas.pago('dos')$$,
  '23505', null, 'dos pagos no comparten complemento'
);
select throws_ok(
  $$update public.pagos set deleted_at = now() where id = pruebas.pago('uno')$$,
  'P0001', null, 'un pago con complemento no se elimina'
);

-- Cancelar y eliminar ------------------------------------------------------------------
select throws_ok(
  $$update public.facturas set estado = 'cancelada', motivo_cancelacion = 'x' where id = pruebas.fac('f2')$$,
  'P0001', 'La factura tiene pagos aplicados. Quítalos antes de cancelarla.', 'una factura con pagos no se cancela'
);
delete from public.pago_aplicaciones where pago_id = pruebas.pago('dos');
select is(pruebas.saldo('f2'), '(348.00,84,264.00)', 'al quitar una aplicación, la factura recupera su saldo');
update public.pagos set deleted_at = now() where id = pruebas.pago('dos');
select throws_ok(
  $$insert into public.pago_aplicaciones (pago_id, factura_id, monto) values (pruebas.pago('dos'), pruebas.fac('f2'), 1)$$,
  'P0001', 'El pago no existe.', 'un pago eliminado ya no se aplica'
);
insert into pruebas.p select 'tres',
  public.registrar_pago(pruebas.id('razon'), pruebas.datos(264), jsonb_build_array(pruebas.ap('f2', 264)));
update public.pagos set deleted_at = now() where id = pruebas.pago('tres');
select is(pruebas.saldo('f2'), '(348.00,84,264.00)', 'al eliminar un pago se quitan sus aplicaciones');

-- Accesos ------------------------------------------------------------------------------
select pruebas.entrar('comercial');
select cmp_ok((select count(*)::int from public.pagos where cuenta_id = pruebas.id('cuenta')), '>=', 2,
  'comercial consulta los pagos');
select is((select saldo from public.factura_saldos where factura_id = pruebas.fac('f2')), 264.00::numeric,
  'y los saldos');
select throws_ok(
  $$select public.registrar_pago(pruebas.id('razon'), pruebas.datos(10), '[]')$$,
  '42501', null, 'pero no registra pagos'
);
with c as (delete from public.pago_aplicaciones where pago_id = pruebas.pago('uno') returning 1)
select is((select count(*)::int from c), 0, 'ni quita aplicaciones');

select pruebas.entrar('tecnico');
select is((select count(*)::int from public.pagos) + (select count(*)::int from public.pago_aplicaciones)
          + (select count(*)::int from public.factura_saldos) + (select count(*)::int from public.pago_saldos), 0,
  'el técnico no ve pagos, aplicaciones ni saldos');

select * from finish();
rollback;
