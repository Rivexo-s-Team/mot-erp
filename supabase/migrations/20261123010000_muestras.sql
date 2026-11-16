-- Etapa 4, paso 1: muestras de aceite (DISENO §4.5).
--
-- Una muestra es un frasco de aceite de un equipo del cliente que llega al
-- laboratorio. Aquí va su registro; los resultados, la evaluación y el informe
-- llegan en los pasos siguientes.
--
-- PENDIENTE(P4): accesos tentativos. Todos los internos consultan; Laboratorio
-- y Dirección registran y corrigen.
-- PENDIENTE(P5): el nivel de análisis se guarda, pero todavía no limita qué
-- parámetros se capturan.

-- Para que la base impida ligar una muestra a la orden de otro cliente.
alter table public.ordenes_servicio
  add constraint ordenes_servicio_id_cuenta_key unique (id, cuenta_id);

create table public.muestras (
  id uuid primary key default gen_random_uuid(),
  -- AAMMDD-NNN (ej. "260617-092"): fecha de muestreo + consecutivo del año.
  -- Se genera solo si llega vacío; el laboratorio puede escribir el de una
  -- muestra anterior al sistema.
  id_muestra text not null unique check (id_muestra ~ '^\d{6}-\d{3,}$'),
  cuenta_id uuid not null references public.cuentas (id),
  planta_id uuid not null,
  equipo_cliente_id uuid not null,
  orden_id uuid,
  oportunidad_id uuid,
  -- PENDIENTE(P1): texto libre mientras se confirma la regla del ID de caso.
  id_caso text,
  tipo text not null check (tipo in ('virgen', 'usado', 'antes_filtrar', 'filtrado')),
  tomada_por text not null default 'mot' check (tomada_por in ('mot', 'cliente')),
  fecha_muestreo date not null,
  fecha_recepcion date,
  nivel_analisis text check (nivel_analisis in ('basico', 'basico_mpc', 'extendido', 'premium')),
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'recibida', 'en_analisis', 'concluida', 'cancelada')),
  -- Del manual de procesos (DISENO §8): opcionales.
  punto_muestreo text,
  condicion_operacion text,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  foreign key (planta_id, cuenta_id) references public.plantas (id, cuenta_id),
  foreign key (equipo_cliente_id, planta_id) references public.equipos_cliente (id, planta_id),
  foreign key (orden_id, cuenta_id) references public.ordenes_servicio (id, cuenta_id),
  foreign key (oportunidad_id, cuenta_id) references public.oportunidades (id, cuenta_id),
  constraint muestras_fechas_check check (fecha_recepcion is null or fecha_recepcion >= fecha_muestreo),
  -- Una muestra que ya está en el laboratorio tiene fecha de recepción.
  constraint muestras_recepcion_check
    check (estado in ('pendiente', 'cancelada') or fecha_recepcion is not null)
);
comment on table public.muestras is
  'Muestra de aceite de un equipo del cliente. Sus resultados e informe llegan en los pasos siguientes de la Etapa 4.';
comment on column public.muestras.id_muestra is
  'Identificador del frasco: AAMMDD (fecha de muestreo) + consecutivo anual. Se genera solo si se deja vacío.';
comment on column public.muestras.tipo is
  'virgen: línea base. usado: al arrancar la filtración. antes_filtrar: al iniciar una limpieza. filtrado: aceite tratado.';
comment on column public.muestras.estado is
  'pendiente: tomada, aún no llega al laboratorio. recibida, en_analisis, concluida o cancelada.';
create index muestras_cuenta_idx on public.muestras (cuenta_id);
create index muestras_planta_idx on public.muestras (planta_id);
create index muestras_equipo_idx on public.muestras (equipo_cliente_id, fecha_muestreo);
create index muestras_orden_idx on public.muestras (orden_id);
create index muestras_oportunidad_idx on public.muestras (oportunidad_id);
create index muestras_estado_idx on public.muestras (estado) where deleted_at is null;

-- ID de muestra: fecha de muestreo + el consecutivo que sigue en ese año
-- (cuenta también las muestras anteriores que el laboratorio haya capturado).
create function public.muestras_asignar_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_anio text := to_char(new.fecha_muestreo, 'YY');
  v_n integer;
begin
  if nullif(btrim(coalesce(new.id_muestra, '')), '') is not null then
    new.id_muestra := btrim(new.id_muestra);
    return new;
  end if;
  -- Evita que dos altas simultáneas tomen el mismo consecutivo.
  perform pg_advisory_xact_lock(hashtext('muestras:' || v_anio));
  select coalesce(max(split_part(id_muestra, '-', 2)::integer), 0) + 1 into v_n
  from public.muestras where left(id_muestra, 2) = v_anio;
  new.id_muestra := to_char(new.fecha_muestreo, 'YYMMDD') || '-' || lpad(v_n::text, 3, '0');
  return new;
end;
$$;
create trigger muestras_asignar_id before insert on public.muestras
  for each row execute function public.muestras_asignar_id();

create trigger muestras_set_updated_at before update on public.muestras
  for each row execute function public.set_updated_at();
create trigger muestras_set_created_by before insert on public.muestras
  for each row execute function public.set_created_by();
create trigger muestras_bitacora after insert or update or delete on public.muestras
  for each row execute function public.registrar_bitacora();

insert into public.permisos (clave, descripcion) values
  ('laboratorio.ver', 'Consultar las muestras de aceite y lo que el laboratorio registra de ellas.'),
  ('laboratorio.editar', 'Registrar y corregir muestras de aceite.');
insert into public.rol_permisos (rol_id, permiso_id)
select r.id, p.id
from (values
  ('direccion', 'laboratorio.ver'), ('comercial', 'laboratorio.ver'), ('tecnico', 'laboratorio.ver'),
  ('laboratorio', 'laboratorio.ver'), ('administracion', 'laboratorio.ver'),
  ('direccion', 'laboratorio.editar'), ('laboratorio', 'laboratorio.editar')
) as m (rol, permiso)
join public.roles r on r.clave = m.rol
join public.permisos p on p.clave = m.permiso;

alter table public.muestras enable row level security;
revoke all on public.muestras from anon, authenticated;
grant select, insert, update on public.muestras to authenticated;
create policy muestras_select on public.muestras for select to authenticated
  using ((select public.tiene_permiso('laboratorio.ver')));
create policy muestras_insert on public.muestras for insert to authenticated
  with check ((select public.tiene_permiso('laboratorio.editar')));
create policy muestras_update on public.muestras for update to authenticated
  using ((select public.tiene_permiso('laboratorio.editar')))
  with check ((select public.tiene_permiso('laboratorio.editar')));
