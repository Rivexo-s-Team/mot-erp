-- Archivos comerciales: registro de adjuntos y permisos de Storage.
begin;
select plan(22);

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

-- Cuántos objetos de un bucket ve el usuario actual.
create function pruebas.objetos(p_bucket text) returns int language sql as $$
  select count(*)::int from storage.objects where bucket_id = p_bucket;
$$;

insert into public.cuentas (id, nombre) values ('00000000-0000-0000-0000-0000000000c1', 'Cuenta Uno');
insert into public.oportunidades (id, cuenta_id, nombre, responsable_id, tipo, origen)
select '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', 'Oportunidad Uno',
       id, 'nuevo', 'prospeccion'
from pruebas.u where rol = 'comercial';
insert into storage.objects (bucket_id, name) values
  ('adjuntos-oportunidades', '00000000-0000-0000-0000-0000000000b1/informe.pdf'),
  ('comprobantes-precio', '00000000-0000-0000-0000-000000000071/factura.pdf');
insert into public.oportunidad_adjuntos (oportunidad_id, nombre, ruta, tipo_mime, tamano_bytes, etapa)
values ('00000000-0000-0000-0000-0000000000b1', 'informe.pdf',
        '00000000-0000-0000-0000-0000000000b1/informe.pdf', 'application/pdf', 1000, 'muestra');

-- Configuración ---------------------------------------------------------------
select is(
  (select count(*)::int from storage.buckets where id in ('adjuntos-oportunidades', 'comprobantes-precio') and not public),
  2, 'los dos buckets existen y son privados'
);
select is(
  (select file_size_limit from storage.buckets where id = 'comprobantes-precio'),
  10485760::bigint, 'el límite por archivo es 10 MB'
);
select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity),
  0, 'todas las tablas de public tienen RLS activado'
);
select throws_ok(
  $$insert into public.oportunidad_adjuntos (oportunidad_id, nombre, ruta, tipo_mime, tamano_bytes, etapa)
    values ('00000000-0000-0000-0000-0000000000b1', 'x.pdf', 'otra-carpeta/x.pdf', 'application/pdf', 1, 'visita')$$,
  '23514', null, 'la ruta del adjunto debe estar en la carpeta de su oportunidad'
);

-- Quién ve ---------------------------------------------------------------------
select pruebas.entrar('comercial');
select is(pruebas.objetos('adjuntos-oportunidades'), 1, 'comercial ve los adjuntos de oportunidad');
select is(pruebas.objetos('comprobantes-precio'), 1, 'comercial ve los comprobantes de precio');
select is((select count(*)::int from public.oportunidad_adjuntos), 1, 'comercial ve el registro del adjunto');

select pruebas.entrar('tecnico');
select is(pruebas.objetos('adjuntos-oportunidades'), 0, 'técnico no ve adjuntos de oportunidad');
select is(pruebas.objetos('comprobantes-precio'), 0, 'técnico no ve comprobantes de precio');
select is((select count(*)::int from public.oportunidad_adjuntos), 0, 'técnico no ve el registro');
select pruebas.entrar('administracion');
select is(pruebas.objetos('comprobantes-precio'), 0, 'administración no ve comprobantes (no ve el pipeline)');
select pruebas.entrar('laboratorio');
select is(pruebas.objetos('adjuntos-oportunidades'), 0, 'laboratorio no ve adjuntos de oportunidad');
select pruebas.entrar('cliente');
select is(pruebas.objetos('adjuntos-oportunidades'), 0, 'cliente no ve adjuntos');
select is(pruebas.objetos('comprobantes-precio'), 0, 'cliente no ve comprobantes');

-- Quién sube -------------------------------------------------------------------
select pruebas.entrar('tecnico');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('adjuntos-oportunidades', 'x/tecnico.pdf')$$,
  '42501', null, 'técnico no sube adjuntos'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('comprobantes-precio', 'x/tecnico.pdf')$$,
  '42501', null, 'técnico no sube comprobantes'
);

select pruebas.entrar('comercial');
select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('adjuntos-oportunidades', 'x/comercial.pdf')$$,
  'comercial sube un adjunto'
);
select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('comprobantes-precio', 'x/comercial.pdf')$$,
  'comercial sube un comprobante'
);
with c as (
  update storage.objects set name = 'x/cambiado.pdf' where name = 'x/comercial.pdf' returning 1
)
select is((select count(*)::int from c), 0, 'un archivo subido no se reemplaza');
select throws_ok(
  $$delete from storage.objects where bucket_id = 'adjuntos-oportunidades'$$,
  '42501', null, 'ni se borra desde la app'
);
with c as (
  update public.oportunidad_adjuntos set deleted_at = now() where nombre = 'informe.pdf' returning 1
)
select is((select count(*)::int from c), 1, 'comercial puede quitar un adjunto (se oculta)');

select pruebas.entrar('direccion');
select is(pruebas.objetos('comprobantes-precio'), 2, 'dirección ve todos los comprobantes');

select * from finish();
rollback;
