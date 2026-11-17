-- Etapa 5, paso 3: facturas en borrador a partir de cargos (DISENO §4.6).
--
-- Una factura se arma eligiendo cargos pendientes de una misma cuenta y
-- moneda. Cada cargo se vuelve un concepto y queda "tomado" por esa factura:
-- no puede estar en dos a la vez ni cambiar mientras esté en una. Aquí la
-- factura solo existe como borrador; registrarla como emitida (folio fiscal,
-- XML y PDF) llega en el paso siguiente (D42).
--
-- PENDIENTE(P8): el IVA es un parámetro (16 %); las claves del SAT de cada
-- concepto y el criterio del tipo de cambio se definen con el contador.

insert into public.parametros_negocio (clave, valor, unidad, moneda, descripcion) values
  ('iva_tasa', 0.16, 'fraccion', null,
   'Tasa de IVA que se aplica a los conceptos de una factura nueva (0.16 = 16 %).');

-- Quien arma facturas necesita la tasa aunque no vea los demás parámetros.
create function public.iva_tasa()
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select case when (select public.tiene_permiso('facturacion.ver')) then (
    select valor from public.parametros_negocio where clave = 'iva_tasa'
  ) end;
$$;
revoke execute on function public.iva_tasa() from public, anon;
grant execute on function public.iva_tasa() to authenticated;

create table public.facturas (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references public.cuentas (id),
  razon_social_id uuid not null,
  estado text not null default 'borrador' check (estado in ('borrador', 'emitida', 'cancelada')),
  -- Fecha con la que se piensa emitir.
  fecha date not null default (now() at time zone 'America/Mexico_City')::date,
  moneda text not null check (moneda ~ '^[A-Z]{3}$'),
  -- Pesos por unidad de la moneda. Vacío mientras no se define; no aplica en MXN.
  tipo_cambio numeric check (tipo_cambio > 0),
  metodo_pago text check (metodo_pago in ('PUE', 'PPD')),
  forma_pago text check (forma_pago ~ '^[0-9]{2}$'),
  uso_cfdi text check (uso_cfdi ~ '^[A-Z]{1,2}[0-9]{2}$'),
  -- Número de la orden de compra del cliente, como va en la factura.
  orden_compra text,
  -- Se copian de las condiciones de crédito al crear la factura.
  dias_credito integer not null default 0 check (dias_credito between 0 and 365),
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  foreign key (razon_social_id, cuenta_id) references public.razones_sociales (id, cuenta_id),
  constraint facturas_ppd_check
    check (metodo_pago is distinct from 'PPD' or forma_pago is null or forma_pago = '99'),
  constraint facturas_tipo_cambio_mxn_check check (moneda <> 'MXN' or tipo_cambio is null)
);
comment on table public.facturas is
  'Factura a una razón social, armada con cargos. Nace como borrador; emitida y cancelada llegan con el registro del timbrado.';
create index facturas_cuenta_idx on public.facturas (cuenta_id);
create index facturas_razon_social_idx on public.facturas (razon_social_id);
create index facturas_estado_idx on public.facturas (estado) where deleted_at is null;

