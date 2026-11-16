-- Etapa 4, paso 2: resultados de laboratorio (DISENO §4.5).
--
-- Un resultado es lo que el laboratorio midió de un parámetro en una muestra.
-- Se guarda tal como se escribe: un número ("0.583"), un número acotado
-- ("<300") o un texto ("No detectado", "18/16/13"). Si pasa o no pasa se
-- calcula en el paso siguiente.

create table public.muestra_resultados (
  id uuid primary key default gen_random_uuid(),
  muestra_id uuid not null references public.muestras (id),
  parametro_id uuid not null references public.parametros_laboratorio (id),
  valor_texto text not null check (length(btrim(valor_texto)) between 1 and 100),
  -- Lo calcula la base a partir del texto, para que nunca se contradigan.
  valor_numerico numeric generated always as (
    case when valor_texto ~ '^[<>]?\d+(\.\d+)?$' then ltrim(valor_texto, '<>')::numeric end
  ) stored,
  calificador text generated always as (
    case when valor_texto ~ '^[<>]\d+(\.\d+)?$' then left(valor_texto, 1) end
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  unique (muestra_id, parametro_id)
);
comment on table public.muestra_resultados is
  'Resultado de un parámetro de laboratorio en una muestra, como lo escribió el laboratorio.';
comment on column public.muestra_resultados.valor_numerico is
  'El número del resultado, si lo es. "<300" da 300 con calificador "<". Un texto como "No detectado" lo deja vacío.';
create index muestra_resultados_parametro_idx on public.muestra_resultados (parametro_id);

create trigger muestra_resultados_set_updated_at before update on public.muestra_resultados
  for each row execute function public.set_updated_at();
create trigger muestra_resultados_set_created_by before insert on public.muestra_resultados
  for each row execute function public.set_created_by();
create trigger muestra_resultados_bitacora after insert or update or delete on public.muestra_resultados
  for each row execute function public.registrar_bitacora();

alter table public.muestra_resultados enable row level security;
revoke all on public.muestra_resultados from anon, authenticated;
grant select, insert, update, delete on public.muestra_resultados to authenticated;
create policy muestra_resultados_select on public.muestra_resultados for select to authenticated
  using ((select public.tiene_permiso('laboratorio.ver')));
create policy muestra_resultados_insert on public.muestra_resultados for insert to authenticated
  with check ((select public.tiene_permiso('laboratorio.editar')));
create policy muestra_resultados_update on public.muestra_resultados for update to authenticated
  using ((select public.tiene_permiso('laboratorio.editar')))
  with check ((select public.tiene_permiso('laboratorio.editar')));
create policy muestra_resultados_delete on public.muestra_resultados for delete to authenticated
  using ((select public.tiene_permiso('laboratorio.editar')));

update public.permisos
set descripcion = 'Registrar y corregir muestras de aceite y capturar sus resultados.'
where clave = 'laboratorio.editar';

-- Guarda de una vez todos los resultados de una muestra: {parametro_id: texto}.
-- Lo que no viene (o viene vacío) se quita; lo que no cambió no se toca, para
-- que la bitácora solo registre cambios reales. Con los permisos de quien llama.
create function public.guardar_resultados_muestra(p_muestra uuid, p_resultados jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_estado text;
begin
  if not (select public.tiene_permiso('laboratorio.editar')) then
    raise exception 'Tu rol no puede capturar resultados.' using errcode = '42501';
  end if;
  select estado into v_estado from public.muestras
  where id = p_muestra and deleted_at is null for update;
  if v_estado is null then
    raise exception 'La muestra no existe.' using errcode = 'P0001';
  end if;
  if v_estado = 'cancelada' then
    raise exception 'La muestra está cancelada: no lleva resultados.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_resultados) is distinct from 'object' then
    raise exception 'Los resultados no tienen la forma esperada.' using errcode = 'P0001';
  end if;

  create temporary table _resultados on commit drop as
  select e.key::uuid as parametro_id, btrim(e.value) as valor_texto
  from jsonb_each_text(p_resultados) e
  where btrim(coalesce(e.value, '')) <> '';

  delete from public.muestra_resultados r
  where r.muestra_id = p_muestra
    and not exists (select 1 from _resultados n where n.parametro_id = r.parametro_id);

  insert into public.muestra_resultados (muestra_id, parametro_id, valor_texto)
  select p_muestra, n.parametro_id, n.valor_texto from _resultados n
  on conflict (muestra_id, parametro_id) do update set valor_texto = excluded.valor_texto
  where public.muestra_resultados.valor_texto is distinct from excluded.valor_texto;

  drop table _resultados;
end;
$$;
revoke all on function public.guardar_resultados_muestra(uuid, jsonb) from public, anon;
grant execute on function public.guardar_resultados_muestra(uuid, jsonb) to authenticated;

-- Qué parámetros pide cada nivel de análisis. PENDIENTE(P5): mientras el
-- laboratorio no lo defina, todos los niveles incluyen todos los parámetros;
-- se ajusta en Catálogos → Parámetros de laboratorio. En cualquier caso se
-- puede capturar un parámetro fuera del nivel.
alter table public.parametros_laboratorio
  add column en_basico boolean not null default true,
  add column en_basico_mpc boolean not null default true,
  add column en_extendido boolean not null default true,
  add column en_premium boolean not null default true;
comment on column public.parametros_laboratorio.en_basico is
  'El nivel de análisis Básico incluye este parámetro (igual en_basico_mpc, en_extendido y en_premium).';
