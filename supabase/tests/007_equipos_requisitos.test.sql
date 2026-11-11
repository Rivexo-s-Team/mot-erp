-- Equipos del cliente, su costo de aceite (precio) y requisitos de planta.
begin;
select plan(22);

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
insert into public.plantas (id, cuenta_id, nombre)
  values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', 'Planta Uno');
insert into public.equipos_cliente (id, planta_id, identificador, volumen_reservorio_l, toma_muestras)
  values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000a1', 'EQ-1', 280, 'mot'),
         ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000a1', 'EQ-2', 100, null);
insert into public.equipos_cliente_costos (equipo_cliente_id, costo_aceite_virgen, moneda)
  values ('00000000-0000-0000-0000-0000000000e1', 5.20, 'USD');
insert into public.requisitos_planta (planta_id, categoria, nombre)
  values ('00000000-0000-0000-0000-0000000000a1', 'acceso_planta', 'REPSE');

-- Reglas de datos -----------------------------------------------------------
select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity),
  0, 'todas las tablas de public tienen RLS activado'
);
select col_type_is('public', 'equipos_cliente_costos', 'costo_aceite_virgen', 'numeric', 'el costo es numeric');
select col_not_null('public', 'equipos_cliente_costos', 'moneda', 'todo costo lleva moneda');
select throws_ok(
  $$update public.equipos_cliente set toma_muestras = 'nadie' where identificador = 'EQ-1'$$,
  '23514', null, 'las muestras las toma MOT o el cliente'
);
select throws_ok(
  $$insert into public.requisitos_planta (planta_id, categoria, nombre)
    values ('00000000-0000-0000-0000-0000000000a1', 'otra', 'X')$$,
  '23514', null, 'la categoría del requisito debe ser una de las definidas'
);
select throws_ok(
  $$insert into public.equipos_cliente (planta_id, identificador)
    values ('00000000-0000-0000-0000-0000000000a1', ' eq-1 ')$$,
  '23505', null, 'no se repite el identificador en una planta (sin distinguir mayúsculas)'
);

-- Precios: quién ve el costo -------------------------------------------------
select pruebas.entrar('tecnico');
select cmp_ok(pruebas.cuenta('equipos_cliente'), '>=', 2, 'técnico ve los equipos');
select is(pruebas.cuenta('equipos_cliente_costos'), 0, 'técnico NO ve el costo del aceite');
select cmp_ok(pruebas.cuenta('requisitos_planta'), '>=', 1, 'técnico ve los requisitos de planta');
select pruebas.entrar('laboratorio');
select is(pruebas.cuenta('equipos_cliente_costos'), 0, 'laboratorio NO ve el costo del aceite');
select pruebas.entrar('cliente');
select is(pruebas.cuenta('equipos_cliente_costos'), 0, 'cliente no ve el costo del aceite');
select is(pruebas.cuenta('requisitos_planta'), 0, 'cliente no ve los requisitos');
select pruebas.entrar('administracion');
select is(pruebas.cuenta('equipos_cliente_costos'), 1, 'administración ve el costo del aceite');

-- Quién edita ----------------------------------------------------------------
with c as (update public.equipos_cliente_costos set costo_aceite_virgen = 1 returning 1)
select is((select count(*)::int from c), 0, 'administración ve el costo pero no lo cambia');
select throws_ok(
  $$insert into public.requisitos_planta (planta_id, categoria, nombre)
    values ('00000000-0000-0000-0000-0000000000a1', 'acceso_planta', 'EPP')$$,
  '42501', null, 'administración no agrega requisitos'
);

select pruebas.entrar('tecnico');
select throws_ok(
  $$insert into public.equipos_cliente_costos (equipo_cliente_id, costo_aceite_virgen, moneda)
    values ('00000000-0000-0000-0000-0000000000e2', 3, 'USD')$$,
  '42501', null, 'técnico no captura costos'
);

select pruebas.entrar('comercial');
select lives_ok(
  $$insert into public.equipos_cliente_costos (equipo_cliente_id, costo_aceite_virgen, moneda)
    values ('00000000-0000-0000-0000-0000000000e2', 100, 'MXN')$$,
  'comercial captura el costo de un equipo'
);
with c as (
  update public.equipos_cliente_costos set costo_aceite_virgen = 5.50
  where equipo_cliente_id = '00000000-0000-0000-0000-0000000000e1' returning 1
)
select is((select count(*)::int from c), 1, 'comercial cambia el costo');
select lives_ok(
  $$insert into public.requisitos_planta (planta_id, categoria, nombre, detalle)
    values ('00000000-0000-0000-0000-0000000000a1', 'alta_proveedor', 'Opinión de cumplimiento', 'Vigente')$$,
  'comercial agrega un requisito'
);
with c as (
  update public.equipos_cliente
  set marca = 'Prensa X', numero_contenedores = 2, volumen_contenedor_l = 1000, temperatura_operacion_c = 45.5
  where identificador = 'EQ-1' returning 1
)
select is((select count(*)::int from c), 1, 'comercial completa los datos del equipo');

-- Bitácora de precios --------------------------------------------------------
select pruebas.entrar('direccion');
select is(
  (select (datos_anteriores ->> 'costo_aceite_virgen') || ' -> ' || (datos_nuevos ->> 'costo_aceite_virgen')
     from public.bitacora where tabla = 'equipos_cliente_costos' and operacion = 'UPDATE'),
  '5.20 -> 5.50', 'el cambio de costo queda en la bitácora con el antes y el después'
);
select is(
  (select usuario_id from public.bitacora
    where tabla = 'equipos_cliente_costos' and operacion = 'UPDATE'),
  (select id from pruebas.u where rol = 'comercial'),
  'la bitácora registra quién cambió el costo'
);

select * from finish();
rollback;
