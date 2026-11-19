-- Pipeline: tercer tipo de oportunidad. Hasta ahora había cliente nuevo y
-- ampliación (up sell: más de lo mismo a un cliente actual). Se agrega la venta
-- cruzada (cross sell: otro servicio a un cliente actual). Decisión D49.
alter table public.oportunidades drop constraint oportunidades_tipo_check;
alter table public.oportunidades add constraint oportunidades_tipo_check
  check (tipo in ('nuevo', 'ampliacion', 'venta_cruzada'));
comment on column public.oportunidades.tipo is
  'nuevo: cliente nuevo. ampliacion: up sell, más de lo mismo a un cliente actual. venta_cruzada: cross sell, otro servicio a un cliente actual.';
