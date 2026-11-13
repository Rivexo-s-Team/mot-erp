-- Fotos, firmas y cierre: una orden solo se cierra en curso y firmada; las
-- firmas viajan con la captura; las fotos solo las sube quien llena la orden.
begin;
select plan(26);

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

create table pruebas.d (clave text primary key, id uuid);
grant select on pruebas.d to authenticated;
with c as (insert into public.cuentas (nombre) values ('ZZ Cierre') returning id)
insert into pruebas.d select 'cuenta', id from c;
with p as (insert into public.plantas (cuenta_id, nombre)
  select id, 'Planta Cierre' from pruebas.d where clave = 'cuenta' returning id)
insert into pruebas.d select 'planta', id from p;
with o as (insert into public.ordenes_servicio (tipo, cuenta_id, planta_id, tecnico_id, fecha_programada)
  select 'visita', c.id, p.id, u.id, '2033-02-01'
  from pruebas.d c, pruebas.d p, pruebas.u u
  where c.clave = 'cuenta' and p.clave = 'planta' and u.rol = 'tecnico' returning id)
insert into pruebas.d select 'visita', id from o;
with o as (insert into public.ordenes_servicio (tipo, tecnico_id, fecha_programada, estado)
  select 'taller', id, '2033-02-02', 'en_curso' from pruebas.u where rol = 'tecnico' returning id)
insert into pruebas.d select 'taller', id from o;

create function pruebas.id(p_clave text) returns uuid language sql stable as
  $$select id from pruebas.d where clave = p_clave$$;
create function pruebas.firma(p_nombre text) returns jsonb language sql immutable as
  $$select jsonb_build_object('nombre', p_nombre, 'cargo', 'Mantenimiento', 'fecha', '2033-02-01',
                              'trazos', '[[10,20,30,40,50,60],[70,80,90,100]]'::jsonb)$$;
grant execute on all functions in schema pruebas to authenticated;

-- Firmas con la captura ---------------------------------------------------------
select pruebas.entrar('tecnico');
update public.ordenes_servicio set estado = 'en_curso', fecha_real = '2033-02-01' where id = pruebas.id('visita');
select lives_ok(
  $$select public.guardar_captura_orden(pruebas.id('visita'),
      jsonb_build_object('firmas', jsonb_build_object('tecnico', pruebas.firma(' Daniel Vargas '))))$$,
  'la firma del técnico se guarda con la captura'
);
select is(
  (select row(nombre, cargo, fecha, jsonb_array_length(trazos))::text
   from public.os_firmas where orden_id = pruebas.id('visita') and rol = 'tecnico'),
  '("Daniel Vargas",Mantenimiento,2033-02-01,2)', 'con su nombre, cargo, fecha y trazos'
);

-- Cierre -----------------------------------------------------------------------
select throws_ok(
  $$update public.ordenes_servicio set estado = 'cerrada' where id = pruebas.id('visita')$$,
  'P0001', 'Falta la firma del responsable del cliente.', 'una visita no se cierra sin la firma del cliente'
);
select throws_ok(
  $$update public.ordenes_servicio set estado = 'cerrada' where id = pruebas.id('taller')$$,
  'P0001', 'Falta la firma del técnico.', 'ninguna orden se cierra sin la firma del técnico'
);
select public.guardar_captura_orden(pruebas.id('visita'),
  jsonb_build_object('firmas', jsonb_build_object(
    'tecnico', pruebas.firma('Daniel Vargas'), 'cliente', pruebas.firma('Jair Ocampo'))));
select is(
  (select count(*)::int from public.os_firmas where orden_id = pruebas.id('visita')), 2,
  'quedan las dos firmas, sin duplicar la del técnico'
);

-- Volver a firmar y quitar una firma.
select public.guardar_captura_orden(pruebas.id('visita'),
  jsonb_build_object('firmas', jsonb_build_object(
    'tecnico', pruebas.firma('Daniel Vargas'),
    'cliente', jsonb_build_object('nombre', 'Jair Ocampo', 'trazos', '[]'::jsonb))));
select is(
  (select count(*)::int from public.os_firmas where orden_id = pruebas.id('visita') and rol = 'cliente'), 0,
  'una firma sin trazos se quita (para volver a firmar)'
);
select public.guardar_captura_orden(pruebas.id('visita'), jsonb_build_object('observaciones', 'Sin tocar firmas'));
select is(
  (select count(*)::int from public.os_firmas where orden_id = pruebas.id('visita') and rol = 'tecnico'), 1,
  'una captura que no trae firmas no las borra'
);
select throws_ok(
  $$select public.guardar_captura_orden(pruebas.id('visita'),
      jsonb_build_object('firmas', jsonb_build_object('cliente',
        jsonb_build_object('nombre', ' ', 'trazos', '[[1,2,3,4]]'::jsonb))))$$,
  '23514', null, 'una firma necesita el nombre de quien firma'
);
select throws_ok(
  $$insert into public.os_firmas (orden_id, rol, nombre, trazos)
    values (pruebas.id('visita'), 'testigo', 'X', '[[1,2,3,4]]'::jsonb)$$,
  '23514', null, 'solo firman el técnico y el cliente'
);

select public.guardar_captura_orden(pruebas.id('visita'),
  jsonb_build_object('firmas', jsonb_build_object(
    'tecnico', pruebas.firma('Daniel Vargas'), 'cliente', pruebas.firma('Jair Ocampo'))));
