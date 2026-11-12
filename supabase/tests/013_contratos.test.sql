-- Contratos y tarifas: todos los internos ven el contrato; los precios, solo
-- quien tiene precios.ver; editan Dirección y Administración.
begin;
select plan(27);

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

-- Dos cuentas con su planta, para probar que no se mezclan.
create table pruebas.d (clave text primary key, id uuid);
grant select on pruebas.d to authenticated;
with c as (insert into public.cuentas (nombre) values ('ZZ Contratos A') returning id)
insert into pruebas.d select 'cuenta_a', id from c;
with c as (insert into public.cuentas (nombre) values ('ZZ Contratos B') returning id)
insert into pruebas.d select 'cuenta_b', id from c;
with p as (insert into public.plantas (cuenta_id, nombre)
  select id, 'Planta A' from pruebas.d where clave = 'cuenta_a' returning id)
insert into pruebas.d select 'planta_a', id from p;
with p as (insert into public.plantas (cuenta_id, nombre)
  select id, 'Planta B' from pruebas.d where clave = 'cuenta_b' returning id)
insert into pruebas.d select 'planta_b', id from p;
with e as (insert into public.equipos_cliente (planta_id, identificador)
  select id, 'EQ-A' from pruebas.d where clave = 'planta_a' returning id)
insert into pruebas.d select 'equipo_a', id from e;
with e as (insert into public.equipos_cliente (planta_id, identificador)
  select id, 'EQ-B' from pruebas.d where clave = 'planta_b' returning id)
insert into pruebas.d select 'equipo_b', id from e;
with o as (insert into public.oportunidades (cuenta_id, nombre, responsable_id, tipo, origen, etapa)
  select d.id, 'Renta de prueba', u.id, 'nuevo', 'prospeccion', 'ganada'
  from pruebas.d d, pruebas.u u where d.clave = 'cuenta_a' and u.rol = 'comercial' returning id)
insert into pruebas.d select 'oportunidad_a', id from o;

with o as (insert into public.oportunidades (cuenta_id, nombre, responsable_id, tipo, origen, etapa)
  select d.id, 'Otra renta de prueba', u.id, 'nuevo', 'prospeccion', 'ganada'
  from pruebas.d d, pruebas.u u where d.clave = 'cuenta_a' and u.rol = 'comercial' returning id)
insert into pruebas.d select 'oportunidad_a2', id from o;

create function pruebas.id(p_clave text) returns uuid language sql stable as
  $$select id from pruebas.d where clave = p_clave$$;
grant execute on all functions in schema pruebas to authenticated;

-- Quién edita ----------------------------------------------------------------
select pruebas.entrar('administracion');
select lives_ok(
  $$insert into public.contratos (cuenta_id, planta_id, tipo, estado, fecha_inicio, fecha_termino, oportunidad_id)
    values (pruebas.id('cuenta_a'), pruebas.id('planta_a'), 'renta', 'vigente', '2024-04-01', '2027-03-31',
            pruebas.id('oportunidad_a'))$$,
  'administración crea un contrato'
);
select set_config('role', 'postgres', true);
insert into pruebas.d select 'contrato_a', id from public.contratos where cuenta_id = pruebas.id('cuenta_a');
select pruebas.entrar('administracion');
select is(
  (select moneda from public.contratos where id = pruebas.id('contrato_a')), 'USD',
  'el contrato nace en USD'
);
select lives_ok(
  $$insert into public.contrato_tarifas (contrato_id, planta_id, concepto, unidad, precio, equipo_cliente_id)
    values (pruebas.id('contrato_a'), pruebas.id('planta_a'), 'Renta mensual Robox 1', 'mes', 289, pruebas.id('equipo_a')),
           (pruebas.id('contrato_a'), pruebas.id('planta_a'), 'Renta mensual Robox 2', 'mes', 300, null),
           (pruebas.id('contrato_a'), pruebas.id('planta_a'), 'Instalación', 'unico', 500, null)$$,
  'administración captura las tarifas'
);
select is(
  (select total_mensual from public.contrato_totales where contrato_id = pruebas.id('contrato_a')),
  589::numeric, 'el total mensual suma solo las tarifas por mes'
);
select is(
  (select total_unico from public.contrato_totales where contrato_id = pruebas.id('contrato_a')),
  500::numeric, 'los pagos de una sola vez se suman aparte'
);

