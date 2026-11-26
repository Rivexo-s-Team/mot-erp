-- Portal de clientes: el cliente ve solo las facturas emitidas y los pagos de su cuenta.
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
insert into pruebas.u values ('cliente_b', pruebas.crear_usuario('cliente', 'Prueba cliente B'));
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

create function pruebas.armar(p text, p_rfc text) returns void language plpgsql as $$
begin
  with c as (insert into public.cuentas (nombre) values ('ZZ Portal ' || p) returning id)
  insert into pruebas.d select 'cuenta_' || p, id from c;
  with r as (insert into public.razones_sociales (cuenta_id, razon_social, rfc)
    values (pruebas.id('cuenta_' || p), 'ZZ ' || p || ' SA de CV', p_rfc) returning id)
  insert into pruebas.d select 'razon_' || p, id from r;
end $$;
select pruebas.armar('a', 'ZZA010101AAA');
select pruebas.armar('b', 'ZZB010101AAA');
insert into public.usuarios_portal (perfil_id, cuenta_id) values
  (pruebas.uid('cliente'), pruebas.id('cuenta_a')), (pruebas.uid('cliente_b'), pruebas.id('cuenta_b'));

-- Factura de un solo cargo. Total con IVA = precio × 1.16.
create function pruebas.factura(p_clave text, p text, p_precio numeric, p_emitir boolean default true)
returns void language plpgsql as $$
declare v_cargo uuid; v_factura uuid;
begin
  insert into public.cargos (cuenta_id, tipo, concepto, cantidad, unidad, precio_unitario, moneda)
  values (pruebas.id('cuenta_' || p), 'servicio', 'Cargo ' || p_clave, 1, 'servicio', p_precio, 'USD')
  returning id into v_cargo;
  v_factura := public.crear_factura(pruebas.id('razon_' || p), array[v_cargo]);
  update public.facturas set notas = 'NOTA INTERNA' where id = v_factura;
  if p_emitir then
    update public.facturas set estado = 'emitida', folio = p_clave, uuid_fiscal = gen_random_uuid(), tipo_cambio = 18
    where id = v_factura;
  end if;
  insert into pruebas.d values ('f_' || p_clave, v_factura);
end $$;
grant execute on all functions in schema pruebas to authenticated;

select pruebas.entrar('administracion');
select pruebas.factura('A1', 'a', 100);
select pruebas.factura('A2', 'a', 300);
select pruebas.factura('A3', 'a', 50, false);
select pruebas.factura('A4', 'a', 70);
select pruebas.factura('B1', 'b', 500);
update public.facturas set xml_ruta = 'zz/a1.xml' where id = pruebas.id('f_A1');
update public.facturas set xml_ruta = 'zz/b1.xml' where id = pruebas.id('f_B1');
update public.facturas set estado = 'cancelada', motivo_cancelacion = 'Se refacturó' where id = pruebas.id('f_A4');
insert into pruebas.d select 'pago_a', public.registrar_pago(pruebas.id('razon_a'),
  jsonb_build_object('fecha', '2037-06-10', 'monto', 200, 'moneda', 'USD', 'forma_pago', '03',
                     'referencia', 'SPEI 1', 'tipo_cambio', '', 'notas', 'NOTA DEL PAGO'),
  jsonb_build_array(jsonb_build_object('factura_id', pruebas.id('f_A1'), 'monto', 116),
                    jsonb_build_object('factura_id', pruebas.id('f_A2'), 'monto', 50)));
update public.pagos set rep_folio = 'P-9', rep_uuid = gen_random_uuid() where id = pruebas.id('pago_a');
insert into pruebas.d select 'pago_b', public.registrar_pago(pruebas.id('razon_b'),
  jsonb_build_object('fecha', '2037-06-11', 'monto', 10, 'moneda', 'USD', 'forma_pago', '03',
                     'referencia', '', 'tipo_cambio', '', 'notas', ''), '[]'::jsonb);
