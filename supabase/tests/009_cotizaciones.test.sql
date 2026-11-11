-- Cotizaciones: son precios. Ver = pipeline + precios.
begin;
select plan(24);

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

create function pruebas.cuenta(p_tabla text) returns int language plpgsql as $$
declare n int;
begin
  execute format('select count(*) from public.%I', p_tabla) into n;
  return n;
end $$;

insert into public.cuentas (id, nombre) values ('00000000-0000-0000-0000-0000000000c1', 'Cuenta Uno');
insert into public.oportunidades (id, cuenta_id, nombre, responsable_id, tipo, origen)
select '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', 'Oportunidad Uno',
       id, 'nuevo', 'prospeccion'
from pruebas.u where rol = 'comercial';
insert into public.cotizaciones (id, oportunidad_id, version)
  values ('00000000-0000-0000-0000-000000000071', '00000000-0000-0000-0000-0000000000b1', 1);
insert into public.cotizacion_lineas (cotizacion_id, concepto, cantidad, unidad, precio_unitario, recurrente)
values
  ('00000000-0000-0000-0000-000000000071', 'Limpieza por litro', 280, 'litro', 3.64, false),
  ('00000000-0000-0000-0000-000000000071', 'Renta mensual Robox', 1, 'mes', 1500, true),
  ('00000000-0000-0000-0000-000000000071', 'Análisis de laboratorio', 2, 'servicio', 120.555, false);

-- Reglas de datos -----------------------------------------------------------
select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity),
  0, 'todas las tablas de public tienen RLS activado'
);
select col_type_is('public', 'cotizacion_lineas', 'precio_unitario', 'numeric', 'el precio es numeric');
select col_not_null('public', 'cotizaciones', 'moneda', 'toda cotización lleva moneda');
select is(
  (select moneda from public.cotizaciones where id = '00000000-0000-0000-0000-000000000071'),
  'USD', 'la moneda por defecto es USD'
);
select is(
  (select importe from public.cotizacion_lineas where concepto = 'Limpieza por litro'),
  1019.20::numeric, 'el importe de la partida es cantidad × precio'
);
select is(
  (select total_unico::text || ' / ' || total_recurrente::text || ' / ' || partidas
     from public.cotizacion_totales where cotizacion_id = '00000000-0000-0000-0000-000000000071'),
  '1260.31 / 1500.00 / 3', 'los totales separan lo único de lo recurrente'
);
select throws_ok(
  $$insert into public.cotizaciones (oportunidad_id, version, moneda)
    values ('00000000-0000-0000-0000-0000000000b1', 2, 'MXN')$$,
  '23514', null, 'una cotización que no es en USD exige tipo de cambio'
);
select throws_ok(
  $$insert into public.cotizaciones (oportunidad_id, version)
    values ('00000000-0000-0000-0000-0000000000b1', 1)$$,
  '23505', null, 'no se repite la versión dentro de una oportunidad'
);
select throws_ok(
  $$insert into public.cotizacion_lineas (cotizacion_id, concepto, cantidad, unidad, precio_unitario)
    values ('00000000-0000-0000-0000-000000000071', 'X', 1, 'kilo', 1)$$,
  '23514', null, 'la unidad debe ser litro, mes, evento o servicio'
);

-- Quién ve: es un precio ------------------------------------------------------
select pruebas.entrar('comercial');
select is(
  (select count(*)::int from public.cotizaciones where id = '00000000-0000-0000-0000-000000000071'),
  1, 'comercial ve la cotización'
);
select is(
  (select count(*)::int from public.cotizacion_lineas
    where cotizacion_id = '00000000-0000-0000-0000-000000000071'),
  3, 'comercial ve las partidas'
);
select pruebas.entrar('administracion');
select is(pruebas.cuenta('cotizaciones'), 0, 'administración no ve cotizaciones (no ve el pipeline)');
select pruebas.entrar('tecnico');
select is(pruebas.cuenta('cotizaciones'), 0, 'técnico no ve cotizaciones');
select is(pruebas.cuenta('cotizacion_lineas'), 0, 'técnico no ve partidas');
select is(pruebas.cuenta('cotizacion_totales'), 0, 'técnico no ve los totales');
select pruebas.entrar('laboratorio');
select is(pruebas.cuenta('cotizacion_lineas'), 0, 'laboratorio no ve partidas');
select pruebas.entrar('cliente');
select is(pruebas.cuenta('cotizaciones'), 0, 'cliente no ve cotizaciones');

-- Quién edita y bloqueo al enviar ------------------------------------------
select pruebas.entrar('tecnico');
select throws_ok(
  $$insert into public.cotizacion_lineas (cotizacion_id, concepto, cantidad, unidad, precio_unitario)
    values ('00000000-0000-0000-0000-000000000071', 'X', 1, 'litro', 1)$$,
  '42501', null, 'técnico no agrega partidas'
);

select pruebas.entrar('comercial');
with c as (
  update public.cotizacion_lineas set precio_unitario = 3.50 where concepto = 'Limpieza por litro' returning 1
)
select is((select count(*)::int from c), 1, 'comercial cambia un precio en borrador');
update public.cotizaciones set estado = 'enviada' where id = '00000000-0000-0000-0000-000000000071';
select throws_ok(
  $$update public.cotizacion_lineas set precio_unitario = 1 where concepto = 'Limpieza por litro'$$,
  'P0001', null, 'una cotización enviada ya no deja cambiar sus partidas'
);
select throws_ok(
  $$update public.cotizaciones set notas = 'cambio' where id = '00000000-0000-0000-0000-000000000071'$$,
  'P0001', null, 'ni sus datos'
);
select lives_ok(
  $$insert into public.cotizaciones (oportunidad_id, version)
    values ('00000000-0000-0000-0000-0000000000b1', 2)$$,
  'los cambios van en una versión nueva'
);

-- Bitácora de precios --------------------------------------------------------
select pruebas.entrar('direccion');
select is(
  (select (datos_anteriores ->> 'precio_unitario') || ' -> ' || (datos_nuevos ->> 'precio_unitario')
     from public.bitacora where tabla = 'cotizacion_lineas' and operacion = 'UPDATE'),
  '3.64 -> 3.50', 'el cambio de precio queda en la bitácora'
);
select is(
  (select usuario_id from public.bitacora where tabla = 'cotizacion_lineas' and operacion = 'UPDATE'),
  (select id from pruebas.u where rol = 'comercial'),
  'con quién lo cambió'
);

select * from finish();
rollback;
