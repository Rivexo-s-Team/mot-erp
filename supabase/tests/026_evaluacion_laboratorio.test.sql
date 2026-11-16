-- Evaluación de laboratorio: qué parámetros cuentan para cada condición y
-- los umbrales para quien consulta el laboratorio.
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
grant execute on all functions in schema pruebas to authenticated;

select is(
  (select count(*)::int from public.parametros_laboratorio
   where (grupo = 'fisicoquimico') is distinct from (cuenta_para is not distinct from 'aceite')),
  0, 'los fisicoquímicos, y solo ellos, cuentan para la condición del aceite'
);
select is(
  (select count(*)::int from public.parametros_laboratorio
   where (grupo = 'aditivos') is distinct from (cuenta_para is not distinct from 'aditivos')),
  0, 'los aditivos cuentan para la condición de aditivos'
);
select throws_ok(
  $$update public.parametros_laboratorio set cuenta_para = 'otra' where clave = 'ph'$$,
  '23514', null, 'solo existen las dos condiciones'
);

select pruebas.entrar('laboratorio');
select is((select count(*)::int from public.parametros_negocio), 0, 'laboratorio no ve los parámetros de negocio');
select is(
  (select row(precaucion_desde, critico_desde)::text from public.umbrales_condicion_aceite()),
  '(2,5)', 'pero sí los umbrales de la condición del aceite'
);
select lives_ok(
  $$update public.parametros_laboratorio set cuenta_para = null where clave = 'ph'$$,
  'el laboratorio decide qué parámetros cuentan'
);

select pruebas.entrar('tecnico');
select is((select precaucion_desde from public.umbrales_condicion_aceite()), 2, 'el técnico también los consulta');

select pruebas.entrar('cliente');
select is((select count(*)::int from public.umbrales_condicion_aceite()), 0, 'el cliente no');

select * from finish();
rollback;
