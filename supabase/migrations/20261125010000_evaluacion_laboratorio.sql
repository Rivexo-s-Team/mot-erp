-- Etapa 4, paso 3: evaluación de resultados y condición del aceite (DISENO §4.5).
--
-- Si un resultado pasa o no pasa se calcula al mostrarlo (lib/laboratorio/
-- evaluacion.ts), con el límite del catálogo, la viscosidad nominal del aceite
-- y la muestra virgen del equipo. Aquí van los dos datos que le faltaban.

-- Qué parámetros cuentan para cada condición. PENDIENTE(P6): MOT no lo ha
-- confirmado; se toma lo que reproduce el informe FOLAB-26-092: los
-- fisicoquímicos cuentan para la condición del aceite y los aditivos para la
-- condición de aditivos. El desgaste y los contaminantes se evalúan pero no
-- cuentan. Se cambia en Catálogos → Parámetros de laboratorio.
alter table public.parametros_laboratorio
  add column cuenta_para text check (cuenta_para in ('aceite', 'aditivos'));
comment on column public.parametros_laboratorio.cuenta_para is
  'Condición para la que cuenta un "no pasa" de este parámetro: aceite, aditivos o ninguna (vacío).';
-- Es el valor inicial de una columna nueva, no un cambio de alguien: no va a la bitácora.
alter table public.parametros_laboratorio disable trigger parametros_laboratorio_bitacora;
update public.parametros_laboratorio set cuenta_para = 'aceite' where grupo = 'fisicoquimico';
update public.parametros_laboratorio set cuenta_para = 'aditivos' where grupo = 'aditivos';
alter table public.parametros_laboratorio enable trigger parametros_laboratorio_bitacora;

-- Quien ve el laboratorio necesita los umbrales de la condición aunque no vea
-- los demás parámetros de negocio.
create function public.umbrales_condicion_aceite()
returns table (precaucion_desde integer, critico_desde integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select valor::integer from public.parametros_negocio where clave = 'lab_condicion_precaucion_desde'),
    (select valor::integer from public.parametros_negocio where clave = 'lab_condicion_critico_desde')
  where (select public.tiene_permiso('laboratorio.ver'));
$$;
comment on function public.umbrales_condicion_aceite() is
  'Cuántos "no pasa" dan Precaución y cuántos Crítico, para quien consulta el laboratorio.';
revoke execute on function public.umbrales_condicion_aceite() from public, anon;
grant execute on function public.umbrales_condicion_aceite() to authenticated;
