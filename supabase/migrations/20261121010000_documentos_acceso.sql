-- Etapa 3, paso 6 (segunda parte): acceso a planta (DISENO §4.4): "antes de
-- cada visita se muestra la lista de requisitos de la planta y qué documentos
-- de MOT o del técnico están por vencer".
--
-- Los tipos de documento son una lista editable (D26): hoy REPSE y equipo de
-- protección, que confirmó el director comercial, e IMSS como opcional.
--
-- PENDIENTE(P4): accesos tentativos. Todos los internos consultan los
-- documentos; los registran Dirección y Administración.

-- ---------------------------------------------------------------------------
-- Tipos de documento (catálogo)
-- ---------------------------------------------------------------------------
create table public.tipos_documento_acceso (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique check (length(btrim(nombre)) > 0),
  -- 'empresa': uno de MOT. 'persona': uno por cada quien entra a planta.
  aplica_a text not null check (aplica_a in ('empresa', 'persona')),
  orden integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);
comment on table public.tipos_documento_acceso is
  'Documentos que las plantas piden para dejar entrar: de la empresa (REPSE) o de cada persona (IMSS, equipo de protección).';

insert into public.tipos_documento_acceso (nombre, aplica_a, orden) values
  ('REPSE', 'empresa', 10),
  ('Equipo de protección personal (EPP)', 'persona', 20),
  ('IMSS', 'persona', 30);

create trigger tipos_documento_acceso_set_updated_at before update on public.tipos_documento_acceso
  for each row execute function public.set_updated_at();
create trigger tipos_documento_acceso_set_created_by before insert on public.tipos_documento_acceso
  for each row execute function public.set_created_by();

alter table public.tipos_documento_acceso enable row level security;
revoke all on public.tipos_documento_acceso from anon, authenticated;
grant select, insert, update on public.tipos_documento_acceso to authenticated;
create policy tipos_documento_acceso_select on public.tipos_documento_acceso for select to authenticated
  using ((select public.tiene_permiso('catalogos.ver')));
create policy tipos_documento_acceso_insert on public.tipos_documento_acceso for insert to authenticated
  with check ((select public.tiene_permiso('catalogos_operacion.editar')));
create policy tipos_documento_acceso_update on public.tipos_documento_acceso for update to authenticated
  using ((select public.tiene_permiso('catalogos_operacion.editar')))
  with check ((select public.tiene_permiso('catalogos_operacion.editar')));

-- ---------------------------------------------------------------------------
-- Documentos
-- ---------------------------------------------------------------------------
create table public.documentos_acceso (
  id uuid primary key default gen_random_uuid(),
  tipo_id uuid not null references public.tipos_documento_acceso (id),
  -- De quién es. Vacío = de MOT.
  perfil_id uuid references public.perfiles (id),
  -- Vacío = no vence.
  fecha_vencimiento date,
  -- Archivo en el bucket documentos-acceso: <id del documento>/<archivo>. Se sube una sola vez.
  archivo_ruta text unique,
  archivo_nombre text,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  constraint documentos_acceso_archivo_check check (
    (archivo_ruta is null and archivo_nombre is null)
    or (archivo_ruta like id::text || '/%' and archivo_nombre is not null)
  )
);
comment on table public.documentos_acceso is
  'Documentos de MOT y de su personal para entrar a planta, con su vencimiento. Al renovar uno se registra otro; el más reciente es el que cuenta.';
create index documentos_acceso_tipo_idx on public.documentos_acceso (tipo_id);
create index documentos_acceso_perfil_idx on public.documentos_acceso (perfil_id);

-- Un documento de empresa no lleva persona; uno de persona, sí. Y el archivo no se reemplaza.
create function public.documentos_acceso_validar()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_aplica text;
begin
  select aplica_a into v_aplica from public.tipos_documento_acceso where id = new.tipo_id;
  if v_aplica = 'persona' and new.perfil_id is null then
    raise exception 'Ese documento es de una persona: indica de quién.' using errcode = 'P0001';
  end if;
  if v_aplica = 'empresa' and new.perfil_id is not null then
    raise exception 'Ese documento es de MOT, no de una persona.' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and old.archivo_ruta is not null
     and new.archivo_ruta is distinct from old.archivo_ruta then
    raise exception 'El archivo de un documento no se reemplaza; registra un documento nuevo.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger documentos_acceso_validar before insert or update on public.documentos_acceso
  for each row execute function public.documentos_acceso_validar();

create trigger documentos_acceso_set_updated_at before update on public.documentos_acceso
  for each row execute function public.set_updated_at();
create trigger documentos_acceso_set_created_by before insert on public.documentos_acceso
  for each row execute function public.set_created_by();

insert into public.permisos (clave, descripcion) values
  ('documentos_acceso.ver', 'Consultar los documentos de acceso a planta de MOT y de su personal.'),
  ('documentos_acceso.editar', 'Registrar documentos de acceso a planta y subir sus archivos.');
insert into public.rol_permisos (rol_id, permiso_id)
select r.id, p.id
from (values
  ('direccion', 'documentos_acceso.ver'), ('comercial', 'documentos_acceso.ver'),
  ('tecnico', 'documentos_acceso.ver'), ('laboratorio', 'documentos_acceso.ver'),
  ('administracion', 'documentos_acceso.ver'),
  ('direccion', 'documentos_acceso.editar'), ('administracion', 'documentos_acceso.editar')
) as m (rol, permiso)
join public.roles r on r.clave = m.rol
join public.permisos p on p.clave = m.permiso;

alter table public.documentos_acceso enable row level security;
revoke all on public.documentos_acceso from anon, authenticated;
grant select, insert, update on public.documentos_acceso to authenticated;
create policy documentos_acceso_select on public.documentos_acceso for select to authenticated
  using ((select public.tiene_permiso('documentos_acceso.ver')));
create policy documentos_acceso_insert on public.documentos_acceso for insert to authenticated
  with check ((select public.tiene_permiso('documentos_acceso.editar')));
create policy documentos_acceso_update on public.documentos_acceso for update to authenticated
  using ((select public.tiene_permiso('documentos_acceso.editar')))
  with check ((select public.tiene_permiso('documentos_acceso.editar')));

-- Archivos: bucket privado. Sin update ni delete: no se reemplazan ni se borran.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos-acceso', 'documentos-acceso', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']);
create policy documentos_acceso_archivos_select on storage.objects for select to authenticated
  using (bucket_id = 'documentos-acceso' and (select public.tiene_permiso('documentos_acceso.ver')));
create policy documentos_acceso_archivos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos-acceso' and (select public.tiene_permiso('documentos_acceso.editar')));

-- Con cuántos días de anticipación se avisa que un documento está por vencer.
-- PENDIENTE(P4): 30 días es un valor inicial; MOT lo ajusta en Parámetros.
insert into public.parametros_negocio (clave, valor, unidad, moneda, descripcion) values
  ('documento_aviso_dias', 30, 'dias', null,
   'Días antes del vencimiento a partir de los cuales un documento de acceso se marca "por vencer".');

-- Quien ve los documentos necesita ese número aunque no vea los demás parámetros.
create function public.documento_aviso_dias()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case when (select public.tiene_permiso('documentos_acceso.ver')) then (
    select valor::integer from public.parametros_negocio where clave = 'documento_aviso_dias'
  ) end;
$$;
comment on function public.documento_aviso_dias() is
  'Días de anticipación del aviso de vencimiento, para quien ve los documentos de acceso.';
revoke execute on function public.documento_aviso_dias() from public, anon;
grant execute on function public.documento_aviso_dias() to authenticated;
