-- Pipeline: oportunidades, actividades comerciales y canales de venta.
begin;
select plan(26);

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

insert into public.cuentas (id, nombre) values
  ('00000000-0000-0000-0000-0000000000c1', 'Cuenta Uno'),
  ('00000000-0000-0000-0000-0000000000c2', 'Cuenta Dos');
insert into public.plantas (id, cuenta_id, nombre) values
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000c2', 'Planta Dos');
insert into public.canales_venta (id, nombre) values ('00000000-0000-0000-0000-0000000000d1', 'Canal de prueba');
insert into public.oportunidades (id, cuenta_id, nombre, responsable_id, canal_venta_id, tipo, origen)
select '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', 'Oportunidad Uno',
       id, '00000000-0000-0000-0000-0000000000d1', 'nuevo', 'prospeccion'
from pruebas.u where rol = 'comercial';
grant select on pruebas.u to authenticated;

-- Reglas de datos -----------------------------------------------------------
select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity),
  0, 'todas las tablas de public tienen RLS activado'
);
select is(
  (select etapa from public.oportunidades where id = '00000000-0000-0000-0000-0000000000b1'),
  'primer_contacto', 'una oportunidad nueva empieza en primer contacto'
);
select throws_ok(
  $$update public.oportunidades set planta_id = '00000000-0000-0000-0000-0000000000a2'
    where id = '00000000-0000-0000-0000-0000000000b1'$$,
  '23503', null, 'la planta de la oportunidad debe ser de su misma cuenta'
);
select throws_ok(
  $$update public.oportunidades set etapa = 'negociacion' where id = '00000000-0000-0000-0000-0000000000b1'$$,
  '23514', null, 'la etapa debe ser una de las 9 definidas'
);
select throws_ok(
  $$update public.oportunidades set etapa = 'perdida' where id = '00000000-0000-0000-0000-0000000000b1'$$,
  '23514', null, 'no se puede marcar como perdida sin motivo'
);

update public.oportunidades set etapa = 'perdida', motivo_perdida = 'Precio'
  where id = '00000000-0000-0000-0000-0000000000b1';
select isnt(
  (select fecha_cierre from public.oportunidades where id = '00000000-0000-0000-0000-0000000000b1'),
  null, 'al perderla se anota la fecha de cierre'
);
update public.oportunidades set etapa = 'seguimiento' where id = '00000000-0000-0000-0000-0000000000b1';
select is(
  (select fecha_cierre::text || '|' || coalesce(motivo_perdida, '')
     from public.oportunidades where id = '00000000-0000-0000-0000-0000000000b1'),
  null, 'al reabrirla se limpian la fecha de cierre y el motivo'
);
update public.oportunidades set etapa = 'ganada' where id = '00000000-0000-0000-0000-0000000000b1';
select isnt(
  (select fecha_cierre from public.oportunidades where id = '00000000-0000-0000-0000-0000000000b1'),
  null, 'al ganarla se anota la fecha de cierre'
);
update public.oportunidades set etapa = 'visita' where id = '00000000-0000-0000-0000-0000000000b1';

-- Quién ve -------------------------------------------------------------------
select pruebas.entrar('comercial');
select cmp_ok(pruebas.cuenta('oportunidades'), '>=', 1, 'comercial ve oportunidades');
select cmp_ok(
  (select count(*)::int from public.directorio_comercial()), '>=', 5,
  'comercial obtiene el directorio de usuarios internos'
);
select is(
  (select string_agg(u.rol, ',' order by u.rol)
     from public.directorio_comercial() d join pruebas.u u on u.id = d.id where d.asignable),
  'comercial,direccion', 'solo Dirección y Comercial pueden ser responsables'
);
select is(
  (select count(*)::int from public.directorio_comercial() d
     join pruebas.u u on u.id = d.id where u.rol = 'cliente'),
  0, 'el directorio no incluye usuarios del portal'
);
select is(pruebas.cuenta('perfiles'), 1, 'comercial sigue sin ver los perfiles de otros');

select pruebas.entrar('tecnico');
select is(pruebas.cuenta('oportunidades'), 0, 'técnico no ve oportunidades');
select is(pruebas.cuenta('canales_venta'), 0, 'técnico no ve canales de venta');
select is((select count(*)::int from public.directorio_comercial()), 0, 'técnico no obtiene el directorio');
select pruebas.entrar('administracion');
select is(pruebas.cuenta('oportunidades'), 0, 'administración no ve oportunidades');
select pruebas.entrar('laboratorio');
select is(pruebas.cuenta('actividades_comerciales'), 0, 'laboratorio no ve actividades comerciales');
select pruebas.entrar('cliente');
select is(pruebas.cuenta('oportunidades'), 0, 'cliente no ve oportunidades');

-- Quién edita ----------------------------------------------------------------
select pruebas.entrar('administracion');
select throws_ok(
  $$insert into public.canales_venta (nombre) values ('X')$$, '42501', null,
  'administración no agrega canales de venta'
);

select pruebas.entrar('comercial');
select lives_ok(
  $$insert into public.actividades_comerciales (oportunidad_id, tipo, fecha, responsable_id)
    values ('00000000-0000-0000-0000-0000000000b1', 'llamada', current_date, auth.uid())$$,
  'comercial registra una actividad'
);
select throws_ok(
  $$insert into public.actividades_comerciales (oportunidad_id, tipo, fecha, responsable_id)
    values ('00000000-0000-0000-0000-0000000000b1', 'comida', current_date, auth.uid())$$,
  '23514', null, 'el tipo de actividad debe ser uno de los definidos'
);
with c as (
  update public.oportunidades set etapa = 'cotizacion'
  where id = '00000000-0000-0000-0000-0000000000b1' returning 1
)
select is((select count(*)::int from c), 1, 'comercial mueve la oportunidad de etapa');
select lives_ok(
  $$insert into public.canales_venta (nombre, correo) values ('Canal nuevo', 'canal@externo.test')$$,
  'comercial agrega un canal de venta'
);
select throws_ok(
  $$delete from public.oportunidades$$, '42501', null, 'nadie borra oportunidades: se marcan con deleted_at'
);

select pruebas.entrar('direccion');
with c as (
  update public.oportunidades set responsable_id = (select id from pruebas.u where rol = 'direccion')
  where id = '00000000-0000-0000-0000-0000000000b1' returning 1
)
select is((select count(*)::int from c), 1, 'dirección reasigna el responsable');

select * from finish();
rollback;
