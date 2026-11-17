-- Condiciones de crédito: una por razón social, dentro de la misma cuenta, y
-- solo para quien ve facturación.
begin;
select plan(16);

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
with c as (insert into public.cuentas (nombre) values ('ZZ Crédito') returning id)
insert into pruebas.d select 'cuenta', id from c;
with c as (insert into public.cuentas (nombre) values ('ZZ Crédito otra') returning id)
insert into pruebas.d select 'cuenta_otra', id from c;
with r as (insert into public.razones_sociales (cuenta_id, razon_social, rfc)
  values (pruebas.id('cuenta'), 'ZZ SA de CV', 'ZZZ010101AAA') returning id)
insert into pruebas.d select 'razon', id from r;
with r as (insert into public.razones_sociales (cuenta_id, razon_social, rfc)
  values (pruebas.id('cuenta'), 'ZZ Dos SA de CV', 'ZZZ020202BBB') returning id)
insert into pruebas.d select 'razon2', id from r;
with k as (insert into public.contactos (cuenta_id, nombre, area)
  values (pruebas.id('cuenta'), 'Paula Pagos', 'cuentas_por_pagar') returning id)
insert into pruebas.d select 'contacto', id from k;
with k as (insert into public.contactos (cuenta_id, nombre, area)
  values (pruebas.id('cuenta_otra'), 'Otro Contacto', 'cuentas_por_pagar') returning id)
insert into pruebas.d select 'contacto_otro', id from k;
grant execute on all functions in schema pruebas to authenticated;

select pruebas.entrar('administracion');
select lives_ok(
  $$insert into public.condiciones_credito
      (razon_social_id, cuenta_id, dias_credito, requiere_orden_compra, metodo_pago, forma_pago, contacto_cxp_id)
    values (pruebas.id('razon'), pruebas.id('cuenta'), 30, true, 'PPD', '99', pruebas.id('contacto'))$$,
  'administración captura las condiciones de una razón social'
);
select throws_ok(
  $$insert into public.condiciones_credito (razon_social_id, cuenta_id, dias_credito)
    values (pruebas.id('razon'), pruebas.id('cuenta'), 15)$$,
  '23505', null, 'una razón social tiene un solo juego de condiciones'
);
select throws_ok(
  $$insert into public.condiciones_credito (razon_social_id, cuenta_id)
    values (pruebas.id('razon2'), pruebas.id('cuenta_otra'))$$,
  '23503', null, 'la razón social debe ser de esa cuenta'
);
select throws_ok(
  $$update public.condiciones_credito set contacto_cxp_id = pruebas.id('contacto_otro')
    where razon_social_id = pruebas.id('razon')$$,
  '23503', null, 'el contacto de cuentas por pagar debe ser de la misma cuenta'
);
select throws_ok(
  $$update public.condiciones_credito set dias_credito = -1 where razon_social_id = pruebas.id('razon')$$,
  '23514', null, 'los días de crédito no son negativos'
);
select throws_ok(
  $$update public.condiciones_credito set forma_pago = '03' where razon_social_id = pruebas.id('razon')$$,
  '23514', null, 'con PPD la forma de pago es 99 (regla del SAT)'
);
select lives_ok(
  $$update public.condiciones_credito set metodo_pago = 'PUE', forma_pago = '03', dias_credito = 0
    where razon_social_id = pruebas.id('razon')$$,
  'de contado con transferencia sí'
);
select throws_ok(
  $$update public.condiciones_credito set metodo_pago = 'XXX' where razon_social_id = pruebas.id('razon')$$,
  '23514', null, 'el método de pago es PUE o PPD'
);
select throws_ok(
  $$delete from public.condiciones_credito where razon_social_id = pruebas.id('razon')$$,
  '42501', null, 'no se borran'
);

select pruebas.entrar('direccion');
select lives_ok(
  $$insert into public.condiciones_credito (razon_social_id, cuenta_id, dias_credito)
    values (pruebas.id('razon2'), pruebas.id('cuenta'), 45)$$,
  'dirección también las captura'
);

select pruebas.entrar('comercial');
select is((select count(*)::int from public.condiciones_credito where cuenta_id = pruebas.id('cuenta')), 2,
  'comercial las consulta');
with c as (update public.condiciones_credito set dias_credito = 90 where cuenta_id = pruebas.id('cuenta') returning 1)
select is((select count(*)::int from c), 0, 'pero no las cambia');

select pruebas.entrar('tecnico');
select is((select count(*)::int from public.condiciones_credito), 0, 'el técnico no ve condiciones de crédito');
select pruebas.entrar('laboratorio');
select is((select count(*)::int from public.condiciones_credito), 0, 'el laboratorio tampoco');
select pruebas.entrar('cliente');
select is((select count(*)::int from public.condiciones_credito), 0, 'ni el cliente');

select set_config('role', 'postgres', true);
select cmp_ok(
  (select count(*)::int from public.bitacora where tabla = 'condiciones_credito'), '>=', 3,
  'los cambios quedan en la bitácora'
);

select * from finish();
rollback;
