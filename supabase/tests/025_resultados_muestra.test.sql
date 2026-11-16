-- Resultados de laboratorio: se guardan de una vez por muestra, el número se
-- interpreta en la base y solo captura quien tiene laboratorio.editar.
begin;
select plan(20);

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
with c as (insert into public.cuentas (nombre) values ('ZZ Resultados') returning id)
insert into pruebas.d select 'cuenta', id from c;
with p as (insert into public.plantas (cuenta_id, nombre) values (pruebas.id('cuenta'), 'Planta') returning id)
insert into pruebas.d select 'planta', id from p;
with e as (insert into public.equipos_cliente (planta_id, identificador) values (pruebas.id('planta'), 'T-1') returning id)
insert into pruebas.d select 'equipo', id from e;
with m as (insert into public.muestras (cuenta_id, planta_id, equipo_cliente_id, tipo, fecha_muestreo)
  values (pruebas.id('cuenta'), pruebas.id('planta'), pruebas.id('equipo'), 'filtrado', '2037-06-17') returning id)
insert into pruebas.d select 'muestra', id from m;
with m as (insert into public.muestras (cuenta_id, planta_id, equipo_cliente_id, tipo, fecha_muestreo, estado)
  values (pruebas.id('cuenta'), pruebas.id('planta'), pruebas.id('equipo'), 'filtrado', '2037-06-18', 'cancelada') returning id)
insert into pruebas.d select 'cancelada', id from m;

create function pruebas.p(p_clave text) returns text language sql stable as
  $$select id::text from public.parametros_laboratorio where clave = p_clave$$;
-- Resultado de un parámetro como (texto, número, calificador).
create function pruebas.r(p_clave text) returns text language sql stable as $$
  select row(r.valor_texto, r.valor_numerico, r.calificador)::text
  from public.muestra_resultados r
  where r.muestra_id = pruebas.id('muestra') and r.parametro_id = pruebas.p(p_clave)::uuid
$$;
create function pruebas.cambios() returns int language sql security definer as
  $$select count(*)::int from public.bitacora where tabla = 'muestra_resultados'$$;
grant execute on all functions in schema pruebas to authenticated;

-- Captura ---------------------------------------------------------------------------
select pruebas.entrar('laboratorio');
select lives_ok(
  $$select public.guardar_resultados_muestra(pruebas.id('muestra'), jsonb_build_object(
      pruebas.p('solidos_suspendidos'), '0.583',
      pruebas.p('agua_disuelta'), ' <300 ',
      pruebas.p('agua_libre'), 'No detectado',
      pruebas.p('codigo_iso'), '18/16/13',
      pruebas.p('particulas_4um'), '132090',
      pruebas.p('ph'), ''))$$,
  'el laboratorio guarda de una vez los resultados de la muestra'
);
select is((select count(*)::int from public.muestra_resultados where muestra_id = pruebas.id('muestra')), 5,
  'un resultado por parámetro; el que llega vacío no se guarda');
select is(pruebas.r('solidos_suspendidos'), '(0.583,0.583,)', 'un número se guarda también como número');
select is(pruebas.r('agua_disuelta'), '(<300,300,<)', '"<300" guarda 300 con su calificador, sin espacios sobrantes');
select is(pruebas.r('agua_libre'), '("No detectado",,)', 'un texto no tiene número');
select is(pruebas.r('codigo_iso'), '(18/16/13,,)', 'el código ISO se guarda como texto');
select throws_ok(
  $$update public.muestra_resultados set valor_numerico = 1 where muestra_id = pruebas.id('muestra')$$,
  '428C9', null, 'el número no se escribe a mano: sale del texto'
);

-- Guardar otra vez: reemplaza, y lo que no cambió no se toca.
create temporary table antes as select pruebas.cambios() as n;
grant select on antes to authenticated;
select public.guardar_resultados_muestra(pruebas.id('muestra'), jsonb_build_object(
  pruebas.p('solidos_suspendidos'), '0.583',
  pruebas.p('agua_disuelta'), '316.6',
  pruebas.p('codigo_iso'), '18/16/13',
  pruebas.p('particulas_4um'), '132090',
  pruebas.p('mpc'), '>15'));
select is(pruebas.r('agua_disuelta'), '(316.6,316.6,)', 'corregir un resultado lo reemplaza');
select is(pruebas.r('mpc'), '(>15,15,>)', 'se agregan los nuevos');
select is(pruebas.r('agua_libre'), null, 'y se quita el que ya no viene');
select is(pruebas.cambios() - (select n from antes), 3,
  'la bitácora registra solo lo que cambió (una corrección, un alta y una baja)');

-- Reglas ---------------------------------------------------------------------------
select throws_ok(
  $$select public.guardar_resultados_muestra(pruebas.id('cancelada'), jsonb_build_object(pruebas.p('ph'), '7'))$$,
  'P0001', null, 'una muestra cancelada no lleva resultados'
);
select throws_ok(
  $$select public.guardar_resultados_muestra(gen_random_uuid(), '{}'::jsonb)$$,
  'P0001', null, 'la muestra debe existir'
);
select throws_ok(
  $$select public.guardar_resultados_muestra(pruebas.id('muestra'),
      jsonb_build_object(gen_random_uuid()::text, '7'))$$,
  '23503', null, 'el parámetro debe ser del catálogo'
);
select is((select count(*)::int from public.muestra_resultados where muestra_id = pruebas.id('muestra')), 5,
  'si algo falla no se guarda nada a medias');
select lives_ok(
  $$select public.guardar_resultados_muestra(pruebas.id('muestra'), '{}'::jsonb)$$,
  'guardar sin resultados los quita todos'
);

-- Accesos ---------------------------------------------------------------------------
select public.guardar_resultados_muestra(pruebas.id('muestra'), jsonb_build_object(pruebas.p('ph'), '6.8'));
select pruebas.entrar('tecnico');
select is((select count(*)::int from public.muestra_resultados where muestra_id = pruebas.id('muestra')), 1,
  'el técnico consulta los resultados');
select throws_ok(
  $$select public.guardar_resultados_muestra(pruebas.id('muestra'), jsonb_build_object(pruebas.p('ph'), '1'))$$,
  '42501', null, 'el técnico no captura resultados'
);
with c as (delete from public.muestra_resultados where muestra_id = pruebas.id('muestra') returning 1)
select is((select count(*)::int from c), 0, 'ni los borra directo en la tabla');

select pruebas.entrar('cliente');
select is((select count(*)::int from public.muestra_resultados), 0, 'el cliente no ve resultados');

select * from finish();
rollback;
