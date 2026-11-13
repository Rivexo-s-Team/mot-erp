-- Captura de la visita: lecturas, actividades y fallas se guardan de una vez,
-- solo las llena quien puede llenar la orden y nada cambia en una orden cerrada.
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
insert into pruebas.u values ('tecnico_2', pruebas.crear_usuario('tecnico', 'Otro Técnico'));
grant select on pruebas.u to authenticated;

create function pruebas.entrar(p_rol text) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from pruebas.u where rol = p_rol), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create table pruebas.d (clave text primary key, id uuid, datos jsonb);
grant select on pruebas.d to authenticated;
with o as (insert into public.ordenes_servicio (tipo, tecnico_id, fecha_programada, estado)
  select 'taller', id, '2032-01-10', 'en_curso' from pruebas.u where rol = 'tecnico' returning id)
insert into pruebas.d select 'orden', id from o;
insert into pruebas.d select 'muestras', id from public.actividades where nombre = 'Toma de muestras';
insert into pruebas.d select 'rotacion', id from public.actividades where nombre = 'Rotación o movilización';
insert into pruebas.d select 'fuga', id from public.fallas where nombre = 'Fuga de aceite';

create function pruebas.id(p_clave text) returns uuid language sql stable as
  $$select id from pruebas.d where clave = p_clave$$;

-- La captura del formato en papel del 2 nov 2026 (Rassini, 11B116).
insert into pruebas.d (clave, datos) values ('captura', jsonb_build_object(
  'id_caso', ' RAS1-08 ', 'temperatura_aceite_c', '22.3', 'volumen_reservorio_l', '280',
  'observaciones', '',
  'lecturas', jsonb_build_object(
    'inicial', jsonb_build_object(
      'modelo', 'L15', 'numero_serie', '545592', 'programa', '6.5', 'presion_filtro', '3.5 / HY',
      'filter_used_dias', '74', 'filter_lifetime_dias', '365', 'runtime_dias', '74',
      'ack_flow_l', '138.278', 'presion_bar', '3.51', 'flujo_l_min', '0.683', 'temperatura_c', '20.8'),
    'posterior', jsonb_build_object('modelo', '', 'presion_bar', '')),
  'actividades', jsonb_build_array(
    jsonb_build_object('id', pruebas.id('muestras'), 'cantidad', '1'),
    jsonb_build_object('id', pruebas.id('rotacion'), 'cantidad', '')),
  'fallas', jsonb_build_array(pruebas.id('fuga'))
));
create function pruebas.captura() returns jsonb language sql stable as
  $$select datos from pruebas.d where clave = 'captura'$$;
grant execute on all functions in schema pruebas to authenticated;

-- Guardar ------------------------------------------------------------------------
select pruebas.entrar('tecnico');
select lives_ok(
  $$select public.guardar_captura_orden(pruebas.id('orden'), pruebas.captura())$$,
  'el técnico guarda su captura'
);
select is(
  (select row(id_caso, temperatura_aceite_c, volumen_reservorio_l, observaciones)::text
   from public.ordenes_servicio where id = pruebas.id('orden')),
  '(RAS1-08,22.3,280,)', 'los datos del equipo quedan en la orden, sin espacios sobrantes'
);
select is(
  (select row(numero_serie, filter_used_dias, filter_lifetime_dias, ack_flow_l, presion_bar, flujo_l_min, temperatura_c)::text
   from public.os_lecturas where orden_id = pruebas.id('orden') and momento = 'inicial'),
  '(545592,74,365,138.278,3.51,0.683,20.8)', 'la lectura inicial se guarda con sus valores exactos'
);
select is(
  (select count(*)::int from public.os_lecturas where orden_id = pruebas.id('orden') and momento = 'posterior'),
  0, 'una lectura sin datos no se guarda'
);
select is(
  (select cantidad from public.os_actividades where orden_id = pruebas.id('orden') and actividad_id = pruebas.id('muestras')),
  1, 'la actividad guarda su cantidad'
);
select is(
  (select count(*)::int from public.os_actividades where orden_id = pruebas.id('orden')), 2,
  'se guardan las dos actividades marcadas'
);
select is((select count(*)::int from public.os_fallas where orden_id = pruebas.id('orden')), 1, 'se guarda la falla');

