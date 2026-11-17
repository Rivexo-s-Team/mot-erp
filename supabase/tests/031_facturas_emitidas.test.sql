-- Registro de la factura emitida: datos del timbre, cargos facturados,
-- archivos una sola vez y cancelación que libera los cargos.
begin;
select plan(30);

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
with c as (insert into public.cuentas (nombre) values ('ZZ Emitidas') returning id)
insert into pruebas.d select 'cuenta', id from c;
with r as (insert into public.razones_sociales (cuenta_id, razon_social, rfc)
  values (pruebas.id('cuenta'), 'ZZ SA de CV', 'ZZZ010101AAA') returning id)
insert into pruebas.d select 'razon', id from r;
create function pruebas.cargo(p_clave text, p_precio numeric, p_moneda text default 'USD') returns void language plpgsql as $$
declare v_id uuid;
begin
  insert into public.cargos (cuenta_id, tipo, concepto, cantidad, unidad, precio_unitario, moneda)
  values (pruebas.id('cuenta'), 'servicio', 'Cargo ' || p_clave, 1, 'servicio', p_precio, p_moneda)
  returning id into v_id;
  insert into pruebas.d values (p_clave, v_id);
end $$;
select pruebas.cargo('a', 300);
select pruebas.cargo('b', 100);
select pruebas.cargo('pesos', 1000, 'MXN');
select pruebas.cargo('c', 50);
create table pruebas.f (clave text primary key, id uuid);
grant select, insert on pruebas.f to authenticated;
create function pruebas.fac(p_clave text) returns uuid language sql stable as
  $$select id from pruebas.f where clave = p_clave$$;
grant execute on all functions in schema pruebas to authenticated;

select pruebas.entrar('administracion');
insert into pruebas.f select 'usd', public.crear_factura(pruebas.id('razon'), array[pruebas.id('a'), pruebas.id('b')]);
insert into pruebas.f select 'mxn', public.crear_factura(pruebas.id('razon'), array[pruebas.id('pesos')]);
insert into pruebas.f select 'otra', public.crear_factura(pruebas.id('razon'), array[pruebas.id('c')]);

-- Emitir -------------------------------------------------------------------------------
select throws_ok(
  $$update public.facturas set estado = 'emitida', folio = '101' where id = pruebas.fac('usd')$$,
  '23514', null, 'no se registra sin folio fiscal'
);
select throws_ok(
  $$update public.facturas set estado = 'emitida', folio = '101',
      uuid_fiscal = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' where id = pruebas.fac('usd')$$,
  '23514', null, 'una factura en dólares necesita su tipo de cambio'
);
update public.facturas set xml_ruta = 'x/y.xml', folio = '99' where id = pruebas.fac('usd');
select is(
  (select row(xml_ruta, folio)::text from public.facturas where id = pruebas.fac('usd')), '(,)',
  'un borrador no guarda folio ni archivos'
);
select lives_ok(
  $$update public.facturas set estado = 'emitida', serie = 'A', folio = '101', fecha = '2037-05-03',
      uuid_fiscal = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tipo_cambio = 18.25 where id = pruebas.fac('usd')$$,
  'con serie, folio, UUID, fecha y tipo de cambio queda emitida'
);
select is(
  (select row(estado, timbrado, emitida_por = pruebas.uid('administracion'), emitida_at is not null)::text
   from public.facturas where id = pruebas.fac('usd')),
  '(emitida,manual,t,t)', 'queda anotado que se timbró a mano, quién la registró y cuándo'
);
select is(
  (select string_agg(estado, ',') from public.cargos where factura_id = pruebas.fac('usd')), 'facturado,facturado',
  'sus cargos quedan facturados'
);
select lives_ok(
  $$update public.facturas set estado = 'emitida', folio = '102',
      uuid_fiscal = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' where id = pruebas.fac('mxn')$$,
  'una factura en pesos no pide tipo de cambio'
);
select throws_ok(
  $$update public.facturas set estado = 'emitida', folio = '103',
      uuid_fiscal = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tipo_cambio = 18 where id = pruebas.fac('otra')$$,
  '23505', null, 'dos facturas no comparten folio fiscal'
);

