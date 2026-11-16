-- Muestras de aceite: ID automático por año, ligas dentro del mismo cliente
-- y accesos por rol.
begin;
select plan(22);

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
with c as (insert into public.cuentas (nombre) values ('ZZ Muestras') returning id)
insert into pruebas.d select 'cuenta', id from c;
with c as (insert into public.cuentas (nombre) values ('ZZ Muestras otra') returning id)
insert into pruebas.d select 'cuenta_otra', id from c;
with p as (insert into public.plantas (cuenta_id, nombre) values (pruebas.id('cuenta'), 'Planta') returning id)
insert into pruebas.d select 'planta', id from p;
with p as (insert into public.plantas (cuenta_id, nombre) values (pruebas.id('cuenta_otra'), 'Planta otra') returning id)
insert into pruebas.d select 'planta_otra', id from p;
with e as (insert into public.equipos_cliente (planta_id, identificador) values (pruebas.id('planta'), 'T-1') returning id)
insert into pruebas.d select 'equipo', id from e;
with e as (insert into public.equipos_cliente (planta_id, identificador) values (pruebas.id('planta_otra'), 'X-1') returning id)
insert into pruebas.d select 'equipo_otro', id from e;
with o as (insert into public.ordenes_servicio (tipo, cuenta_id, planta_id, tecnico_id, fecha_programada)
  values ('visita', pruebas.id('cuenta'), pruebas.id('planta'), pruebas.uid('tecnico'), '2037-04-01') returning id)
insert into pruebas.d select 'orden', id from o;
with o as (insert into public.ordenes_servicio (tipo, cuenta_id, planta_id, tecnico_id, fecha_programada)
  values ('visita', pruebas.id('cuenta_otra'), pruebas.id('planta_otra'), pruebas.uid('tecnico'), '2037-04-02') returning id)
insert into pruebas.d select 'orden_otra', id from o;
with o as (insert into public.oportunidades (cuenta_id, nombre, responsable_id, tipo, origen)
  values (pruebas.id('cuenta'), 'Opp', pruebas.uid('comercial'), 'nuevo', 'referencia') returning id)
insert into pruebas.d select 'oportunidad', id from o;
with o as (insert into public.oportunidades (cuenta_id, nombre, responsable_id, tipo, origen)
  values (pruebas.id('cuenta_otra'), 'Opp otra', pruebas.uid('comercial'), 'nuevo', 'referencia') returning id)
insert into pruebas.d select 'oportunidad_otra', id from o;
grant execute on all functions in schema pruebas to authenticated;

-- Las pruebas usan los años 2037 y 2038 para no chocar con los datos semilla.
create function pruebas.muestra(p_fecha date, p_extra jsonb default '{}') returns text language sql as $$
  insert into public.muestras (cuenta_id, planta_id, equipo_cliente_id, tipo, fecha_muestreo, id_muestra)
  values (pruebas.id('cuenta'), pruebas.id('planta'), pruebas.id('equipo'), 'filtrado', p_fecha, p_extra ->> 'id_muestra')
  returning id_muestra
$$;
grant execute on all functions in schema pruebas to authenticated;

-- ID de muestra ------------------------------------------------------------------
select pruebas.entrar('laboratorio');
select is(pruebas.muestra('2037-06-17'), '370617-001', 'la primera muestra del año es la 001');
select is(pruebas.muestra('2037-06-18'), '370618-002', 'el consecutivo sigue aunque cambie el día');
select is(pruebas.muestra('2037-03-01', '{"id_muestra": "370301-092"}'), '370301-092',
  'el laboratorio puede escribir el ID de una muestra anterior al sistema');
select is(pruebas.muestra('2037-07-01'), '370701-093', 'el consecutivo sigue después del mayor del año');
select is(pruebas.muestra('2038-01-05'), '380105-001', 'cada año empieza de nuevo');
select throws_ok(
  $$select pruebas.muestra('2037-08-01', '{"id_muestra": "370617-001"}')$$,
  '23505', null, 'no hay dos muestras con el mismo ID'
);
select throws_ok(
  $$select pruebas.muestra('2037-08-01', '{"id_muestra": "muestra 5"}')$$,
  '23514', null, 'el ID escrito a mano respeta el formato AAMMDD-NNN'
);
select is(
  (select row(estado, tomada_por, created_by = pruebas.uid('laboratorio'))::text
   from public.muestras where id_muestra = '370617-001'),
  '(pendiente,mot,t)', 'nace pendiente de recibir, tomada por MOT, y queda quién la registró'
);

-- Reglas ---------------------------------------------------------------------------
select throws_ok(
  $$update public.muestras set estado = 'recibida' where id_muestra = '370617-001'$$,
  '23514', null, 'no se marca recibida sin fecha de recepción'
);
select lives_ok(
  $$update public.muestras set estado = 'recibida', fecha_recepcion = '2037-06-19',
      orden_id = pruebas.id('orden'), oportunidad_id = pruebas.id('oportunidad')
    where id_muestra = '370617-001'$$,
  'con fecha de recepción sí, y se liga a una orden y a una oportunidad del cliente'
);
select throws_ok(
  $$update public.muestras set fecha_recepcion = '2037-06-01' where id_muestra = '370617-001'$$,
  '23514', null, 'no se recibe antes de tomarla'
);
select throws_ok(
  $$update public.muestras set orden_id = pruebas.id('orden_otra') where id_muestra = '370617-001'$$,
  '23503', null, 'la orden debe ser del mismo cliente'
);
select throws_ok(
  $$update public.muestras set oportunidad_id = pruebas.id('oportunidad_otra') where id_muestra = '370617-001'$$,
  '23503', null, 'la oportunidad debe ser del mismo cliente'
);
select throws_ok(
  $$insert into public.muestras (cuenta_id, planta_id, equipo_cliente_id, tipo, fecha_muestreo)
    values (pruebas.id('cuenta'), pruebas.id('planta'), pruebas.id('equipo_otro'), 'usado', '2037-09-01')$$,
  '23503', null, 'el equipo debe ser de la planta y del cliente'
);
select throws_ok(
  $$insert into public.muestras (cuenta_id, planta_id, equipo_cliente_id, tipo, fecha_muestreo)
    values (pruebas.id('cuenta'), pruebas.id('planta'), pruebas.id('equipo'), 'entrada', '2037-09-01')$$,
  '23514', null, 'solo existen los cuatro tipos de muestra'
);
select throws_ok(
  $$delete from public.muestras where id_muestra = '370618-002'$$,
  '42501', null, 'las muestras no se borran'
);

-- Accesos ---------------------------------------------------------------------------
select pruebas.entrar('direccion');
select lives_ok($$select pruebas.muestra('2037-10-01')$$, 'dirección registra muestras');

select pruebas.entrar('tecnico');
select is((select count(*)::int from public.muestras where cuenta_id = pruebas.id('cuenta')), 6,
  'el técnico consulta las muestras');
select throws_ok($$select pruebas.muestra('2037-10-02')$$, '42501', null, 'el técnico no registra muestras');
with c as (update public.muestras set notas = 'x' where cuenta_id = pruebas.id('cuenta') returning 1)
select is((select count(*)::int from c), 0, 'el técnico no corrige muestras');

select pruebas.entrar('cliente');
select is((select count(*)::int from public.muestras), 0, 'el cliente no ve muestras');

select set_config('role', 'postgres', true);
select cmp_ok(
  (select count(*)::int from public.bitacora where tabla = 'muestras'), '>=', 6,
  'los cambios de las muestras quedan en la bitácora'
);

select * from finish();
rollback;
