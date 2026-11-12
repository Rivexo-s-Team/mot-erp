-- Órdenes de compra: pertenecen a un contrato y cubren sus tarifas. Son
-- precios: las ve quien tiene precios.ver; editan Dirección y Administración.
begin;
select plan(16);

create schema pruebas;
grant usage on schema pruebas to authenticated;

create function pruebas.crear_usuario(p_rol text) returns uuid language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email)
  values (v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'prueba-' || v_id || '@mot.test');
  insert into public.perfiles (id, nombre, correo, rol_id)
  select v_id, 'Prueba ' || p_rol, 'prueba-' || v_id || '@mot.test', id
  from public.roles where clave = p_rol;
  return v_id;
end $$;

create table pruebas.u (rol text primary key, id uuid);
insert into pruebas.u select clave, pruebas.crear_usuario(clave) from public.roles;
grant select on pruebas.u to authenticated;

create function pruebas.entrar(p_rol text) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from pruebas.u where rol = p_rol), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- Una cuenta con su planta y dos contratos, cada uno con una tarifa.
create table pruebas.d (clave text primary key, id uuid);
grant select on pruebas.d to authenticated;
with c as (insert into public.cuentas (nombre) values ('ZZ Órdenes') returning id)
insert into pruebas.d select 'cuenta', id from c;
with p as (insert into public.plantas (cuenta_id, nombre)
  select id, 'Planta OC' from pruebas.d where clave = 'cuenta' returning id)
insert into pruebas.d select 'planta', id from p;
with k as (insert into public.contratos (cuenta_id, planta_id, tipo, referencia)
  select c.id, p.id, 'renta', 'uno' from pruebas.d c, pruebas.d p
  where c.clave = 'cuenta' and p.clave = 'planta' returning id)
insert into pruebas.d select 'contrato_1', id from k;
with k as (insert into public.contratos (cuenta_id, planta_id, tipo, referencia)
  select c.id, p.id, 'renta', 'dos' from pruebas.d c, pruebas.d p
  where c.clave = 'cuenta' and p.clave = 'planta' returning id)
insert into pruebas.d select 'contrato_2', id from k;

create function pruebas.id(p_clave text) returns uuid language sql stable as
  $$select id from pruebas.d where clave = p_clave$$;
grant execute on all functions in schema pruebas to authenticated;

insert into public.contrato_tarifas (contrato_id, planta_id, concepto, unidad, precio)
values (pruebas.id('contrato_1'), pruebas.id('planta'), 'Renta Robox 1', 'mes', 575),
       (pruebas.id('contrato_1'), pruebas.id('planta'), 'Renta Robox 2', 'mes', 575),
       (pruebas.id('contrato_2'), pruebas.id('planta'), 'Renta Robox 3', 'mes', 240);

-- Quién edita ----------------------------------------------------------------
select pruebas.entrar('administracion');
select lives_ok(
  $$insert into public.ordenes_compra (contrato_id, numero, monto, fecha_termino)
    values (pruebas.id('contrato_1'), '5300402443', 41400, '2027-11-30')$$,
  'administración registra una orden de compra'
);
select set_config('role', 'postgres', true);
insert into pruebas.d select 'oc_1', id from public.ordenes_compra where numero = '5300402443';
select pruebas.entrar('administracion');
with c as (
  update public.contrato_tarifas set orden_compra_id = pruebas.id('oc_1')
  where contrato_id = pruebas.id('contrato_1') returning 1
)
select is((select count(*)::int from c), 2, 'una misma OC cubre dos tarifas del contrato');

-- Reglas de datos -----------------------------------------------------------
select throws_ok(
  $$update public.contrato_tarifas set orden_compra_id = pruebas.id('oc_1')
    where contrato_id = pruebas.id('contrato_2')$$, '23503', null,
  'una tarifa no puede usar la OC de otro contrato'
);
select throws_ok(
  $$insert into public.ordenes_compra (contrato_id, numero) values (pruebas.id('contrato_1'), ' 5300402443 ')$$,
  '23505', null, 'no se repite el número de OC dentro del contrato'
);
select lives_ok(
  $$insert into public.ordenes_compra (contrato_id, numero) values (pruebas.id('contrato_2'), '5300402443')$$,
  'el mismo número puede existir en otro contrato, y el monto es opcional'
);
select throws_ok(
  $$insert into public.ordenes_compra (contrato_id, numero, monto) values (pruebas.id('contrato_1'), 'X-1', -1)$$,
  '23514', null, 'el monto no puede ser negativo'
);
select throws_ok(
  $$insert into public.ordenes_compra (contrato_id, numero, fecha_inicio, fecha_termino)
    values (pruebas.id('contrato_1'), 'X-2', '2027-01-01', '2026-01-01')$$,
  '23514', null, 'el término no puede ser anterior al inicio'
);
select throws_ok(
  $$delete from public.ordenes_compra where id = pruebas.id('oc_1')$$, '42501', null,
  'nadie borra una orden de compra: se marca con deleted_at'
);

-- Bitácora y Dirección --------------------------------------------------------
select pruebas.entrar('direccion');
select cmp_ok(
  (select count(*)::int from public.bitacora where tabla = 'ordenes_compra'), '>=', 2,
  'las órdenes de compra quedan en la bitácora'
);
with c as (update public.ordenes_compra set monto = 42000 where id = pruebas.id('oc_1') returning 1)
select is((select count(*)::int from c), 1, 'dirección edita órdenes de compra');

-- Quién ve -------------------------------------------------------------------
select pruebas.entrar('comercial');
select is(
  (select count(*)::int from public.ordenes_compra where contrato_id = pruebas.id('contrato_1')), 1,
  'comercial consulta las órdenes de compra'
);
select throws_ok(
  $$insert into public.ordenes_compra (contrato_id, numero) values (pruebas.id('contrato_1'), 'X-3')$$,
  '42501', null, 'comercial no registra órdenes de compra'
);
with c as (update public.ordenes_compra set notas = 'x' where id = pruebas.id('oc_1') returning 1)
select is((select count(*)::int from c), 0, 'comercial no edita órdenes de compra');

select pruebas.entrar('tecnico');
select is((select count(*)::int from public.ordenes_compra), 0, 'técnico no ve órdenes de compra');
select pruebas.entrar('laboratorio');
select is((select count(*)::int from public.ordenes_compra), 0, 'laboratorio no ve órdenes de compra');
select pruebas.entrar('cliente');
select is((select count(*)::int from public.ordenes_compra), 0, 'cliente no ve órdenes de compra');

select * from finish();
rollback;