-- Reglas de datos -----------------------------------------------------------
select throws_ok(
  $$insert into public.contratos (cuenta_id, planta_id, tipo)
    values (pruebas.id('cuenta_a'), pruebas.id('planta_b'), 'renta')$$, '23503', null,
  'la planta debe ser de la misma cuenta'
);
select throws_ok(
  $$insert into public.contratos (cuenta_id, planta_id, tipo)
    values (pruebas.id('cuenta_a'), pruebas.id('planta_a'), 'prueba_tecnologica')$$, '23514', null,
  'la prueba tecnológica no es un tipo de contrato (D14)'
);
select throws_ok(
  $$insert into public.contratos (cuenta_id, planta_id, tipo, fecha_inicio, fecha_termino)
    values (pruebas.id('cuenta_a'), pruebas.id('planta_a'), 'renta', '2026-01-01', '2025-01-01')$$, '23514', null,
  'el término no puede ser anterior al inicio'
);
select throws_ok(
  $$insert into public.contratos (cuenta_id, planta_id, tipo, oportunidad_id)
    values (pruebas.id('cuenta_a'), pruebas.id('planta_a'), 'renta', pruebas.id('oportunidad_a'))$$, '23505', null,
  'una oportunidad no da lugar a dos contratos'
);
select throws_ok(
  $$insert into public.contratos (cuenta_id, planta_id, tipo, oportunidad_id)
    values (pruebas.id('cuenta_b'), pruebas.id('planta_b'), 'renta', pruebas.id('oportunidad_a2'))$$, '23503', null,
  'la oportunidad debe ser de la misma cuenta'
);
select throws_ok(
  $$insert into public.contratos (cuenta_id, planta_id, tipo, contrato_origen_id)
    values (pruebas.id('cuenta_b'), pruebas.id('planta_b'), 'renta', pruebas.id('contrato_a'))$$, '23503', null,
  'una ampliación debe ser de la misma cuenta que su contrato de origen'
);
select lives_ok(
  $$insert into public.contratos (cuenta_id, planta_id, tipo, contrato_origen_id)
    values (pruebas.id('cuenta_a'), pruebas.id('planta_a'), 'renta', pruebas.id('contrato_a'))$$,
  'una ampliación apunta a su contrato de origen'
);
select throws_ok(
  $$insert into public.contrato_tarifas (contrato_id, planta_id, concepto, unidad, precio, equipo_cliente_id)
    values (pruebas.id('contrato_a'), pruebas.id('planta_a'), 'Renta', 'mes', 100, pruebas.id('equipo_b'))$$,
  '23503', null, 'el equipo de una tarifa debe ser de la planta del contrato'
);
select throws_ok(
  $$insert into public.contrato_tarifas (contrato_id, planta_id, concepto, unidad, precio)
    values (pruebas.id('contrato_a'), pruebas.id('planta_b'), 'Renta', 'mes', 100)$$,
  '23503', null, 'la tarifa lleva la planta de su contrato'
);
select throws_ok(
  $$insert into public.contrato_tarifas (contrato_id, planta_id, concepto, unidad, precio)
    values (pruebas.id('contrato_a'), pruebas.id('planta_a'), 'Renta', 'mes', -1)$$,
  '23514', null, 'el precio no puede ser negativo'
);
select throws_ok(
  $$delete from public.contratos where id = pruebas.id('contrato_a')$$, '42501', null,
  'nadie borra un contrato: se marca con deleted_at'
);

-- Bitácora -------------------------------------------------------------------
update public.contrato_tarifas set precio = 295 where concepto = 'Renta mensual Robox 1';
select pruebas.entrar('direccion');
select cmp_ok(
  (select count(*)::int from public.bitacora where tabla = 'contrato_tarifas'), '>=', 4,
  'las altas y el cambio de precio quedan en la bitácora'
);
select cmp_ok(
  (select count(*)::int from public.bitacora where tabla = 'contratos'), '>=', 1,
  'el alta del contrato queda en la bitácora'
);
with c as (update public.contratos set estado = 'terminado' where id = pruebas.id('contrato_a') returning 1)
select is((select count(*)::int from c), 1, 'dirección edita contratos');

-- Quién ve -------------------------------------------------------------------
select pruebas.entrar('comercial');
select is((select count(*)::int from public.contratos where cuenta_id = pruebas.id('cuenta_a')), 2,
  'comercial consulta los contratos');
select is((select count(*)::int from public.contrato_tarifas where contrato_id = pruebas.id('contrato_a')), 3,
  'comercial ve las tarifas');
with c as (update public.contratos set notas = 'x' where id = pruebas.id('contrato_a') returning 1)
select is((select count(*)::int from c), 0, 'comercial no edita contratos');
select throws_ok(
  $$insert into public.contrato_tarifas (contrato_id, planta_id, concepto, unidad, precio)
    values (pruebas.id('contrato_a'), pruebas.id('planta_a'), 'Renta', 'mes', 1)$$, '42501', null,
  'comercial no captura tarifas'
);

select pruebas.entrar('tecnico');
select is((select count(*)::int from public.contratos where cuenta_id = pruebas.id('cuenta_a')), 2,
  'técnico consulta los contratos');
select is((select count(*)::int from public.contrato_tarifas), 0, 'técnico no ve precios');
select is(
  (select total_mensual from public.contrato_totales where contrato_id = pruebas.id('contrato_a')),
  0::numeric, 'técnico tampoco ve el total mensual'
);

select pruebas.entrar('cliente');
select is((select count(*)::int from public.contratos), 0, 'cliente no ve contratos');

select * from finish();
rollback;
