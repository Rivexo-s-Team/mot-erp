-- A qué cuenta bancaria de MOT cayó cada pago (DISENO §9, D57).
--
-- Catálogo de las cuentas de MOT. Solo guarda cómo reconocerlas (nombre, banco
-- y los últimos 4 dígitos): nunca el número completo ni la CLABE.
create table public.cuentas_bancarias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique check (length(btrim(nombre)) > 0),
  banco text,
  terminacion text check (terminacion ~ '^\d{4}$'),
  moneda text not null default 'MXN' check (moneda ~ '^[A-Z]{3}$'),
  orden integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);
comment on table public.cuentas_bancarias is
  'Cuentas bancarias de MOT donde recibe pagos. Solo datos para reconocerlas, nunca el número completo.';
comment on column public.cuentas_bancarias.terminacion is 'Últimos 4 dígitos de la cuenta.';

create trigger cuentas_bancarias_set_updated_at before update on public.cuentas_bancarias
  for each row execute function public.set_updated_at();
create trigger cuentas_bancarias_set_created_by before insert on public.cuentas_bancarias
  for each row execute function public.set_created_by();

alter table public.cuentas_bancarias enable row level security;
revoke all on public.cuentas_bancarias from anon, authenticated;
grant select, insert, update on public.cuentas_bancarias to authenticated;
create policy cuentas_bancarias_select on public.cuentas_bancarias for select to authenticated
  using ((select public.tiene_permiso('facturacion.ver')));
create policy cuentas_bancarias_insert on public.cuentas_bancarias for insert to authenticated
  with check ((select public.tiene_permiso('facturacion.editar')));
create policy cuentas_bancarias_update on public.cuentas_bancarias for update to authenticated
  using ((select public.tiene_permiso('facturacion.editar')))
  with check ((select public.tiene_permiso('facturacion.editar')));

alter table public.pagos
  add column cuenta_bancaria_id uuid references public.cuentas_bancarias (id);
comment on column public.pagos.cuenta_bancaria_id is 'Cuenta de MOT donde cayó el pago, si se sabe.';
create index pagos_cuenta_bancaria_idx on public.pagos (cuenta_bancaria_id);

-- registrar_pago acepta además la cuenta bancaria (opcional).
--   p_datos: {fecha, monto, moneda, tipo_cambio, forma_pago, referencia, notas, cuenta_bancaria_id}
create or replace function public.registrar_pago(p_razon_social uuid, p_datos jsonb, p_aplicaciones jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_razon public.razones_sociales;
  v_pago uuid;
begin
  if not (select public.tiene_permiso('facturacion.editar')) then
    raise exception 'Tu rol no puede registrar pagos.' using errcode = '42501';
  end if;
  select * into v_razon from public.razones_sociales where id = p_razon_social and deleted_at is null;
  if v_razon.id is null then
    raise exception 'La razón social no existe.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(coalesce(p_aplicaciones, '[]'::jsonb)) <> 'array' then
    raise exception 'Las aplicaciones no tienen la forma esperada.' using errcode = 'P0001';
  end if;

  insert into public.pagos
    (cuenta_id, razon_social_id, fecha, monto, moneda, tipo_cambio, forma_pago, referencia, notas,
     cuenta_bancaria_id)
  values (
    v_razon.cuenta_id, v_razon.id, (p_datos ->> 'fecha')::date, (p_datos ->> 'monto')::numeric,
    p_datos ->> 'moneda', nullif(p_datos ->> 'tipo_cambio', '')::numeric,
    nullif(p_datos ->> 'forma_pago', ''), nullif(btrim(p_datos ->> 'referencia'), ''),
    nullif(btrim(p_datos ->> 'notas'), ''),
    nullif(p_datos ->> 'cuenta_bancaria_id', '')::uuid
  )
  returning id into v_pago;

  insert into public.pago_aplicaciones (pago_id, factura_id, monto)
  select v_pago, (a ->> 'factura_id')::uuid, (a ->> 'monto')::numeric
  from jsonb_array_elements(coalesce(p_aplicaciones, '[]'::jsonb)) a;
  return v_pago;
end;
$$;
