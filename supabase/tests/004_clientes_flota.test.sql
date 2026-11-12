-- Clientes y flota: los internos consultan; edita solo quien tiene el permiso.
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

-- Datos propios de la prueba.
insert into public.cuentas (id, nombre) values ('00000000-0000-0000-0000-0000000000c1', 'Cuenta de prueba');
insert into public.plantas (id, cuenta_id, nombre)
  values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', 'Planta de prueba');
insert into public.equipos_cliente (planta_id, identificador, volumen_reservorio_l)
  values ('00000000-0000-0000-0000-0000000000a1', 'EQ-1', 100);
insert into public.robox (numero_serie) values ('PRUEBA-1');

select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity),
  0, 'todas las tablas de public tienen RLS activado'
);
select col_type_is('public', 'equipos_cliente', 'volumen_reservorio_l', 'numeric', 'el volumen es numeric');
select throws_ok(
  $$insert into public.robox (numero_serie, estado) values ('X', 'perdido')$$,
  '23514', null, 'el estado del Robox solo acepta los valores definidos'
);
select throws_ok(
  $$insert into public.equipos_cliente (planta_id, identificador)
    values ('00000000-0000-0000-0000-0000000000a1', 'EQ-1')$$,
  '23505', null, 'no se repite el identificador de equipo en una planta'
);

-- Quién ve -------------------------------------------------------------------
select pruebas.entrar('tecnico');
select cmp_ok(pruebas.cuenta('cuentas'), '>=', 1, 'técnico ve cuentas');
select cmp_ok(pruebas.cuenta('equipos_cliente'), '>=', 1, 'técnico ve equipos del cliente');
select cmp_ok(pruebas.cuenta('robox'), '>=', 1, 'técnico ve la flota');
select pruebas.entrar('laboratorio');
select cmp_ok(pruebas.cuenta('equipos_cliente'), '>=', 1, 'laboratorio ve equipos del cliente');
select pruebas.entrar('administracion');
select cmp_ok(pruebas.cuenta('plantas'), '>=', 1, 'administración ve plantas');

select pruebas.entrar('cliente');
select is(pruebas.cuenta('cuentas'), 0, 'cliente no ve cuentas');
select is(pruebas.cuenta('plantas'), 0, 'cliente no ve plantas');
select is(pruebas.cuenta('equipos_cliente'), 0, 'cliente no ve equipos');
select is(pruebas.cuenta('robox'), 0, 'cliente no ve la flota');

-- Quién edita ----------------------------------------------------------------
select pruebas.entrar('tecnico');
select throws_ok(
  $$insert into public.cuentas (nombre) values ('Inventada')$$, '42501', null, 'técnico no crea cuentas'
);
with c as (update public.robox set estado = 'baja' where numero_serie = 'PRUEBA-1' returning 1)
select is((select count(*)::int from c), 1, 'técnico edita la flota (lleva el inventario)');

select pruebas.entrar('comercial');
select lives_ok(
  $$insert into public.cuentas (nombre) values ('Prospecto nuevo')$$, 'comercial crea una cuenta'
);
select is(
  (select created_by from public.cuentas where nombre = 'Prospecto nuevo'),
  (select id from pruebas.u where rol = 'comercial'),
  'created_by se llena con quien la creó'
);
with c as (
  update public.equipos_cliente set alias = 'Tanque 1' where identificador = 'EQ-1' returning 1
)
select is((select count(*)::int from c), 1, 'comercial edita equipos del cliente');
with c as (
  update public.cuentas set deleted_at = now() where nombre = 'Prospecto nuevo' returning 1
)
select is((select count(*)::int from c), 1, 'comercial puede marcar una cuenta como borrada');
select throws_ok(
  $$insert into public.robox (numero_serie) values ('NO-PUEDE')$$, '42501', null, 'comercial no da de alta Robox'
);
select throws_ok(
  $$delete from public.cuentas$$, '42501', null, 'nadie borra cuentas: se marcan con deleted_at'
);

select pruebas.entrar('administracion');
with c as (update public.plantas set municipio = 'X' returning 1)
select is((select count(*)::int from c), 0, 'administración no edita plantas');

select pruebas.entrar('direccion');
select lives_ok(
  $$insert into public.robox (numero_serie, estado) values ('PRUEBA-2', 'en_taller')$$,
  'dirección da de alta un Robox'
);
with c as (update public.robox set estado = 'disponible' where numero_serie = 'PRUEBA-1' returning 1)
select is((select count(*)::int from c), 1, 'dirección edita la flota');

select * from finish();
rollback;