select pruebas.entrar('tecnico_2');
with c as (update public.ordenes_servicio set estado = 'cerrada' where id = pruebas.id('visita') returning 1)
select is((select count(*)::int from c), 0, 'otro técnico no cierra una orden ajena');
select pruebas.entrar('tecnico');
with c as (update public.ordenes_servicio set estado = 'cerrada' where id = pruebas.id('visita') returning 1)
select is((select count(*)::int from c), 1, 'firmada por los dos, el técnico cierra su visita');
select isnt(
  (select fecha_cierre from public.ordenes_servicio where id = pruebas.id('visita')), null,
  'queda anotado cuándo se cerró'
);
select throws_ok(
  $$select public.guardar_captura_orden(pruebas.id('visita'),
      jsonb_build_object('firmas', jsonb_build_object('tecnico', pruebas.firma('Otro'))))$$,
  '42501', null, 'cerrada, ya no se cambia ninguna firma'
);
with c as (delete from public.os_firmas where orden_id = pruebas.id('visita') returning 1)
select is((select count(*)::int from c), 0, 'ni se borra directo de la tabla');

-- Una orden programada no se cierra aunque esté firmada.
insert into public.ordenes_servicio (tipo, tecnico_id, fecha_programada)
select 'taller', id, '2033-02-03' from pruebas.u where rol = 'tecnico';
insert into public.os_firmas (orden_id, rol, nombre, trazos)
select id, 'tecnico', 'Daniel Vargas', '[[1,2,3,4]]'::jsonb
from public.ordenes_servicio where fecha_programada = '2033-02-03';
select throws_ok(
  $$update public.ordenes_servicio set estado = 'cerrada' where fecha_programada = '2033-02-03'$$,
  'P0001', 'Solo se cierra una orden en curso.', 'una orden programada no se cierra sin haberla iniciado'
);

-- El taller solo necesita la firma del técnico.
select public.guardar_captura_orden(pruebas.id('taller'),
  jsonb_build_object('firmas', jsonb_build_object('tecnico', pruebas.firma('Daniel Vargas'))));
with c as (update public.ordenes_servicio set estado = 'cerrada' where id = pruebas.id('taller') returning 1)
select is((select count(*)::int from c), 1, 'una orden de taller se cierra solo con la firma del técnico');

-- Fotos ------------------------------------------------------------------------
insert into public.ordenes_servicio (tipo, tecnico_id, fecha_programada, estado)
select 'taller', id, '2033-02-04', 'en_curso' from pruebas.u where rol = 'tecnico';
select set_config('role', 'postgres', true);
insert into pruebas.d select 'abierta', id from public.ordenes_servicio where fecha_programada = '2033-02-04';
select pruebas.entrar('tecnico');
select lives_ok(
  $$insert into public.os_evidencias (orden_id, tipo, nombre, ruta, tipo_mime, tamano_bytes)
    values (pruebas.id('abierta'), 'pantalla_robox', 'pantalla.jpg', pruebas.id('abierta') || '/a.jpg', 'image/jpeg', 2048)$$,
  'el técnico registra una foto de su orden'
);
select throws_ok(
  $$insert into public.os_evidencias (orden_id, tipo, nombre, ruta, tipo_mime, tamano_bytes)
    values (pruebas.id('abierta'), 'otro', 'x.jpg', pruebas.id('visita') || '/b.jpg', 'image/jpeg', 2048)$$,
  '23514', null, 'la foto debe estar en la carpeta de su orden'
);
select throws_ok(
  $$insert into public.os_evidencias (orden_id, tipo, nombre, ruta, tipo_mime, tamano_bytes)
    values (pruebas.id('visita'), 'otro', 'x.jpg', pruebas.id('visita') || '/c.jpg', 'image/jpeg', 2048)$$,
  '42501', null, 'en una orden cerrada ya no se agregan fotos'
);
select throws_ok(
  $$delete from public.os_evidencias where orden_id = pruebas.id('abierta')$$,
  '42501', null, 'las fotos no se borran'
);
select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values ('evidencias', pruebas.id('abierta') || '/a.jpg', (select auth.uid())::text)$$,
  'Storage deja subir a la carpeta de una orden que el técnico puede llenar'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values ('evidencias', pruebas.id('visita') || '/z.jpg', (select auth.uid())::text)$$,
  '42501', null, 'pero no a la de una orden cerrada'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values ('evidencias', 'sin-carpeta.jpg', (select auth.uid())::text)$$,
  '42501', null, 'ni fuera de la carpeta de una orden'
);

select pruebas.entrar('tecnico_2');
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values ('evidencias', pruebas.id('abierta') || '/otro.jpg', (select auth.uid())::text)$$,
  '42501', null, 'otro técnico no sube fotos a una orden ajena'
);
select pruebas.entrar('administracion');
select is(
  (select count(*)::int from public.os_evidencias where orden_id = pruebas.id('abierta'))
  + (select count(*)::int from storage.objects where bucket_id = 'evidencias'
       and name like pruebas.id('abierta') || '/%'),
  2, 'administración ve las fotos y su registro'
);
select pruebas.entrar('cliente');
select is(
  (select count(*)::int from public.os_evidencias) + (select count(*)::int from public.os_firmas)
  + (select count(*)::int from storage.objects where bucket_id = 'evidencias'), 0,
  'cliente no ve fotos ni firmas'
);

select * from finish();
rollback;
