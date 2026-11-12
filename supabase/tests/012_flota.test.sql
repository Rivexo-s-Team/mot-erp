-- Flota de Robox: la ven los internos; la editan Dirección y Técnico.
begin;
select plan(13);

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

insert into public.robox (numero_serie, modelo) values ('ZZ-900', 'Prueba');

-- Reglas de datos -----------------------------------------------------------
select throws_ok(
  $$insert into public.robox (numero_serie) values (' zz-900 ')$$, '23505', null,
  'no se repite el número de serie (sin distinguir mayúsculas ni espacios)'
);
update public.robox set deleted_at = now() where numero_serie = 'ZZ-900';
select lives_ok(
  $$insert into public.robox (numero_serie) values ('ZZ-900')$$,
  'la serie de un Robox dado de baja lógica se puede volver a usar'
);

-- Quién ve -------------------------------------------------------------------
select pruebas.entrar('comercial');
select cmp_ok((select count(*)::int from public.robox), '>=', 1, 'comercial ve la flota');
select pruebas.entrar('laboratorio');
select cmp_ok((select count(*)::int from public.robox), '>=', 1, 'laboratorio ve la flota');
select pruebas.entrar('cliente');
select is((select count(*)::int from public.robox), 0, 'cliente no ve la flota');

-- Quién edita ----------------------------------------------------------------
select pruebas.entrar('tecnico');
select lives_ok(
  $$insert into public.robox (numero_serie, modelo, version_programa, sim, estado, fecha_alta, notas)
    values ('ZZ-901', 'L15', '6.5', '8952140000000000001', 'disponible', '2026-01-15', 'Alta de prueba')$$,
  'técnico da de alta un Robox con todos sus datos'
);
select is(
  (select created_by from public.robox where numero_serie = 'ZZ-901'),
  (select id from pruebas.u where rol = 'tecnico'),
  'queda registrado quién lo dio de alta'
);
with c as (update public.robox set estado = 'en_taller' where numero_serie = 'ZZ-901' returning 1)
select is((select count(*)::int from c), 1, 'técnico cambia el estado');
select throws_ok(
  $$update public.robox set estado = 'perdido' where numero_serie = 'ZZ-901'$$, '23514', null,
  'el estado debe ser uno de los cuatro definidos'
);
select throws_ok(
  $$delete from public.robox where numero_serie = 'ZZ-901'$$, '42501', null,
  'nadie borra un Robox: se marca con deleted_at o con estado baja'
);

select pruebas.entrar('comercial');
select throws_ok(
  $$insert into public.robox (numero_serie) values ('ZZ-902')$$, '42501', null,
  'comercial no da de alta Robox'
);
select pruebas.entrar('administracion');
with c as (update public.robox set notas = 'x' where numero_serie = 'ZZ-901' returning 1)
select is((select count(*)::int from c), 0, 'administración no edita la flota');
select pruebas.entrar('laboratorio');
with c as (update public.robox set notas = 'x' where numero_serie = 'ZZ-901' returning 1)
select is((select count(*)::int from c), 0, 'laboratorio no edita la flota');

select * from finish();
rollback;