create table public.factura_conceptos (
  id uuid primary key default gen_random_uuid(),
  factura_id uuid not null references public.facturas (id),
  cargo_id uuid not null references public.cargos (id),
  orden integer not null default 0,
  -- Lo siguiente se copia del cargo al agregarlo.
  descripcion text not null check (length(btrim(descripcion)) > 0),
  cantidad numeric not null check (cantidad > 0),
  unidad text,
  precio_unitario numeric not null check (precio_unitario >= 0),
  importe numeric generated always as (round(cantidad * precio_unitario, 2)) stored,
  iva_tasa numeric not null check (iva_tasa >= 0 and iva_tasa < 1),
  iva numeric generated always as (round(round(cantidad * precio_unitario, 2) * iva_tasa, 2)) stored,
  -- Claves del catálogo del SAT; se llenan antes de timbrar.
  clave_prod_serv text check (clave_prod_serv ~ '^[0-9]{8}$'),
  clave_unidad text check (clave_unidad ~ '^[A-Z0-9]{2,3}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  unique (factura_id, cargo_id)
);
comment on table public.factura_conceptos is
  'Conceptos de una factura. Cada uno viene de un cargo; el importe y el IVA los calcula la base.';
create index factura_conceptos_cargo_idx on public.factura_conceptos (cargo_id);

alter table public.cargos add column factura_id uuid references public.facturas (id);
comment on column public.cargos.factura_id is
  'Factura que tiene tomado el cargo. Lo ponen y lo quitan los conceptos de la factura, no una persona.';
create index cargos_factura_idx on public.cargos (factura_id);

-- Totales de cada factura.
create view public.factura_totales
with (security_invoker = true) as
select
  f.id as factura_id,
  coalesce(sum(c.importe), 0) as subtotal,
  coalesce(sum(c.iva), 0) as iva,
  coalesce(sum(c.importe + c.iva), 0) as total,
  count(c.id)::integer as conceptos
from public.facturas f
left join public.factura_conceptos c on c.factura_id = f.id
group by f.id;
comment on view public.factura_totales is 'Subtotal, IVA y total de cada factura. Respeta RLS de quien consulta.';

-- Una factura que ya no es borrador no cambia desde aquí, y sus datos de
-- cliente y moneda no cambian nunca: para eso se elimina y se arma otra.
create function public.facturas_proteger()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.estado <> 'borrador' then
    raise exception 'La factura ya no es un borrador y no se puede cambiar.' using errcode = 'P0001';
  end if;
  if new.estado <> 'borrador' then
    raise exception 'Todavía no se puede emitir una factura desde el sistema.' using errcode = 'P0001';
  end if;
  new.cuenta_id := old.cuenta_id;
  new.razon_social_id := old.razon_social_id;
  new.moneda := old.moneda;
  return new;
end;
$$;
create trigger facturas_proteger before update on public.facturas
  for each row execute function public.facturas_proteger();

-- Al agregar un cargo a una factura: se revisa que se pueda, se copian sus
-- datos al concepto y el cargo queda tomado por la factura.
create function public.factura_conceptos_agregar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_factura public.facturas;
  v_cargo public.cargos;
begin
  select * into v_factura from public.facturas where id = new.factura_id for update;
  if v_factura.estado <> 'borrador' or v_factura.deleted_at is not null then
    raise exception 'La factura ya no es un borrador.' using errcode = 'P0001';
  end if;
  select * into v_cargo from public.cargos where id = new.cargo_id for update;
  if v_cargo.id is null or v_cargo.deleted_at is not null or v_cargo.estado <> 'pendiente' then
    raise exception 'El cargo no está pendiente de facturar.' using errcode = 'P0001';
  end if;
  if v_cargo.factura_id is not null then
    raise exception 'El cargo ya está en otra factura.' using errcode = 'P0001';
  end if;
  if v_cargo.importe is null then
    raise exception 'Al cargo le falta la cantidad o el precio.' using errcode = 'P0001';
  end if;
  if v_cargo.cuenta_id <> v_factura.cuenta_id then
    raise exception 'El cargo es de otro cliente.' using errcode = 'P0001';
  end if;
  if v_cargo.moneda <> v_factura.moneda then
    raise exception 'El cargo está en otra moneda.' using errcode = 'P0001';
  end if;

  new.descripcion := v_cargo.concepto;
  new.cantidad := v_cargo.cantidad;
  new.unidad := v_cargo.unidad;
  new.precio_unitario := v_cargo.precio_unitario;
  new.iva_tasa := coalesce(new.iva_tasa,
    (select valor from public.parametros_negocio where clave = 'iva_tasa'));
  update public.cargos set factura_id = new.factura_id where id = new.cargo_id;
  return new;
end;
$$;
create trigger factura_conceptos_agregar before insert on public.factura_conceptos
  for each row execute function public.factura_conceptos_agregar();

-- En un concepto solo se corrigen la descripción, las claves del SAT y el
-- orden, y solo mientras la factura es borrador. Al quitarlo, el cargo queda libre.
create function public.factura_conceptos_proteger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select estado from public.facturas where id = old.factura_id) <> 'borrador' then
    raise exception 'La factura ya no es un borrador.' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then
    update public.cargos set factura_id = null where id = old.cargo_id and factura_id = old.factura_id;
    return old;
  end if;
  new.factura_id := old.factura_id;
  new.cargo_id := old.cargo_id;
  new.cantidad := old.cantidad;
  new.unidad := old.unidad;
  new.precio_unitario := old.precio_unitario;
  new.iva_tasa := old.iva_tasa;
  return new;
end;
$$;
create trigger factura_conceptos_proteger before update or delete on public.factura_conceptos
  for each row execute function public.factura_conceptos_proteger();

-- Al eliminar un borrador, sus cargos quedan libres otra vez.
create function public.facturas_liberar_cargos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    update public.cargos set factura_id = null where factura_id = new.id;
  end if;
  return new;
end;
$$;
create trigger facturas_liberar_cargos after update on public.facturas
  for each row execute function public.facturas_liberar_cargos();

-- Un cargo tomado por una factura no cambia, y quién lo tiene tomado solo lo
-- deciden los conceptos de la factura (por eso se revisa que el cambio venga
-- de otro trigger y no directo de una persona).
create function public.cargos_proteger_facturado()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.factura_id is distinct from old.factura_id then
    if pg_trigger_depth() < 2 then
      raise exception 'Un cargo se agrega o se quita desde la factura.' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if old.factura_id is not null and pg_trigger_depth() < 2 and (
    new.cantidad is distinct from old.cantidad
    or new.precio_unitario is distinct from old.precio_unitario
    or new.moneda is distinct from old.moneda
    or new.unidad is distinct from old.unidad
    or new.concepto is distinct from old.concepto
    or new.estado is distinct from old.estado
    or new.deleted_at is distinct from old.deleted_at
  ) then
    raise exception 'El cargo está en una factura. Quítalo de la factura para cambiarlo.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger cargos_proteger_facturado before update on public.cargos
  for each row execute function public.cargos_proteger_facturado();