-- Emitida ------------------------------------------------------------------------------
update public.facturas set metodo_pago = 'PUE', dias_credito = 90, orden_compra = 'OC-X', notas = 'nota'
where id = pruebas.fac('usd');
select is(
  (select row(metodo_pago, dias_credito, orden_compra, notas)::text from public.facturas where id = pruebas.fac('usd')),
  '(,0,,nota)', 'emitida, sus condiciones ya no cambian (las notas internas sí)'
);
select lives_ok(
  $$update public.facturas set folio = '101-B', tipo_cambio = 18.30 where id = pruebas.fac('usd')$$,
  'se puede corregir un dato mal capturado del registro'
);
select lives_ok(
  $$update public.facturas set xml_ruta = 'f/uno.xml', xml_total = 464 where id = pruebas.fac('usd')$$,
  'se guarda su XML'
);
select throws_ok(
  $$update public.facturas set xml_ruta = 'f/otro.xml' where id = pruebas.fac('usd')$$,
  'P0001', 'La factura ya tiene su XML.', 'el XML no se reemplaza'
);
select lives_ok($$update public.facturas set pdf_ruta = 'f/uno.pdf' where id = pruebas.fac('usd')$$, 'se guarda su PDF');
select throws_ok(
  $$update public.facturas set pdf_ruta = null where id = pruebas.fac('usd')$$,
  'P0001', 'La factura ya tiene su PDF.', 'ni se quita'
);
select throws_ok(
  $$update public.facturas set estado = 'borrador' where id = pruebas.fac('usd')$$,
  'P0001', null, 'una emitida no vuelve a borrador'
);
select throws_ok(
  $$update public.facturas set deleted_at = now() where id = pruebas.fac('usd')$$,
  'P0001', null, 'ni se elimina'
);
select throws_ok(
  $$delete from public.factura_conceptos where factura_id = pruebas.fac('usd')$$,
  'P0001', null, 'ni se le quitan conceptos'
);
select throws_ok(
  $$update public.cargos set precio_unitario = 1 where id = pruebas.id('a')$$,
  'P0001', null, 'un cargo facturado no cambia'
);

-- Cancelar -----------------------------------------------------------------------------
select throws_ok(
  $$update public.facturas set estado = 'cancelada' where id = pruebas.fac('usd')$$,
  '23514', null, 'no se cancela sin motivo'
);
select throws_ok(
  $$update public.facturas set estado = 'cancelada', motivo_cancelacion = 'x' where id = pruebas.fac('otra')$$,
  'P0001', null, 'un borrador no se cancela: se elimina'
);
select lives_ok(
  $$update public.facturas set estado = 'cancelada', motivo_cancelacion = 'Error en la orden de compra'
    where id = pruebas.fac('usd')$$,
  'una emitida se cancela con su motivo'
);
select is(
  (select row(estado, cancelada_por = pruebas.uid('administracion'), cancelada_at is not null, folio, xml_ruta)::text
   from public.facturas where id = pruebas.fac('usd')),
  '(cancelada,t,t,101-B,f/uno.xml)', 'queda quién la canceló y conserva sus datos y archivos'
);
select is(
  (select string_agg(estado || ':' || coalesce(factura_id::text, 'libre'), ',' order by concepto)
   from public.cargos where id in (pruebas.id('a'), pruebas.id('b'))),
  'pendiente:libre,pendiente:libre', 'sus cargos vuelven a quedar por facturar'
);
select is((select count(*)::int from public.factura_conceptos where factura_id = pruebas.fac('usd')), 2,
  'los conceptos se conservan como historia');
select throws_ok(
  $$update public.facturas set notas = 'y' where id = pruebas.fac('usd')$$,
  'P0001', null, 'una cancelada ya no cambia'
);
select lives_ok(
  $$select public.crear_factura(pruebas.id('razon'), array[pruebas.id('a'), pruebas.id('b')])$$,
  'y sus cargos se pueden facturar otra vez'
);

-- Accesos ------------------------------------------------------------------------------
select pruebas.entrar('comercial');
with c as (update public.facturas set estado = 'cancelada', motivo_cancelacion = 'x'
           where id = pruebas.fac('mxn') returning 1)
select is((select count(*)::int from c), 0, 'comercial no cancela facturas');
select pruebas.entrar('direccion');
select lives_ok(
  $$update public.facturas set estado = 'cancelada', motivo_cancelacion = 'Se refacturó' where id = pruebas.fac('mxn')$$,
  'dirección sí'
);

select set_config('role', 'postgres', true);
select is(
  (select row(public, allowed_mime_types)::text from storage.buckets where id = 'facturas'),
  '(f,"{application/pdf,text/xml,application/xml}")', 'el bucket de facturas es privado y solo acepta PDF y XML'
);
select is(
  (select count(*)::int from pg_policies where schemaname = 'storage' and tablename = 'objects'
     and policyname like 'facturas_archivos_%' and cmd in ('UPDATE', 'DELETE')), 0,
  'sus archivos no se reemplazan ni se borran'
);

select * from finish();
rollback;
