-- Pipeline: oportunidad descartada (con motivo) y siguiente paso con fecha.
begin;
select plan(8);

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
with c as (insert into public.cuentas (nombre) values ('ZZ Descartes') returning id)
insert into pruebas.d select 'cuenta', id from c;

with o as (insert into public.oportunidades (cuenta_id, nombre, responsable_id, tipo, origen, siguiente_paso, siguiente_paso_fecha)
  values (pruebas.id('cuenta'), 'Prospecto sin presupuesto', pruebas.uid('comercial'), 'nuevo', 'prospeccion',
          'Retomar cuando abran presupuesto', date '2037-01-15') returning id)
insert into pruebas.d select 'op', id from o;

select pruebas.entrar('comercial');

select is(
  (select row(siguiente_paso, siguiente_paso_fecha)::text from public.oportunidades where id = pruebas.id('op')),
  '("Retomar cuando abran presupuesto",2037-01-15)', 'guarda el siguiente paso y su fecha'
);
select throws_ok(
  $$update public.oportunidades set etapa = 'descartada' where id = pruebas.id('op')$$,
  '23514', null, 'descartar exige un motivo'
);
select lives_ok(
  $$update public.oportunidades set etapa = 'descartada',
      motivo_perdida_id = (select id from public.motivos_perdida where nombre = 'Sin presupuesto por ahora')
    where id = pruebas.id('op')$$,
  'se descarta con un motivo de la lista'
);
select is(
  (select row(etapa, fecha_cierre is not null, siguiente_paso_fecha)::text from public.oportunidades where id = pruebas.id('op')),
  '(descartada,t,2037-01-15)', 'queda cerrada con fecha y conserva cuándo retomarla'
);
select lives_ok(
  $$update public.oportunidades set etapa = 'seguimiento' where id = pruebas.id('op')$$,
  'se puede retomar: vuelve a una etapa abierta'
);
select is(
  (select row(fecha_cierre, motivo_perdida_id, motivo_perdida)::text from public.oportunidades where id = pruebas.id('op')),
  '(,,)', 'al retomarla se limpian la fecha de cierre y el motivo'
);
select lives_ok(
  $$update public.oportunidades set etapa = 'descartada', motivo_perdida = 'Ya tiene el servicio con otro proveedor'
    where id = pruebas.id('op')$$,
  'también se descarta con el motivo escrito'
);

select pruebas.entrar('tecnico');
select is((select count(*)::int from public.oportunidades where id = pruebas.id('op')), 0,
  'el técnico sigue sin ver oportunidades');

select * from finish();
rollback;