create trigger facturas_set_updated_at before update on public.facturas
  for each row execute function public.set_updated_at();
create trigger facturas_set_created_by before insert on public.facturas
  for each row execute function public.set_created_by();
create trigger facturas_bitacora after insert or update or delete on public.facturas
  for each row execute function public.registrar_bitacora();
create trigger factura_conceptos_set_updated_at before update on public.factura_conceptos
  for each row execute function public.set_updated_at();
create trigger factura_conceptos_set_created_by before insert on public.factura_conceptos
  for each row execute function public.set_created_by();
create trigger factura_conceptos_bitacora after insert or update or delete on public.factura_conceptos
  for each row execute function public.registrar_bitacora();

alter table public.facturas enable row level security;
revoke all on public.facturas from anon, authenticated;
grant select, insert, update on public.facturas to authenticated;
create policy facturas_select on public.facturas for select to authenticated
  using ((select public.tiene_permiso('facturacion.ver')));
create policy facturas_insert on public.facturas for insert to authenticated
  with check ((select public.tiene_permiso('facturacion.editar')));
create policy facturas_update on public.facturas for update to authenticated
  using ((select public.tiene_permiso('facturacion.editar')))
  with check ((select public.tiene_permiso('facturacion.editar')));

alter table public.factura_conceptos enable row level security;
revoke all on public.factura_conceptos from anon, authenticated;
grant select, insert, update, delete on public.factura_conceptos to authenticated;
create policy factura_conceptos_select on public.factura_conceptos for select to authenticated
  using ((select public.tiene_permiso('facturacion.ver')));
create policy factura_conceptos_insert on public.factura_conceptos for insert to authenticated
  with check ((select public.tiene_permiso('facturacion.editar')));
create policy factura_conceptos_update on public.factura_conceptos for update to authenticated
  using ((select public.tiene_permiso('facturacion.editar')))
  with check ((select public.tiene_permiso('facturacion.editar')));
create policy factura_conceptos_delete on public.factura_conceptos for delete to authenticated
  using ((select public.tiene_permiso('facturacion.editar')));

-- Arma una factura en borrador con los cargos elegidos, todo o nada. Toma el
-- método y la forma de pago y los días de crédito de las condiciones de la
-- razón social, y el uso de CFDI de sus datos fiscales.
create function public.crear_factura(p_razon_social uuid, p_cargos uuid[])
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_razon public.razones_sociales;
  v_credito public.condiciones_credito;
  v_moneda text;
  v_oc text;
  v_factura uuid;
begin
  if not (select public.tiene_permiso('facturacion.editar')) then
    raise exception 'Tu rol no puede armar facturas.' using errcode = '42501';
  end if;
  if coalesce(cardinality(p_cargos), 0) = 0 then
    raise exception 'Elige al menos un cargo.' using errcode = 'P0001';
  end if;
  select * into v_razon from public.razones_sociales where id = p_razon_social and deleted_at is null;
  if v_razon.id is null then
    raise exception 'La razón social no existe.' using errcode = 'P0001';
  end if;
  select * into v_credito from public.condiciones_credito where razon_social_id = p_razon_social;

  select min(moneda) into v_moneda from public.cargos where id = any (p_cargos);
  if v_moneda is null then
    raise exception 'Los cargos no existen.' using errcode = 'P0001';
  end if;
  -- Si todos los cargos son de una misma orden de compra, se propone esa.
  select case when count(distinct coalesce(o.numero, '')) = 1 then min(o.numero) end into v_oc
  from public.cargos k left join public.ordenes_compra o on o.id = k.orden_compra_id
  where k.id = any (p_cargos);

  insert into public.facturas
    (cuenta_id, razon_social_id, moneda, metodo_pago, forma_pago, uso_cfdi, dias_credito, orden_compra)
  values
    (v_razon.cuenta_id, v_razon.id, v_moneda, v_credito.metodo_pago, v_credito.forma_pago,
     v_razon.uso_cfdi, coalesce(v_credito.dias_credito, 0), v_oc)
  returning id into v_factura;

  insert into public.factura_conceptos (factura_id, cargo_id, orden, descripcion, cantidad, precio_unitario, iva_tasa)
  -- Orden de los conceptos: las rentas por mes, luego por antigüedad del cargo
  -- y, si empatan, como se eligieron.
  select v_factura, k.id,
         row_number() over (order by k.periodo nulls last, k.created_at, array_position(p_cargos, k.id)),
         k.concepto, 1, 0, public.iva_tasa()
  from public.cargos k where k.id = any (p_cargos);
  if (select count(*) from public.factura_conceptos where factura_id = v_factura) <> cardinality(p_cargos) then
    raise exception 'Alguno de los cargos no existe.' using errcode = 'P0001';
  end if;
  return v_factura;
end;
$$;
comment on function public.crear_factura(uuid, uuid[]) is
  'Arma una factura en borrador con cargos pendientes de una misma cuenta y moneda.';
revoke all on function public.crear_factura(uuid, uuid[]) from public, anon;
grant execute on function public.crear_factura(uuid, uuid[]) to authenticated;
