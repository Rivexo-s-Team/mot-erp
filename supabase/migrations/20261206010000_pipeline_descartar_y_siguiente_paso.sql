-- Pipeline, tras la revisión con MOT del 20 nov 2026 (DISENO §9, D55).
--
-- 1. Descartada: el prospecto no va (ya tiene servicio, sin presupuesto, no le
--    interesa). No es una venta perdida: nunca hubo una oportunidad real. Lleva
--    motivo, como la perdida, de la misma lista.
-- 2. Siguiente paso: qué toca hacer y cuándo ("retomar en enero, cuando abran
--    presupuesto"). Sirve en cualquier etapa, también en una descartada.

alter table public.oportunidades drop constraint oportunidades_etapa_check;
alter table public.oportunidades add constraint oportunidades_etapa_check
  check (etapa in (
    'primer_contacto', 'presentacion', 'visita', 'muestra',
    'resultados_laboratorio', 'cotizacion', 'seguimiento', 'ganada', 'perdida', 'descartada'
  ));

-- Perdida y descartada exigen un motivo: de la lista, escrito, o ambos.
alter table public.oportunidades drop constraint oportunidades_motivo_perdida_check;
alter table public.oportunidades add constraint oportunidades_motivo_perdida_check
  check (
    etapa not in ('perdida', 'descartada')
    or motivo_perdida_id is not null
    or coalesce(length(btrim(motivo_perdida)), 0) > 0
  );
comment on column public.oportunidades.motivo_perdida_id is
  'Motivo de la lista, para una oportunidad perdida o descartada; el detalle va en motivo_perdida.';
comment on column public.oportunidades.fecha_cierre is
  'Cuándo se marcó como ganada, perdida o descartada. Se llena sola.';

create or replace function public.oportunidades_al_cambiar_etapa()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.etapa in ('ganada', 'perdida', 'descartada') then
    if tg_op = 'INSERT' or old.etapa is distinct from new.etapa then
      new.fecha_cierre := now();
    end if;
  else
    new.fecha_cierre := null;
  end if;
  if new.etapa not in ('perdida', 'descartada') then
    new.motivo_perdida := null;
    new.motivo_perdida_id := null;
  end if;
  return new;
end;
$$;

alter table public.oportunidades
  add column siguiente_paso text,
  add column siguiente_paso_fecha date;
comment on column public.oportunidades.siguiente_paso is
  'Qué toca hacer con esta oportunidad (llamar, retomar cuando abran presupuesto…).';
comment on column public.oportunidades.siguiente_paso_fecha is
  'Cuándo toca hacerlo. Con fecha vencida aparece como seguimiento por hacer.';
create index oportunidades_siguiente_paso_idx on public.oportunidades (siguiente_paso_fecha)
  where deleted_at is null and siguiente_paso_fecha is not null;

-- Motivo que mencionó el director comercial y no estaba en la lista.
insert into public.motivos_perdida (nombre, orden)
select 'Sin presupuesto por ahora', 80
where not exists (select 1 from public.motivos_perdida where nombre = 'Sin presupuesto por ahora');
