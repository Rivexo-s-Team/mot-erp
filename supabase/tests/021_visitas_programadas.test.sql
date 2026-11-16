-- Visitas recurrentes: al programarlas nace la orden y la fecha avanza.
begin;
select plan(19);

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
insert into pruebas.u select clave, pruebas.crear_usuario(clave, 'Prueba ' || clave) from public.roles
where clave <> 'tecnico';
insert into pruebas.u values
  ('tecnico', pruebas.crear_usuario('tecnico', 'Ana Ruiz')),
  ('tecnico_2', pruebas.crear_usuario('tecnico', 'Beto Soto'));
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
grant select, insert on pruebas.d to authenticated;
create function pruebas.id(p_clave text) returns uuid language sql stable as
  $$select id from pruebas.d where clave = p_clave$$;
with c as (insert into public.cuentas (nombre) values ('ZZ Agenda') returning id)
insert into pruebas.d select 'cuenta', id from c;
with p as (insert into public.plantas (cuenta_id, nombre) values (pruebas.id('cuenta'), 'Planta 1') returning id)
insert into pruebas.d select 'planta_1', id from p;
with p as (insert into public.plantas (cuenta_id, nombre) values (pruebas.id('cuenta'), 'Planta 2') returning id)
insert into pruebas.d select 'planta_2', id from p;
with k as (insert into public.contratos (cuenta_id, planta_id, tipo, estado)
  values (pruebas.id('cuenta'), pruebas.id('planta_1'), 'renta', 'vigente') returning id)
insert into pruebas.d select 'contrato', id from k;
with e as (insert into public.equipos_cliente (planta_id, identificador) values (pruebas.id('planta_1'), 'T-1') returning id)
insert into pruebas.d select 'equipo', id from e;
with e as (insert into public.equipos_cliente (planta_id, identificador) values (pruebas.id('planta_2'), 'T-9') returning id)
insert into pruebas.d select 'equipo_otra', id from e;
grant execute on all functions in schema pruebas to authenticated;

-- Definir -------------------------------------------------------------------------
select pruebas.entrar('tecnico');
select lives_ok(
  $$insert into public.visitas_programadas
      (contrato_id, planta_id, equipo_cliente_id, cada_cantidad, cada_unidad, proxima_fecha)
    values (pruebas.id('contrato'), pruebas.id('planta_1'), pruebas.id('equipo'), 1, 'meses', '2036-01-31')$$,
  'un técnico define una visita recurrente'
);
insert into pruebas.d select 'visita', id from public.visitas_programadas where contrato_id = pruebas.id('contrato');
select throws_ok(
  $$insert into public.visitas_programadas (contrato_id, planta_id, cada_cantidad, cada_unidad, proxima_fecha)
    values (pruebas.id('contrato'), pruebas.id('planta_2'), 1, 'meses', '2036-01-31')$$,
  '23503', null, 'la planta es la del contrato'
);
select throws_ok(
  $$insert into public.visitas_programadas (contrato_id, planta_id, equipo_cliente_id, cada_cantidad, cada_unidad, proxima_fecha)
    values (pruebas.id('contrato'), pruebas.id('planta_1'), pruebas.id('equipo_otra'), 1, 'meses', '2036-01-31')$$,
  '23503', null, 'el equipo es de la planta del contrato'
);
select throws_ok(
  $$insert into public.visitas_programadas (contrato_id, planta_id, cada_cantidad, cada_unidad, proxima_fecha)
    values (pruebas.id('contrato'), pruebas.id('planta_1'), 0, 'meses', '2036-01-31')$$,
  '23514', null, 'la frecuencia debe ser mayor que cero'
);
select throws_ok(
  $$insert into public.visitas_programadas (contrato_id, planta_id, cada_cantidad, cada_unidad, proxima_fecha)
    values (pruebas.id('contrato'), pruebas.id('planta_1'), 1, 'años', '2036-01-31')$$,
  '23514', null, 'la frecuencia va en días, semanas o meses'
);

-- Programar -----------------------------------------------------------------------
select lives_ok($$select public.programar_visita(pruebas.id('visita'))$$, 'el técnico programa la visita');
select is(
  (select row(tipo, estado, cuenta_id = pruebas.id('cuenta'), planta_id = pruebas.id('planta_1'),
              contrato_id = pruebas.id('contrato'), equipo_cliente_id = pruebas.id('equipo'),
              tecnico_id = pruebas.uid('tecnico'), fecha_programada, folio)::text
   from public.ordenes_servicio where visita_programada_id = pruebas.id('visita')),
  '(visita,programada,t,t,t,t,t,2036-01-31,"360131 AR")',
  'nace la orden con los datos de la visita, a nombre de quien la programó'
);
select is(
  (select proxima_fecha from public.visitas_programadas where id = pruebas.id('visita')), date '2036-02-29',
  'la próxima fecha avanza un mes (y se ajusta al último día si el mes es más corto)'
);
update public.visitas_programadas set cada_cantidad = 2, cada_unidad = 'semanas', proxima_fecha = '2036-03-02'
where id = pruebas.id('visita');
select public.programar_visita(pruebas.id('visita'));
select is(
  (select proxima_fecha from public.visitas_programadas where id = pruebas.id('visita')), date '2036-03-16',
  'también avanza por semanas'
);
update public.visitas_programadas set cada_cantidad = 10, cada_unidad = 'dias' where id = pruebas.id('visita');
select public.programar_visita(pruebas.id('visita'));
select is(
  (select proxima_fecha from public.visitas_programadas where id = pruebas.id('visita')), date '2036-03-26',
  'y por días'
);
select is(
  (select count(*)::int from public.ordenes_servicio where visita_programada_id = pruebas.id('visita')), 3,
  'cada vez que se programa nace una orden'
);

-- Técnico asignado y permisos de la orden
update public.visitas_programadas set tecnico_id = pruebas.uid('tecnico_2') where id = pruebas.id('visita');
select throws_ok(
  $$select public.programar_visita(pruebas.id('visita'))$$, '42501', null,
  'un técnico no programa una visita asignada a otro técnico'
);
select is(
  (select proxima_fecha from public.visitas_programadas where id = pruebas.id('visita')), date '2036-03-26',
  'y si falla, la fecha no avanza'
);
select pruebas.entrar('direccion');
select lives_ok($$select public.programar_visita(pruebas.id('visita'))$$, 'dirección sí la programa');
select is(
  (select tecnico_id from public.ordenes_servicio
   where visita_programada_id = pruebas.id('visita') and fecha_programada = '2036-03-26'),
  pruebas.uid('tecnico_2'), 'la orden queda a nombre del técnico asignado a la visita'
);

-- Pausada
update public.visitas_programadas set activa = false where id = pruebas.id('visita');
select throws_ok(
  $$select public.programar_visita(pruebas.id('visita'))$$, 'P0001', null,
  'una visita pausada no se programa'
);

-- Quién ve y quién edita ---------------------------------------------------------------
select pruebas.entrar('administracion');
select is(
  (select count(*)::int from public.visitas_programadas where id = pruebas.id('visita')), 1,
  'administración consulta las visitas recurrentes'
);
select throws_ok(
  $$insert into public.visitas_programadas (contrato_id, planta_id, cada_cantidad, cada_unidad, proxima_fecha)
    values (pruebas.id('contrato'), pruebas.id('planta_1'), 1, 'meses', '2036-06-01')$$,
  '42501', null, 'administración no las define'
);
select pruebas.entrar('cliente');
select is((select count(*)::int from public.visitas_programadas), 0, 'cliente no ve la agenda');

select * from finish();
rollback;
