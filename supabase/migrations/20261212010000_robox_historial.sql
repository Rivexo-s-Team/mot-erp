-- Historial de almacén de cada Robox (DISENO §9, D61).
--
-- MOT lleva en su Excel de inventario (BC-PRO03) una hoja de movimientos: alta
-- en almacén, salidas con su pase de salida, entradas, limpiezas y
-- reparaciones. No cabe en movimientos_robox, que son los cambios de equipo
-- dentro de un contrato. Aquí queda esa historia, por Robox. Es un registro:
-- se agrega, no se corrige ni se borra.
create table public.robox_historial (
  id uuid primary key default gen_random_uuid(),
  robox_id uuid not null references public.robox (id),
  fecha date not null,
  movimiento text not null
    check (movimiento in ('alta_almacen', 'salida_almacen', 'entrada_almacen', 'limpieza', 'reparacion', 'otro')),
  -- Pase de salida u otro documento que ampara el movimiento.
  documento text,
  detalle text,
  anotaciones text,
  -- De dónde viene el renglón: capturado en el sistema o importado del Excel.
  origen text not null default 'sistema' check (origen in ('sistema', 'excel_inventario')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);
comment on table public.robox_historial is
  'Historial de almacén de un Robox: altas, salidas con pase, entradas, limpiezas y reparaciones. Solo se agrega.';
comment on column public.robox_historial.documento is 'Pase de salida u otro documento que ampara el movimiento.';
create index robox_historial_robox_idx on public.robox_historial (robox_id, fecha, created_at);

create trigger robox_historial_set_created_by before insert on public.robox_historial
  for each row execute function public.set_created_by();

alter table public.robox_historial enable row level security;
revoke all on public.robox_historial from anon, authenticated;
grant select, insert on public.robox_historial to authenticated;
create policy robox_historial_select on public.robox_historial for select to authenticated
  using ((select public.tiene_permiso('flota.ver')));
create policy robox_historial_insert on public.robox_historial for insert to authenticated
  with check ((select public.tiene_permiso('flota.editar')));