-- Enviar dos veces lo mismo no duplica.
select public.guardar_captura_orden(pruebas.id('orden'), pruebas.captura());
select is(
  (select count(*)::int from public.os_lecturas where orden_id = pruebas.id('orden'))
  + (select count(*)::int from public.os_actividades where orden_id = pruebas.id('orden'))
  + (select count(*)::int from public.os_fallas where orden_id = pruebas.id('orden')),
  4, 'guardar otra vez lo mismo deja el mismo resultado'
);

-- Cambiar: se desmarca una actividad y la falla, y llega la lectura posterior.
select public.guardar_captura_orden(pruebas.id('orden'),
  pruebas.captura()
  || jsonb_build_object('actividades', jsonb_build_array(jsonb_build_object('id', pruebas.id('muestras'), 'cantidad', '2')))
  || jsonb_build_object('fallas', '[]'::jsonb)
  || jsonb_build_object('lecturas', (pruebas.captura()->'lecturas')
       || jsonb_build_object('posterior', jsonb_build_object('presion_bar', '3.4', 'flujo_l_min', '0.7'))));
select is(
  (select string_agg(cantidad::text, ',') from public.os_actividades where orden_id = pruebas.id('orden')),
  '2', 'desmarcar una actividad la quita y la cantidad se actualiza'
);
select is((select count(*)::int from public.os_fallas where orden_id = pruebas.id('orden')), 0, 'desmarcar la falla la quita');
select is(
  (select presion_bar from public.os_lecturas where orden_id = pruebas.id('orden') and momento = 'posterior'),
  3.4, 'la lectura posterior se agrega'
);
select throws_ok(
  $$select public.guardar_captura_orden(pruebas.id('orden'),
      pruebas.captura() || jsonb_build_object('volumen_reservorio_l', '0'))$$,
  '23514', null, 'el volumen del reservorio debe ser mayor que cero'
);
select is(
  (select volumen_reservorio_l from public.ordenes_servicio where id = pruebas.id('orden')), 280::numeric,
  'si algo falla no se guarda nada a medias'
);

-- Quién puede ---------------------------------------------------------------------
select pruebas.entrar('tecnico_2');
select throws_ok(
  $$select public.guardar_captura_orden(pruebas.id('orden'), pruebas.captura())$$,
  '42501', null, 'otro técnico no captura en una orden ajena'
);
select throws_ok(
  $$insert into public.os_fallas (orden_id, falla_id) values (pruebas.id('orden'), pruebas.id('fuga'))$$,
  '42501', null, 'ni escribiendo directo en la tabla'
);
select is(
  (select count(*)::int from public.os_lecturas where orden_id = pruebas.id('orden')), 2,
  'pero sí consulta las lecturas'
);
select pruebas.entrar('administracion');
select throws_ok(
  $$select public.guardar_captura_orden(pruebas.id('orden'), pruebas.captura())$$,
  '42501', null, 'administración no captura'
);
select pruebas.entrar('direccion');
select lives_ok(
  $$select public.guardar_captura_orden(pruebas.id('orden'), pruebas.captura())$$,
  'dirección puede corregir la captura de cualquier orden'
);
select pruebas.entrar('cliente');
select is(
  (select count(*)::int from public.os_lecturas) + (select count(*)::int from public.os_actividades)
  + (select count(*)::int from public.os_fallas), 0, 'cliente no ve la captura'
);

-- Cerrada: ya no cambia ---------------------------------------------------------------
select pruebas.entrar('tecnico');
update public.ordenes_servicio set estado = 'cerrada' where id = pruebas.id('orden');
select throws_ok(
  $$select public.guardar_captura_orden(pruebas.id('orden'), pruebas.captura())$$,
  '42501', null, 'en una orden cerrada ya no se captura'
);
with c as (update public.os_lecturas set presion_bar = 9 where orden_id = pruebas.id('orden') returning 1)
select is((select count(*)::int from c), 0, 'ni se cambian sus lecturas');
with c as (delete from public.os_actividades where orden_id = pruebas.id('orden') returning 1)
select is((select count(*)::int from c), 0, 'ni se borran sus actividades');

select * from finish();
rollback;
