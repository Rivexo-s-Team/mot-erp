-- Portal de clientes, paso 3: facturas y pagos (D64).
-- El cliente ve las facturas emitidas de su cuenta (no borradores ni
-- canceladas), sus conceptos, lo que se les ha aplicado y sus pagos con el
-- complemento. Nunca las notas internas ni a qué cuenta de MOT cayó el pago.

create function public.portal_facturas()
returns table (
  id uuid, serie text, folio text, uuid_fiscal uuid, fecha date, moneda text,
  razon_social text, rfc text, metodo_pago text, orden_compra text, dias_credito integer,
  es_anticipo boolean, total numeric, pagado numeric, saldo numeric,
  tiene_xml boolean, tiene_pdf boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select f.id, f.serie, f.folio, f.uuid_fiscal, f.fecha, f.moneda,
         r.razon_social, r.rfc, f.metodo_pago, f.orden_compra, f.dias_credito,
         f.es_anticipo, s.total, s.pagado, s.saldo,
         f.xml_ruta is not null, f.pdf_ruta is not null
  from public.facturas f
  join public.razones_sociales r on r.id = f.razon_social_id
  join public.factura_saldos s on s.factura_id = f.id
  where f.cuenta_id = public.mi_cuenta_portal()
    and f.estado = 'emitida'
    and f.deleted_at is null
  order by f.fecha desc, f.folio desc;
$$;
comment on function public.portal_facturas() is
  'Portal: facturas emitidas de la cuenta del usuario actual, con total, pagado y saldo.';

create function public.portal_factura(p_factura uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', f.id, 'serie', f.serie, 'folio', f.folio, 'uuid_fiscal', f.uuid_fiscal,
    'fecha', f.fecha, 'moneda', f.moneda, 'tipo_cambio', f.tipo_cambio,
    'metodo_pago', f.metodo_pago, 'forma_pago', f.forma_pago, 'uso_cfdi', f.uso_cfdi,
    'orden_compra', f.orden_compra, 'dias_credito', f.dias_credito, 'es_anticipo', f.es_anticipo,
    'razon_social', r.razon_social, 'rfc', r.rfc,
    'subtotal', t.subtotal, 'iva', t.iva, 'total', s.total, 'pagado', s.pagado, 'saldo', s.saldo,
    'tiene_xml', f.xml_ruta is not null, 'tiene_pdf', f.pdf_ruta is not null,
    'conceptos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'descripcion', c.descripcion, 'cantidad', c.cantidad, 'unidad', c.unidad,
        'precio_unitario', c.precio_unitario, 'importe', c.importe) order by c.orden, c.created_at)
      from public.factura_conceptos c where c.factura_id = f.id), '[]'::jsonb),
    'pagos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'fecha', p.fecha, 'monto', a.monto, 'forma_pago', p.forma_pago,
        'es_anticipo', p.anticipo_factura_id is not null,
        'rep_folio', p.rep_folio, 'rep_uuid', p.rep_uuid) order by p.fecha, p.created_at)
      from public.pago_aplicaciones a
      join public.pagos p on p.id = a.pago_id
      where a.factura_id = f.id and p.deleted_at is null), '[]'::jsonb)
  )
  from public.facturas f
  join public.razones_sociales r on r.id = f.razon_social_id
  join public.factura_totales t on t.factura_id = f.id
  join public.factura_saldos s on s.factura_id = f.id
  where f.id = p_factura
    and f.cuenta_id = public.mi_cuenta_portal()
    and f.estado = 'emitida'
    and f.deleted_at is null;
$$;
comment on function public.portal_factura(uuid) is
  'Portal: una factura emitida de la cuenta del usuario actual, con conceptos y pagos aplicados. Null si no le toca.';

create function public.portal_pagos()
returns table (
  id uuid, fecha date, monto numeric, moneda text, forma_pago text, es_anticipo boolean,
  razon_social text, rep_folio text, rep_uuid uuid, aplicado numeric, por_aplicar numeric,
  aplicaciones jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.fecha, p.monto, p.moneda, p.forma_pago, p.anticipo_factura_id is not null,
         r.razon_social, p.rep_folio, p.rep_uuid, s.aplicado, s.por_aplicar,
         coalesce((
           select jsonb_agg(jsonb_build_object(
             'factura_id', f.id, 'serie', f.serie, 'folio', f.folio, 'monto', a.monto) order by f.fecha, f.folio)
           from public.pago_aplicaciones a
           join public.facturas f on f.id = a.factura_id
           where a.pago_id = p.id and f.estado = 'emitida' and f.deleted_at is null), '[]'::jsonb)
  from public.pagos p
  join public.razones_sociales r on r.id = p.razon_social_id
  join public.pago_saldos s on s.pago_id = p.id
  where p.cuenta_id = public.mi_cuenta_portal()
    and p.deleted_at is null
  order by p.fecha desc, p.created_at desc;
$$;
comment on function public.portal_pagos() is
  'Portal: pagos de la cuenta del usuario actual, con su complemento y a qué facturas se aplicaron.';

-- XML y PDF: el cliente abre solo los archivos de sus facturas emitidas.
create function public.portal_ve_archivo_factura(p_ruta text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.facturas f
    where f.cuenta_id = public.mi_cuenta_portal()
      and f.estado = 'emitida'
      and f.deleted_at is null
      and p_ruta in (f.xml_ruta, f.pdf_ruta)
  );
$$;
comment on function public.portal_ve_archivo_factura(text) is
  'Portal: el archivo es el XML o el PDF de una factura emitida de la cuenta del usuario actual.';

create function public.portal_factura_archivo(p_factura uuid, p_tipo text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case p_tipo when 'xml' then f.xml_ruta when 'pdf' then f.pdf_ruta end
  from public.facturas f
  where f.id = p_factura
    and f.cuenta_id = public.mi_cuenta_portal()
    and f.estado = 'emitida'
    and f.deleted_at is null;
$$;
comment on function public.portal_factura_archivo(uuid, text) is
  'Portal: ruta del XML o del PDF de una factura de la cuenta del usuario actual.';

create policy facturas_archivos_select_portal on storage.objects for select to authenticated
  using (bucket_id = 'facturas' and (select public.portal_ve_archivo_factura(name)));

revoke execute on function public.portal_facturas() from public, anon;
revoke execute on function public.portal_factura(uuid) from public, anon;
revoke execute on function public.portal_pagos() from public, anon;
revoke execute on function public.portal_ve_archivo_factura(text) from public, anon;
revoke execute on function public.portal_factura_archivo(uuid, text) from public, anon;
grant execute on function public.portal_facturas() to authenticated;
grant execute on function public.portal_factura(uuid) to authenticated;
grant execute on function public.portal_pagos() to authenticated;
grant execute on function public.portal_ve_archivo_factura(text) to authenticated;
grant execute on function public.portal_factura_archivo(uuid, text) to authenticated;
