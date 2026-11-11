-- Expediente del cliente: razones sociales y contactos.
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

-- Dos cuentas de prueba, cada una con planta y razón social.
insert into public.cuentas (id, nombre) values
  ('00000000-0000-0000-0000-0000000000c1', 'Cuenta Uno'),
  ('00000000-0000-0000-0000-0000000000c2', 'Cuenta Dos');
insert into public.plantas (id, cuenta_id, nombre) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', 'Planta Uno'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000c2', 'Planta Dos');
insert into public.razones_sociales (id, cuenta_id, razon_social, rfc) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c1', 'Uno, S.A. de C.V.', 'UNO010101AB1'),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000c2', 'Dos, S.A. de C.V.', 'DOS020202CD2');
insert into public.contactos (cuenta_id, planta_id, nombre, area) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', 'Contacto Uno', 'compras');

-- Reglas de datos -----------------------------------------------------------
select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity),
  0, 'todas las tablas de public tienen RLS activado'
);
select throws_ok(
  $$insert into public.razones_sociales (cuenta_id, razon_social, rfc)
    values ('00000000-0000-0000-0000-0000000000c1', 'Mala', 'rfc-malo')$$,
  '23514', null, 'el RFC debe tener formato válido'
);
select throws_ok(
  $$insert into public.razones_sociales (cuenta_id, razon_social, rfc)
    values ('00000000-0000-0000-0000-0000000000c1', 'Repetida', 'UNO010101AB1')$$,
  '23505', null, 'no se repite el RFC dentro de una cuenta'
);
select throws_ok(
  $$update public.plantas set razon_social_id = '00000000-0000-0000-0000-0000000000f2'
    where id = '00000000-0000-0000-0000-0000000000a1'$$,
  '23503', null, 'una planta no puede facturarse a la razón social de otra cuenta'
);
select lives_ok(
  $$update public.plantas set razon_social_id = '00000000-0000-0000-0000-0000000000f1'
    where id = '00000000-0000-0000-0000-0000000000a1'$$,
  'una planta sí puede usar una razón social de su cuenta'
);
select throws_ok(
  $$insert into public.contactos (cuenta_id, planta_id, nombre, area)
    values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a2', 'X', 'compras')$$,
  '23503', null, 'un contacto no puede quedar en la planta de otra cuenta'
);
select throws_ok(
  $$insert into public.contactos (cuenta_id, nombre, area)
    values ('00000000-0000-0000-0000-0000000000c1', 'X', 'ventas')$$,
  '23514', null, 'el área del contacto debe ser una de las definidas'
);
select throws_ok(
  $$insert into public.cuentas (nombre) values ('  cuenta uno ')$$,
  '23505', null, 'no hay dos cuentas vigentes con el mismo nombre (sin distinguir mayúsculas)'
);
update public.cuentas set deleted_at = now() where id = '00000000-0000-0000-0000-0000000000c2';
select lives_ok(
  $$insert into public.cuentas (nombre) values ('Cuenta Dos')$$,
  'el nombre de una cuenta borrada se puede volver a usar'
);

-- Quién ve -------------------------------------------------------------------
select pruebas.entrar('tecnico');
select cmp_ok(pruebas.cuenta('contactos'), '>=', 1, 'técnico ve contactos');
select cmp_ok(pruebas.cuenta('razones_sociales'), '>=', 2, 'técnico ve razones sociales');
select pruebas.entrar('cliente');
select is(pruebas.cuenta('contactos'), 0, 'cliente no ve contactos');
select is(pruebas.cuenta('razones_sociales'), 0, 'cliente no ve razones sociales');

-- Quién edita ----------------------------------------------------------------
select pruebas.entrar('tecnico');
select throws_ok(
  $$insert into public.contactos (cuenta_id, nombre, area)
    values ('00000000-0000-0000-0000-0000000000c1', 'X', 'compras')$$,
  '42501', null, 'técnico no agrega contactos'
);
with c as (update public.razones_sociales set notas = 'x' returning 1)
select is((select count(*)::int from c), 0, 'técnico no edita razones sociales');

select pruebas.entrar('laboratorio');
with c as (update public.contactos set notas = 'x' returning 1)
select is((select count(*)::int from c), 0, 'laboratorio no edita contactos');

select pruebas.entrar('administracion');
select lives_ok(
  $$insert into public.razones_sociales (cuenta_id, razon_social, rfc, regimen_fiscal, codigo_postal_fiscal, uso_cfdi)
    values ('00000000-0000-0000-0000-0000000000c1', 'Tres, S.A. de C.V.', 'TRE030303EF3', '601', '76800', 'G03')$$,
  'administración agrega una razón social'
);
select throws_ok(
  $$insert into public.contactos (cuenta_id, nombre, area)
    values ('00000000-0000-0000-0000-0000000000c1', 'X', 'compras')$$,
  '42501', null, 'administración no agrega contactos'
);

select pruebas.entrar('comercial');
select lives_ok(
  $$insert into public.contactos (cuenta_id, nombre, area, correo, recibe_facturas)
    values ('00000000-0000-0000-0000-0000000000c1', 'Compras Uno', 'cuentas_por_pagar', 'cxp@uno.test', true)$$,
  'comercial agrega un contacto'
);
with c as (
  update public.contactos set deleted_at = now() where nombre = 'Compras Uno' returning 1
)
select is((select count(*)::int from c), 1, 'comercial puede marcar un contacto como borrado');
with c as (
  update public.razones_sociales set usa_portal_proveedores = true
  where id = '00000000-0000-0000-0000-0000000000f1' returning 1
)
select is((select count(*)::int from c), 1, 'comercial edita razones sociales');
select throws_ok(
  $$delete from public.contactos$$, '42501', null, 'nadie borra contactos: se marcan con deleted_at'
);

-- Bitácora -------------------------------------------------------------------
select pruebas.entrar('direccion');
select is(
  (select count(*)::int from public.bitacora
    where tabla = 'razones_sociales' and operacion = 'UPDATE'),
  1, 'el cambio a una razón social queda en la bitácora'
);
select is(
  (select usuario_id from public.bitacora
    where tabla = 'razones_sociales' and operacion = 'UPDATE'),
  (select id from pruebas.u where rol = 'comercial'),
  'la bitácora registra quién cambió la razón social'
);

select * from finish();
rollback;
