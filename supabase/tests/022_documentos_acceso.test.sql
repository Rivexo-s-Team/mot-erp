-- Documentos de acceso a planta: de MOT o de una persona, con vencimiento;
-- los ven todos los internos y los registran Dirección y Administración.
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
create function pruebas.tipo(p_nombre text) returns uuid language sql stable security definer as
  $$select id from public.tipos_documento_acceso where nombre = p_nombre$$;
grant execute on all functions in schema pruebas to authenticated;

select is(
  (select string_agg(nombre || ':' || aplica_a, ', ' order by orden) from public.tipos_documento_acceso),
  'REPSE:empresa, Equipo de protección personal (EPP):persona, IMSS:persona',
  'el catálogo trae REPSE (de MOT), EPP e IMSS (por persona)'
);

-- Registrar -----------------------------------------------------------------------
select pruebas.entrar('administracion');
select lives_ok(
  $$insert into public.documentos_acceso (tipo_id, fecha_vencimiento)
    values (pruebas.tipo('REPSE'), '2040-01-31')$$,
  'administración registra el REPSE de MOT'
);
select lives_ok(
  $$insert into public.documentos_acceso (tipo_id, perfil_id)
    values (pruebas.tipo('IMSS'), pruebas.uid('tecnico'))$$,
  'y el IMSS de un técnico, sin vencimiento'
);
select throws_ok(
  $$insert into public.documentos_acceso (tipo_id) values (pruebas.tipo('IMSS'))$$,
  'P0001', null, 'un documento de persona necesita decir de quién es'
);
select throws_ok(
  $$insert into public.documentos_acceso (tipo_id, perfil_id)
    values (pruebas.tipo('REPSE'), pruebas.uid('tecnico'))$$,
  'P0001', null, 'un documento de MOT no se asigna a una persona'
);

-- Archivo: en su carpeta y sin reemplazo.
select throws_ok(
  $$update public.documentos_acceso set archivo_ruta = 'otra-carpeta/a.pdf', archivo_nombre = 'a.pdf'
    where tipo_id = pruebas.tipo('REPSE') and fecha_vencimiento = '2040-01-31'$$,
  '23514', null, 'el archivo va en la carpeta de su documento'
);
select lives_ok(
  $$update public.documentos_acceso set archivo_ruta = id || '/repse.pdf', archivo_nombre = 'repse.pdf'
    where tipo_id = pruebas.tipo('REPSE') and fecha_vencimiento = '2040-01-31'$$,
  'se le liga su archivo'
);
select throws_ok(
  $$update public.documentos_acceso set archivo_ruta = id || '/otro.pdf'
    where tipo_id = pruebas.tipo('REPSE') and fecha_vencimiento = '2040-01-31'$$,
  'P0001', null, 'el archivo ya subido no se reemplaza'
);
select lives_ok(
  $$update public.documentos_acceso set fecha_vencimiento = '2041-01-31'
    where tipo_id = pruebas.tipo('REPSE') and fecha_vencimiento = '2040-01-31'$$,
  'pero sí se corrige la fecha'
);
select throws_ok(
  $$delete from public.documentos_acceso where tipo_id = pruebas.tipo('IMSS')$$,
  '42501', null, 'los documentos no se borran'
);
select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values ('documentos-acceso', gen_random_uuid() || '/a.pdf', (select auth.uid())::text)$$,
  'administración sube archivos al bucket'
);

-- Quién ve y quién registra ---------------------------------------------------------
select pruebas.entrar('tecnico');
select cmp_ok(
  (select count(*)::int from public.documentos_acceso where deleted_at is null), '>=', 2,
  'el técnico consulta los documentos de MOT y del personal'
);
select is(public.documento_aviso_dias(), 30, 'y conoce con cuántos días se avisa el vencimiento');
select cmp_ok(
  (select count(*)::int from storage.objects where bucket_id = 'documentos-acceso'), '>=', 1,
  'puede abrir los archivos'
);
select throws_ok(
  $$insert into public.documentos_acceso (tipo_id, perfil_id)
    values (pruebas.tipo('IMSS'), (select auth.uid()))$$,
  '42501', null, 'pero no registra documentos'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values ('documentos-acceso', gen_random_uuid() || '/x.pdf', (select auth.uid())::text)$$,
  '42501', null, 'ni sube archivos'
);
select throws_ok(
  $$insert into public.tipos_documento_acceso (nombre, aplica_a) values ('DC-3', 'persona')$$,
  '42501', null, 'ni agrega tipos de documento'
);
select pruebas.entrar('direccion');
select lives_ok(
  $$insert into public.tipos_documento_acceso (nombre, aplica_a) values ('DC-3', 'persona')$$,
  'dirección agrega un tipo de documento si alguna planta lo pide'
);
select pruebas.entrar('cliente');
select is(
  (select count(*)::int from public.documentos_acceso)
  + (select count(*)::int from public.tipos_documento_acceso)
  + (select count(*)::int from storage.objects where bucket_id = 'documentos-acceso')
  + coalesce(public.documento_aviso_dias(), 0), 0,
  'cliente no ve documentos, tipos, archivos ni el parámetro'
);

select * from finish();
rollback;
