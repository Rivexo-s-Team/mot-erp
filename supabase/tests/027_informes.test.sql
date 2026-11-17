-- Informes de laboratorio: muestras del mismo equipo, validación que fija el
-- contenido y accesos por rol.
begin;
select plan(24);

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
with c as (insert into public.cuentas (nombre) values ('ZZ Informes') returning id)
insert into pruebas.d select 'cuenta', id from c;
with p as (insert into public.plantas (cuenta_id, nombre) values (pruebas.id('cuenta'), 'Planta') returning id)
insert into pruebas.d select 'planta', id from p;
with e as (insert into public.equipos_cliente (planta_id, identificador) values (pruebas.id('planta'), 'T-1') returning id)
insert into pruebas.d select 'equipo', id from e;
with e as (insert into public.equipos_cliente (planta_id, identificador) values (pruebas.id('planta'), 'T-2') returning id)
insert into pruebas.d select 'equipo_otro', id from e;
with m as (insert into public.muestras (cuenta_id, planta_id, equipo_cliente_id, tipo, fecha_muestreo)
  values (pruebas.id('cuenta'), pruebas.id('planta'), pruebas.id('equipo'), 'filtrado', '2037-06-17') returning id)
insert into pruebas.d select 'muestra', id from m;
with m as (insert into public.muestras (cuenta_id, planta_id, equipo_cliente_id, tipo, fecha_muestreo)
  values (pruebas.id('cuenta'), pruebas.id('planta'), pruebas.id('equipo'), 'filtrado', '2037-07-17') returning id)
insert into pruebas.d select 'muestra2', id from m;
with m as (insert into public.muestras (cuenta_id, planta_id, equipo_cliente_id, tipo, fecha_muestreo)
  values (pruebas.id('cuenta'), pruebas.id('planta'), pruebas.id('equipo_otro'), 'filtrado', '2037-06-18') returning id)
insert into pruebas.d select 'muestra_otro', id from m;

create function pruebas.informe(p_folio text) returns uuid language sql as $$
  insert into public.informes (folio, cuenta_id, planta_id, equipo_cliente_id)
  values (p_folio, pruebas.id('cuenta'), pruebas.id('planta'), pruebas.id('equipo')) returning id
$$;
create function pruebas.agregar(p_informe uuid, p_muestra text, p_equipo text default 'equipo') returns void language sql as $$
  insert into public.informe_muestras (informe_id, muestra_id, equipo_cliente_id)
  values (p_informe, pruebas.id(p_muestra), pruebas.id(p_equipo))
$$;
create table pruebas.i (clave text primary key, id uuid);
grant select, insert on pruebas.i to authenticated;
create function pruebas.inf(p_clave text) returns uuid language sql stable as
  $$select id from pruebas.i where clave = p_clave$$;
grant execute on all functions in schema pruebas to authenticated;

-- Elaborar ---------------------------------------------------------------------------
select pruebas.entrar('laboratorio');
insert into pruebas.i select 'a', pruebas.informe('ZZ-37-001');
select is(
  (select row(estado, elaboro_id = pruebas.uid('laboratorio'), valido_id, contenido)::text
   from public.informes where id = pruebas.inf('a')),
  '(borrador,t,,)', 'nace en borrador y queda quién lo elaboró'
);
select throws_ok($$select pruebas.informe('zz-37-001 ')$$, '23505', null, 'no hay dos informes con el mismo folio');
select lives_ok($$select pruebas.agregar(pruebas.inf('a'), 'muestra')$$, 'se le agregan muestras de su equipo');
select throws_ok(
  $$select pruebas.agregar(pruebas.inf('a'), 'muestra_otro')$$,
  '23503', null, 'no acepta la muestra de otro equipo'
);
select throws_ok(
  $$select pruebas.agregar(pruebas.inf('a'), 'muestra_otro', 'equipo_otro')$$,
  '23503', null, 'ni diciendo que el informe es de ese otro equipo'
);
select lives_ok(
  $$update public.informes set observaciones = 'Aceite en buen estado.' where id = pruebas.inf('a')$$,
  'en borrador se corrige'
);
select throws_ok(
  $$update public.informes set estado = 'validado' where id = pruebas.inf('a')$$,
  'P0001', null, 'no se valida sin el contenido del informe'
);
insert into pruebas.i select 'vacio', pruebas.informe('ZZ-37-002');
select throws_ok(
  $$update public.informes set estado = 'validado', contenido = '{}' where id = pruebas.inf('vacio')$$,
  'P0001', null, 'no se valida un informe sin muestras'
);
update public.informes set contenido = '{"x": 1}', valido_id = pruebas.uid('laboratorio') where id = pruebas.inf('a');
select is(
  (select row(contenido, valido_id)::text from public.informes where id = pruebas.inf('a')),
  '(,)', 'en borrador no se guarda contenido ni validador'
);

-- Validar ----------------------------------------------------------------------------
select lives_ok(
  $$update public.informes set estado = 'validado', contenido = '{"muestras": 1}' where id = pruebas.inf('a')$$,
  'el laboratorio valida (puede ser quien lo elaboró)'
);
select is(
  (select row(estado, valido_id = pruebas.uid('laboratorio'), validado_at is not null, contenido)::text
   from public.informes where id = pruebas.inf('a')),
  '(validado,t,t,"{""muestras"": 1}")', 'queda quién validó, cuándo, y el contenido fijo'
);
select throws_ok(
  $$update public.informes set observaciones = 'Otra cosa' where id = pruebas.inf('a')$$,
  'P0001', null, 'un informe validado no cambia'
);
select throws_ok(
  $$select pruebas.agregar(pruebas.inf('a'), 'muestra2')$$,
  'P0001', null, 'ni se le agregan muestras'
);
select throws_ok(
  $$delete from public.informe_muestras where informe_id = pruebas.inf('a')$$,
  'P0001', null, 'ni se le quitan'
);
select throws_ok(
  $$update public.informes set deleted_at = now() where id = pruebas.inf('a')$$,
  'P0001', null, 'ni se elimina'
);
select lives_ok(
  $$update public.informes set estado = 'borrador' where id = pruebas.inf('a')$$,
  'se puede reabrir'
);
select is(
  (select row(estado, valido_id, validado_at, contenido)::text from public.informes where id = pruebas.inf('a')),
  '(borrador,,,)', 'al reabrirlo se borra la validación'
);
select lives_ok($$select pruebas.agregar(pruebas.inf('a'), 'muestra2')$$, 'y vuelve a aceptar cambios');

-- Accesos ----------------------------------------------------------------------------
select pruebas.entrar('direccion');
select lives_ok(
  $$update public.informes set estado = 'validado', contenido = '{"muestras": 2}' where id = pruebas.inf('a')$$,
  'dirección también valida'
);

select pruebas.entrar('tecnico');
select is((select count(*)::int from public.informes where cuenta_id = pruebas.id('cuenta')), 2,
  'el técnico consulta los informes');
select throws_ok($$select pruebas.informe('ZZ-37-003')$$, '42501', null, 'pero no los elabora');
with c as (update public.informes set estado = 'borrador' where id = pruebas.inf('a') returning 1)
select is((select count(*)::int from c), 0, 'ni los reabre');

select pruebas.entrar('cliente');
select is((select count(*)::int from public.informes), 0, 'el cliente no ve informes internos');
select is((select count(*)::int from public.informe_muestras), 0, 'ni sus muestras');

select * from finish();
rollback;
