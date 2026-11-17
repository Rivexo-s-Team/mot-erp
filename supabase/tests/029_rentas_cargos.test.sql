-- Rentas como cargos: una por tarifa mensual de contrato vigente y por mes,
-- sin duplicar, y solo para quien captura cargos y ve precios.
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
with c as (insert into public.cuentas (nombre) values ('ZZ Rentas') returning id)
insert into pruebas.d select 'cuenta', id from c;
with p as (insert into public.plantas (cuenta_id, nombre) values (pruebas.id('cuenta'), 'Planta') returning id)
insert into pruebas.d select 'planta', id from p;
-- Vigente todo 2037; vigente que empieza a media mes; borrador; terminado en febrero.
with k as (insert into public.contratos (cuenta_id, planta_id, tipo, estado, fecha_inicio, fecha_termino, moneda)
  values (pruebas.id('cuenta'), pruebas.id('planta'), 'renta', 'vigente', '2037-01-01', '2037-12-31', 'USD') returning id)
insert into pruebas.d select 'anual', id from k;
with k as (insert into public.contratos (cuenta_id, planta_id, tipo, estado, fecha_inicio, moneda)
  values (pruebas.id('cuenta'), pruebas.id('planta'), 'renta', 'vigente', '2037-03-15', 'MXN') returning id)
insert into pruebas.d select 'media', id from k;
with k as (insert into public.contratos (cuenta_id, planta_id, tipo, estado, fecha_inicio)
  values (pruebas.id('cuenta'), pruebas.id('planta'), 'renta', 'borrador', '2037-01-01') returning id)
insert into pruebas.d select 'borrador', id from k;
with k as (insert into public.contratos (cuenta_id, planta_id, tipo, estado, fecha_inicio, fecha_termino)
  values (pruebas.id('cuenta'), pruebas.id('planta'), 'renta', 'vigente', '2036-01-01', '2037-02-10') returning id)
insert into pruebas.d select 'termina', id from k;
with o as (insert into public.ordenes_compra (contrato_id, numero)
  values (pruebas.id('anual'), 'OC-ZZ-1') returning id)
insert into pruebas.d select 'oc', id from o;
insert into public.contrato_tarifas (contrato_id, planta_id, concepto, unidad, precio, orden, orden_compra_id) values
  (pruebas.id('anual'), pruebas.id('planta'), 'Renta Robox 1', 'mes', 300, 1, pruebas.id('oc')),
  (pruebas.id('anual'), pruebas.id('planta'), 'Renta Robox 2', 'mes', 289.50, 2, null),
  (pruebas.id('anual'), pruebas.id('planta'), 'Instalación', 'unico', 1000, 3, null),
  (pruebas.id('media'), pruebas.id('planta'), 'Renta Robox 3', 'mes', 5000, 1, null),
  (pruebas.id('borrador'), pruebas.id('planta'), 'Renta borrador', 'mes', 1, 1, null),
  (pruebas.id('termina'), pruebas.id('planta'), 'Renta Robox 4', 'mes', 100, 1, null);
create function pruebas.zz(p date) returns setof record language sql stable as
  $$select concepto, parcial, cargo_id is not null from public.rentas_del_mes(p) where cuenta = 'ZZ Rentas'$$;
grant execute on all functions in schema pruebas to authenticated;

select pruebas.entrar('administracion');
select is(
  (select count(*)::int from public.rentas_del_mes('2037-01-15') where cuenta = 'ZZ Rentas'), 3,
  'enero: las tarifas mensuales de los contratos vigentes (no el borrador, no los pagos únicos)'
);
select is(
  (select string_agg(concepto || ':' || parcial, ', ' order by concepto)
   from public.rentas_del_mes('2037-03-01') where cuenta = 'ZZ Rentas'),
  'Renta Robox 1:false, Renta Robox 2:false, Renta Robox 3:true',
  'marzo: entra el contrato que empieza a medio mes, marcado como mes incompleto; ya no el que terminó'
);
select is(
  (select parcial from public.rentas_del_mes('2037-02-01') where concepto = 'Renta Robox 4'), true,
  'febrero: el contrato que termina el día 10 también es mes incompleto'
);

select is(public.generar_rentas_mes('2037-03-20'), 3, 'genera un cargo por cada renta de marzo');
select is(
  (select row(tipo, concepto, cantidad, unidad, precio_unitario, importe, moneda, estado, periodo,
              orden_compra_id = pruebas.id('oc'), contrato_id = pruebas.id('anual'), notas)::text
   from public.cargos where tarifa_id is not null and concepto like 'Renta Robox 1%'),
  '(renta,"Renta Robox 1 · marzo de 2037",1,mes,300,300.00,USD,pendiente,2037-03-01,t,t,)',
  'el cargo dice el mes, toma precio y moneda del contrato, y la orden de compra de la tarifa'
);
select is(
  (select row(importe, moneda, notas)::text from public.cargos where concepto like 'Renta Robox 3%'),
  '(5000.00,MXN,"El contrato empieza o termina dentro de este mes: revisa si se cobra completo.")',
  'el mes incompleto se cobra completo y lo avisa'
);
select is(public.generar_rentas_mes('2037-03-01'), 0, 'pedirlo otra vez no duplica nada');
select is(
  (select count(*)::int from public.rentas_del_mes('2037-03-01') where cuenta = 'ZZ Rentas' and cargo_id is null), 0,
  'y la consulta ya las marca como generadas'
);
select is(public.generar_rentas_mes('2037-04-01'), 3, 'abril es otro mes');

-- Un cargo cancelado sigue contando; uno eliminado, no.
update public.cargos set estado = 'cancelado' where concepto = 'Renta Robox 1 · marzo de 2037';
select is(public.generar_rentas_mes('2037-03-01'), 0, 'una renta cancelada no se vuelve a generar sola');
update public.cargos set deleted_at = now() where concepto = 'Renta Robox 2 · marzo de 2037';
select is(public.generar_rentas_mes('2037-03-01'), 1, 'una eliminada sí se puede generar de nuevo');

select throws_ok(
  $$insert into public.cargos (cuenta_id, tipo, concepto, cantidad, precio_unitario)
    values (pruebas.id('cuenta'), 'renta', 'Renta a mano', 1, 1)$$,
  '23514', null, 'una renta siempre lleva su tarifa y su mes'
);
select throws_ok(
  $$insert into public.cargos (cuenta_id, tipo, concepto, cantidad, precio_unitario, periodo)
    values (pruebas.id('cuenta'), 'otro', 'Otro con mes', 1, 1, '2037-03-01')$$,
  '23514', null, 'y solo una renta los lleva'
);
select throws_ok(
  $$update public.cargos set periodo = '2037-03-15' where concepto like 'Renta Robox 3 · marzo%'$$,
  '23514', null, 'el periodo es siempre el primer día del mes'
);

select pruebas.entrar('direccion');
select is(public.generar_rentas_mes('2037-05-01'), 3, 'dirección también las genera');

select pruebas.entrar('comercial');
select throws_ok($$select public.generar_rentas_mes('2037-06-01')$$, '42501', null, 'comercial no las genera');
select cmp_ok(
  (select count(*)::int from public.rentas_del_mes('2037-06-01') where cuenta = 'ZZ Rentas'), '=', 3,
  'pero consulta las rentas del mes'
);

select pruebas.entrar('tecnico');
select throws_ok($$select public.generar_rentas_mes('2037-06-01')$$, '42501', null, 'el técnico no las genera');
select is(
  (select count(*)::int from public.rentas_del_mes('2037-03-01') where cargo_id is not null), 0,
  'ni ve qué cargos existen'
);

select * from finish();
rollback;