select set_config('role', 'postgres', true);
insert into storage.objects (bucket_id, name) values ('facturas', 'zz/a1.xml'), ('facturas', 'zz/b1.xml');

select pruebas.entrar('cliente');
select is(
  (select string_agg(folio, ',' order by folio) from public.portal_facturas()), 'A1,A2',
  'el cliente ve sus facturas emitidas: ni borradores, ni canceladas, ni las de otra cuenta'
);
select is(
  (select row(razon_social, rfc, total, pagado, saldo, tiene_xml, tiene_pdf)::text from public.portal_facturas() where folio = 'A2'),
  '("ZZ a SA de CV",ZZA010101AAA,348.00,50,298.00,f,f)', 'con su total, lo pagado y su saldo'
);
select is(
  (select row(saldo, tiene_xml)::text from public.portal_facturas() where folio = 'A1'),
  '(0.00,t)', 'la pagada queda en cero y dice que tiene XML'
);
select is(
  (select row(j ->> 'folio', j ->> 'subtotal', j ->> 'iva', j ->> 'total', jsonb_array_length(j -> 'conceptos'),
              j -> 'conceptos' -> 0 ->> 'descripcion', j -> 'pagos' -> 0 ->> 'monto', j -> 'pagos' -> 0 ->> 'rep_folio')::text
   from public.portal_factura(pruebas.id('f_A2')) j),
  '(A2,300.00,48.00,348.00,1,"Cargo A2",50,P-9)', 'abre la factura con conceptos, pagos aplicados y su complemento'
);
select ok(
  public.portal_factura(pruebas.id('f_A2'))::text not like '%NOTA%', 'sin las notas internas'
);
select is(public.portal_factura(pruebas.id('f_B1')), null, 'no abre la factura de otra cuenta');
select is(public.portal_factura(pruebas.id('f_A3')), null, 'ni un borrador de la suya');
select is(public.portal_factura(pruebas.id('f_A4')), null, 'ni una cancelada');
select is(
  (select row(count(*), min(monto), min(aplicado), min(por_aplicar), min(rep_folio))::text from public.portal_pagos()),
  '(1,200,166,34,P-9)', 've solo sus pagos, con lo aplicado y lo que queda por aplicar'
);
select is(
  (select string_agg(a ->> 'folio' || ':' || (a ->> 'monto'), ',')
   from public.portal_pagos() p, jsonb_array_elements(p.aplicaciones) a),
  'A1:116,A2:50', 'y a qué facturas se aplicó cada uno'
);
select is(public.portal_factura_archivo(pruebas.id('f_A1'), 'xml'), 'zz/a1.xml', 'obtiene la ruta del XML de su factura');
select is(public.portal_factura_archivo(pruebas.id('f_A1'), 'pdf'), null, 'no hay PDF si no se subió');
select is(public.portal_factura_archivo(pruebas.id('f_B1'), 'xml'), null, 'no obtiene la ruta del archivo de otra cuenta');
select is(
  (select string_agg(name, ',') from storage.objects where bucket_id = 'facturas' and name like 'zz/%'),
  'zz/a1.xml', 'en el almacén ve solo los archivos de sus facturas'
);
select is((select count(*)::int from public.facturas), 0, 'no lee la tabla de facturas');
select is((select count(*)::int from public.pagos), 0, 'ni la de pagos');
select is((select count(*)::int from public.factura_saldos), 0, 'ni la vista de saldos');

select pruebas.entrar('cliente_b');
select is(
  (select string_agg(folio, ',') from public.portal_facturas()), 'B1', 'la otra cuenta ve solo la suya'
);

select pruebas.entrar('tecnico');
select is(
  (select count(*)::int from public.portal_facturas()) + (select count(*)::int from public.portal_pagos()), 0,
  'un usuario interno sin facturación no obtiene nada por el portal'
);

select * from finish();
rollback;
