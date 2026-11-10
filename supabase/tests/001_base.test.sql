begin;
select plan(15);

-- Estructura y seguridad -----------------------------------------------------
select has_table('public', 'bitacora', 'existe bitacora');
select has_table('public', 'parametros_negocio', 'existe parametros_negocio');

select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity),
  0,
  'todas las tablas de public tienen RLS activado'
);

select col_type_is('public', 'parametros_negocio', 'valor', 'numeric', 'los valores son numeric, no float');

-- Parámetros iniciales -------------------------------------------------------
select is(
  (select valor from public.parametros_negocio where clave = 'cotizador_porcentaje_aceite_nuevo'),
  0.70::numeric, 'porcentaje del cotizador = 70 %'
);
select is(
  (select valor::text || ' ' || moneda from public.parametros_negocio where clave = 'cotizador_piso_precio_litro'),
  '2.50 USD', 'piso del cotizador = 2.50 USD'
);

-- Bitácora y columnas automáticas -------------------------------------------
select is(
  (select count(*)::int from public.bitacora where tabla = 'parametros_negocio' and operacion = 'INSERT'),
  (select count(*)::int from public.parametros_negocio),
  'cada parámetro inicial quedó en la bitácora'
);

update public.parametros_negocio
  set valor = 0.65, updated_at = '2000-01-01'
  where clave = 'cotizador_porcentaje_aceite_nuevo';

select is(
  (select (datos_anteriores ->> 'valor') || ' -> ' || (datos_nuevos ->> 'valor')
     from public.bitacora
    where tabla = 'parametros_negocio' and operacion = 'UPDATE'),
  '0.70 -> 0.65', 'la bitácora guarda el antes y el después'
);
select cmp_ok(
  (select updated_at from public.parametros_negocio where clave = 'cotizador_porcentaje_aceite_nuevo'),
  '>', '2001-01-01'::timestamptz, 'updated_at se actualiza solo'
);

update public.parametros_negocio set valor = valor where clave = 'cotizador_piso_precio_litro';
select is(
  (select count(*)::int from public.bitacora where operacion = 'UPDATE'),
  1, 'un cambio que no cambia nada no se registra'
);

-- Sin roles todavía, nadie entra desde la app -------------------------------
set local role anon;
select throws_ok(
  'select count(*) from public.parametros_negocio', '42501', null, 'anónimo no puede consultar parámetros'
);
select throws_ok(
  'select count(*) from public.bitacora', '42501', null, 'anónimo no puede consultar la bitácora'
);
reset role;

set local role authenticated;
select is((select count(*)::int from public.parametros_negocio), 0, 'usuario sin rol no ve parámetros');
select is((select count(*)::int from public.bitacora), 0, 'usuario sin rol no ve la bitácora');
select throws_ok(
  $$insert into public.bitacora (tabla, registro_id, operacion) values ('x', gen_random_uuid(), 'INSERT')$$,
  '42501', null, 'nadie escribe en la bitácora directamente'
);
reset role;

select * from finish();
rollback;
