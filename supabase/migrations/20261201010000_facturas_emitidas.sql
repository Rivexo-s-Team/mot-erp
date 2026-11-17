-- Etapa 5, paso 4: registro de la factura emitida (DISENO §4.6, D42).
--
-- Por ahora la factura se timbra fuera del sistema. Aquí se registra lo que
-- resultó: serie y folio, folio fiscal (UUID), fecha, tipo de cambio, y se
-- guardan el XML y el PDF. Con eso la factura pasa a "emitida" y sus cargos a
-- "facturado". Cuando haya PAC, estos mismos datos los llenará el timbrado
-- (columna `timbrado`), sin cambiar nada más.

alter table public.facturas
  add column serie text,
  add column folio text,
  add column uuid_fiscal uuid,
  add column timbrado text check (timbrado in ('manual', 'pac')),
  add column emitida_at timestamptz,
  add column emitida_por uuid references public.perfiles (id),
  add column xml_ruta text,
  add column pdf_ruta text,
  -- Total que dice el XML, para compararlo con el del sistema.
  add column xml_total numeric,
  add column cancelada_at timestamptz,
  add column cancelada_por uuid references public.perfiles (id),
  add column motivo_cancelacion text,
  add constraint facturas_emitida_check check (
    estado = 'borrador'
    or (folio is not null and length(btrim(folio)) > 0 and uuid_fiscal is not null
        and timbrado is not null and emitida_at is not null
        and (moneda = 'MXN' or tipo_cambio is not null))
  ),
  add constraint facturas_cancelada_check check (
    (estado = 'cancelada') = (cancelada_at is not null)
    and (estado <> 'cancelada' or length(btrim(coalesce(motivo_cancelacion, ''))) > 0)
  );
comment on column public.facturas.uuid_fiscal is 'Folio fiscal del CFDI (UUID del timbre).';
comment on column public.facturas.timbrado is
  'Cómo se timbró: manual (fuera del sistema y registrada aquí) o pac (por el sistema, cuando exista).';
comment on column public.facturas.fecha is
  'En borrador, la fecha con que se piensa emitir; emitida, la fecha de emisión del CFDI.';
create unique index facturas_uuid_fiscal_key on public.facturas (uuid_fiscal) where uuid_fiscal is not null;
create index facturas_emitida_por_idx on public.facturas (emitida_por);
create index facturas_cancelada_por_idx on public.facturas (cancelada_por);

-- Qué puede cambiar en cada estado:
--   borrador  → todo lo del encabezado; o pasar a emitida con los datos del timbre.
--   emitida   → solo corregir los datos del registro (serie, folio, UUID,
--               fecha, tipo de cambio), guardar el XML y el PDF una vez cada
--               uno, o cancelarla con su motivo.
--   cancelada → nada.
create or replace function public.facturas_proteger()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.cuenta_id := old.cuenta_id;
  new.razon_social_id := old.razon_social_id;
  new.moneda := old.moneda;

  if old.estado = 'cancelada' then
    raise exception 'La factura está cancelada y no se puede cambiar.' using errcode = 'P0001';
  end if;

  if old.estado = 'borrador' then
    if new.estado = 'cancelada' then
      raise exception 'Un borrador no se cancela: se elimina.' using errcode = 'P0001';
    end if;
    if new.estado = 'emitida' then
      if new.deleted_at is not null then
        raise exception 'La factura fue eliminada.' using errcode = 'P0001';
      end if;
      if not exists (select 1 from public.factura_conceptos where factura_id = new.id) then
        raise exception 'La factura no tiene conceptos.' using errcode = 'P0001';
      end if;
      new.timbrado := coalesce(new.timbrado, 'manual');
      new.emitida_at := now();
      new.emitida_por := (select auth.uid());
    else
      -- Sigue en borrador: aún no lleva datos de timbre ni archivos.
      new.serie := null; new.folio := null; new.uuid_fiscal := null; new.timbrado := null;
      new.xml_ruta := null; new.pdf_ruta := null; new.xml_total := null;
    end if;
    new.cancelada_at := null; new.cancelada_por := null; new.motivo_cancelacion := null;
    return new;
  end if;

  -- Emitida.
  if new.estado = 'borrador' then
    raise exception 'Una factura emitida no vuelve a borrador. Si se canceló ante el SAT, cancélala aquí.'
      using errcode = 'P0001';
  end if;
  if new.deleted_at is not null then
    raise exception 'Una factura emitida no se elimina.' using errcode = 'P0001';
  end if;
  if old.xml_ruta is not null and new.xml_ruta is distinct from old.xml_ruta then
    raise exception 'La factura ya tiene su XML.' using errcode = 'P0001';
  end if;
  if old.pdf_ruta is not null and new.pdf_ruta is distinct from old.pdf_ruta then
    raise exception 'La factura ya tiene su PDF.' using errcode = 'P0001';
  end if;
  -- Lo que no es del registro del timbre queda como estaba.
  new.metodo_pago := old.metodo_pago;
  new.forma_pago := old.forma_pago;
  new.uso_cfdi := old.uso_cfdi;
  new.dias_credito := old.dias_credito;
  new.orden_compra := old.orden_compra;
  new.timbrado := old.timbrado;
  new.emitida_at := old.emitida_at;
  new.emitida_por := old.emitida_por;
  if new.estado = 'cancelada' then
    new.cancelada_at := now();
    new.cancelada_por := (select auth.uid());
  else
    new.cancelada_at := null; new.cancelada_por := null; new.motivo_cancelacion := null;
  end if;
  return new;
end;
$$;

-- Al emitir, los cargos de la factura quedan facturados. Al cancelarla,
-- vuelven a quedar pendientes y libres, para poder facturarlos de nuevo.
create function public.facturas_marcar_cargos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.estado = 'emitida' and old.estado = 'borrador' then
    update public.cargos set estado = 'facturado' where factura_id = new.id;
  elsif new.estado = 'cancelada' and old.estado = 'emitida' then
    update public.cargos set estado = 'pendiente', factura_id = null where factura_id = new.id;
  end if;
  return new;
end;
$$;
create trigger facturas_marcar_cargos after update on public.facturas
  for each row execute function public.facturas_marcar_cargos();

-- Los conceptos de una factura cancelada se conservan como historia, pero sus
-- cargos ya están libres: el trigger que protege los conceptos no debe
-- impedir nada más. (No hay cambio: ya exige que la factura sea borrador.)

-- Archivos de las facturas: bucket privado. Sin update ni delete.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('facturas', 'facturas', false, 10485760, array['application/pdf', 'text/xml', 'application/xml']);
create policy facturas_archivos_select on storage.objects for select to authenticated
  using (bucket_id = 'facturas' and (select public.tiene_permiso('facturacion.ver')));
create policy facturas_archivos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'facturas' and (select public.tiene_permiso('facturacion.editar')));
