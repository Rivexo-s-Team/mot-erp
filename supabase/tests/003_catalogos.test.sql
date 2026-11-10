-- Catálogos: todos los internos los ven; cada uno lo edita solo quien debe.
begin;
select plan(34);

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

-- Intenta desactivar una fila; devuelve cuántas cambió (0 = RLS lo impidió).
create function pruebas.desactivar(p_tabla text) returns int language plpgsql as $$
declare n int;
begin
  execute format(
    'with c as (update public.%1$I set activo = false
                 where id = (select id from public.%1$I order by id limit 1) returning 1)
     select count(*) from c', p_tabla) into n;
  return n;
end $$;

create function pruebas.cuenta(p_tabla text) returns int language plpgsql as $$
declare n int;
begin
  execute format('select count(*) from public.%I', p_tabla) into n;
  return n;
end $$;

-- Datos iniciales ------------------------------------------------------------
select is(pruebas.cuenta('actividades'), 14, 'hay 14 actividades');
select is(pruebas.cuenta('fallas'), 14, 'hay 14 fallas');
select is(
  (select nombre from public.fallas where permite_cargo_cliente),
  'Componente dañado por el cliente', 'solo el daño por el cliente permite cargo'
);
select is(
  (select viscosidad_nominal_40c from public.aceites where nombre_comercial = 'DTE 25'),
  46::numeric, 'Mobil DTE 25 tiene viscosidad nominal 46 cSt'
);
select is(
  (select limite_texto from public.parametros_laboratorio where clave = 'codigo_iso'),
  '18/16/13', 'límite del código ISO'
);
select is(
  (select tipo_regla || ' ' || limite_valor from public.parametros_laboratorio where clave = 'viscosidad_40c'),
  'nominal_pct 10', 'viscosidad: nominal ± 10 %'
);
select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity),
  0, 'todas las tablas de public tienen RLS activado'
);
select throws_ok(
  $$insert into public.parametros_laboratorio (clave, nombre, grupo, tipo_regla, limite_valor)
    values ('x', 'X', 'desgaste', 'sin_limite', 5)$$,
  '23514', null, 'un parámetro sin límite no acepta valor de límite'
);
select throws_ok(
  $$insert into public.parametros_laboratorio (clave, nombre, grupo, tipo_regla)
    values ('y', 'Y', 'desgaste', 'maximo')$$,
  '23514', null, 'un parámetro con máximo exige el valor'
);

-- Quién ve -------------------------------------------------------------------
select pruebas.entrar('tecnico');
select is(pruebas.cuenta('partes'), 29, 'técnico ve las partes');
select is(pruebas.cuenta('parametros_laboratorio'), 35, 'técnico ve los parámetros de laboratorio');
select pruebas.entrar('comercial');
select is(pruebas.cuenta('aceites'), 1, 'comercial ve los aceites');
select pruebas.entrar('cliente');
select is(pruebas.cuenta('aceites'), 0, 'cliente no ve aceites');
select is(pruebas.cuenta('partes'), 0, 'cliente no ve partes');
select is(pruebas.cuenta('actividades'), 0, 'cliente no ve actividades');
select is(pruebas.cuenta('fallas'), 0, 'cliente no ve fallas');
select is(pruebas.cuenta('parametros_laboratorio'), 0, 'cliente no ve parámetros de laboratorio');

-- Quién edita ----------------------------------------------------------------
select pruebas.entrar('tecnico');
select is(pruebas.desactivar('partes'), 0, 'técnico no edita partes');
select is(pruebas.desactivar('fallas'), 0, 'técnico no edita fallas');
select throws_ok(
  $$insert into public.actividades (nombre) values ('Inventada')$$,
  '42501', null, 'técnico no agrega actividades'
);

select pruebas.entrar('comercial');
select is(pruebas.desactivar('aceites'), 0, 'comercial no edita aceites');

select pruebas.entrar('laboratorio');
select is(pruebas.desactivar('aceites'), 1, 'laboratorio edita aceites');
select is(pruebas.desactivar('parametros_laboratorio'), 1, 'laboratorio edita parámetros de laboratorio');
select is(pruebas.desactivar('partes'), 0, 'laboratorio no edita partes');
select is(pruebas.desactivar('actividades'), 0, 'laboratorio no edita actividades');

select pruebas.entrar('administracion');
select is(pruebas.desactivar('partes'), 1, 'administración edita partes');
select is(pruebas.desactivar('parametros_laboratorio'), 0, 'administración no edita parámetros de laboratorio');
select is(pruebas.desactivar('fallas'), 0, 'administración no edita fallas');

select pruebas.entrar('direccion');
select is(pruebas.desactivar('actividades'), 1, 'dirección edita actividades');
select is(pruebas.desactivar('fallas'), 1, 'dirección edita fallas');
select lives_ok(
  $$insert into public.aceites (marca, nombre_comercial, grado_iso_vg, viscosidad_nominal_40c)
    values ('Shell', 'Tellus S2 M 68', 68, 68)$$,
  'dirección agrega un aceite'
);
select throws_ok(
  $$delete from public.partes$$, '42501', null, 'nadie borra del catálogo: se desactiva'
);

-- Bitácora -------------------------------------------------------------------
select is(
  (select count(*)::int from public.bitacora
    where tabla = 'parametros_laboratorio' and operacion = 'UPDATE'),
  1, 'el cambio a un parámetro de laboratorio queda en la bitácora'
);
select is(
  (select usuario_id from public.bitacora
    where tabla = 'aceites' and operacion = 'INSERT' order by created_at desc limit 1),
  (select id from pruebas.u where rol = 'direccion'),
  'la bitácora registra quién agregó el aceite'
);

select * from finish();
rollback;
