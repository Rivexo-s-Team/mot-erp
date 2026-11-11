-- Etapa 1, paso 4 (archivos): adjuntos de oportunidad (D11) y comprobante del
-- precio de referencia del cotizador (DISENO §4.2).
--
-- Los archivos viven en Storage, en buckets privados: solo se abren con un
-- enlace temporal que el sistema genera después de revisar el permiso.

-- ---------------------------------------------------------------------------
-- Buckets privados
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('adjuntos-oportunidades', 'adjuntos-oportunidades', false, 10485760,
   array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']),
  ('comprobantes-precio', 'comprobantes-precio', false, 10485760,
   array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']);

-- Adjuntos de oportunidad: los ve y los sube quien ve o edita el pipeline.
create policy adjuntos_oportunidades_select on storage.objects for select to authenticated
  using (bucket_id = 'adjuntos-oportunidades'
     and (select public.tiene_permiso('oportunidades.ver')));
create policy adjuntos_oportunidades_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'adjuntos-oportunidades'
          and (select public.tiene_permiso('oportunidades.editar')));

-- Comprobantes de precio: además exigen poder ver precios.
create policy comprobantes_precio_select on storage.objects for select to authenticated
  using (bucket_id = 'comprobantes-precio'
     and (select public.tiene_permiso('oportunidades.ver'))
     and (select public.tiene_permiso('precios.ver')));
create policy comprobantes_precio_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'comprobantes-precio'
          and (select public.tiene_permiso('oportunidades.editar'))
          and (select public.tiene_permiso('precios.ver')));

-- Sin políticas de update ni delete: un archivo subido no se reemplaza ni se
-- borra desde la app. Quitar un adjunto solo lo oculta (deleted_at).

-- ---------------------------------------------------------------------------
-- Adjuntos de oportunidad
-- ---------------------------------------------------------------------------

create table public.oportunidad_adjuntos (
  id uuid primary key default gen_random_uuid(),
  oportunidad_id uuid not null references public.oportunidades (id),
  nombre text not null check (length(btrim(nombre)) > 0),
  -- Ruta dentro del bucket adjuntos-oportunidades: <oportunidad_id>/<archivo>.
  ruta text not null unique,
  tipo_mime text not null,
  tamano_bytes bigint not null check (tamano_bytes > 0),
  -- Etapa en la que estaba la oportunidad al subirlo (para ubicar muestra y resultados).
  etapa text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  constraint oportunidad_adjuntos_ruta_check
    check (ruta like oportunidad_id::text || '/%')
);
comment on table public.oportunidad_adjuntos is
  'Archivos de una oportunidad: informe de laboratorio, foto de la muestra, etc. El archivo está en Storage; aquí queda su registro.';
create index oportunidad_adjuntos_oportunidad_idx on public.oportunidad_adjuntos (oportunidad_id);

create trigger oportunidad_adjuntos_set_updated_at before update on public.oportunidad_adjuntos
  for each row execute function public.set_updated_at();
create trigger oportunidad_adjuntos_set_created_by before insert on public.oportunidad_adjuntos
  for each row execute function public.set_created_by();

alter table public.oportunidad_adjuntos enable row level security;
revoke all on public.oportunidad_adjuntos from anon, authenticated;
grant select, insert, update on public.oportunidad_adjuntos to authenticated;

create policy oportunidad_adjuntos_select on public.oportunidad_adjuntos for select to authenticated
  using ((select public.tiene_permiso('oportunidades.ver')));
create policy oportunidad_adjuntos_insert on public.oportunidad_adjuntos for insert to authenticated
  with check ((select public.tiene_permiso('oportunidades.editar')));
create policy oportunidad_adjuntos_update on public.oportunidad_adjuntos for update to authenticated
  using ((select public.tiene_permiso('oportunidades.editar')))
  with check ((select public.tiene_permiso('oportunidades.editar')));

-- ---------------------------------------------------------------------------
-- Comprobante del precio de referencia en la partida
-- ---------------------------------------------------------------------------

alter table public.cotizacion_lineas
  add column fuente_archivo_ruta text,
  add column fuente_archivo_nombre text,
  add constraint cotizacion_lineas_fuente_archivo_check
    check (
      (fuente_archivo_ruta is null and fuente_archivo_nombre is null)
      or (fuente_archivo_ruta is not null and fuente_archivo_nombre is not null)
    );
comment on column public.cotizacion_lineas.fuente_archivo_ruta is
  'Ruta del comprobante en el bucket comprobantes-precio. Una versión nueva de la cotización reutiliza el mismo archivo.';
