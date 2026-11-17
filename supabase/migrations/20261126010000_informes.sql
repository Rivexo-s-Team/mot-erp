-- Etapa 4, paso 4: informes de laboratorio por equipo (DISENO §4.5).
--
-- Un informe reúne las muestras de un equipo del cliente y muestra su
-- tendencia. Mientras es borrador se calcula con los resultados y límites
-- vigentes; al validarlo se guarda una copia fija de lo que dice (contenido),
-- para que un cambio posterior de límites no altere un informe ya validado.
--
-- PENDIENTE(P4): accesos tentativos. Todos los internos consultan;
-- Laboratorio y Dirección elaboran y validan (puede ser la misma persona).
-- PENDIENTE(P1): el folio es texto libre con una sugerencia.
-- La publicación al cliente llega con el portal; solo se publicará lo validado.

-- Para que la base impida meter en un informe la muestra de otro equipo.
alter table public.muestras
  add constraint muestras_id_equipo_key unique (id, equipo_cliente_id);

create table public.informes (
  id uuid primary key default gen_random_uuid(),
  folio text not null check (length(btrim(folio)) > 0),
  cuenta_id uuid not null references public.cuentas (id),
  planta_id uuid not null,
  equipo_cliente_id uuid not null,
  estado text not null default 'borrador' check (estado in ('borrador', 'validado')),
  fecha_emision date not null default (now() at time zone 'America/Mexico_City')::date,
  observaciones text,
  elaboro_id uuid references public.perfiles (id),
  valido_id uuid references public.perfiles (id),
  validado_at timestamptz,
  -- Copia fija de lo que dice el informe; solo existe cuando está validado.
  contenido jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  unique (id, equipo_cliente_id),
  foreign key (planta_id, cuenta_id) references public.plantas (id, cuenta_id),
  foreign key (equipo_cliente_id, planta_id) references public.equipos_cliente (id, planta_id),
  constraint informes_validado_check check (
    (estado = 'validado') = (valido_id is not null and validado_at is not null and contenido is not null)
  )
);
comment on table public.informes is
  'Informe de laboratorio de un equipo del cliente: sus muestras, tendencia, condición y observaciones.';
comment on column public.informes.contenido is
  'Lo que dice el informe (muestras, resultados, evaluación y condiciones), fijado al validarlo.';
create unique index informes_folio_vigente_key on public.informes (lower(btrim(folio)))
  where deleted_at is null;
create index informes_cuenta_idx on public.informes (cuenta_id);
create index informes_planta_idx on public.informes (planta_id);
create index informes_equipo_idx on public.informes (equipo_cliente_id);
create index informes_elaboro_idx on public.informes (elaboro_id);
create index informes_valido_idx on public.informes (valido_id);

create table public.informe_muestras (
  informe_id uuid not null,
  muestra_id uuid not null,
  equipo_cliente_id uuid not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  primary key (informe_id, muestra_id),
  foreign key (informe_id, equipo_cliente_id) references public.informes (id, equipo_cliente_id),
  foreign key (muestra_id, equipo_cliente_id) references public.muestras (id, equipo_cliente_id)
);
comment on table public.informe_muestras is 'Muestras que incluye un informe. Todas son del equipo del informe.';
create index informe_muestras_muestra_idx on public.informe_muestras (muestra_id);

insert into public.permisos (clave, descripcion) values
  ('laboratorio.validar', 'Validar informes de laboratorio y reabrir uno ya validado.');
insert into public.rol_permisos (rol_id, permiso_id)
select r.id, p.id
from (values ('direccion', 'laboratorio.validar'), ('laboratorio', 'laboratorio.validar')) as m (rol, permiso)
join public.roles r on r.clave = m.rol
join public.permisos p on p.clave = m.permiso;
update public.permisos
set descripcion = 'Registrar y corregir muestras, capturar sus resultados y elaborar informes.'
where clave = 'laboratorio.editar';

-- Quién elaboró y quién validó lo anota la base, no la pantalla. Un informe
-- validado no cambia: para corregirlo hay que reabrirlo, y eso borra la
-- validación. Validar y reabrir piden el permiso laboratorio.validar.
create function public.informes_proteger()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.estado := 'borrador';
    new.elaboro_id := coalesce((select auth.uid()), new.elaboro_id);
    new.valido_id := null;
    new.validado_at := null;
    new.contenido := null;
    return new;
  end if;

  new.cuenta_id := old.cuenta_id;
  new.planta_id := old.planta_id;
  new.equipo_cliente_id := old.equipo_cliente_id;
  new.elaboro_id := old.elaboro_id;

  if new.estado = old.estado then
    if old.estado = 'validado' and new.deleted_at is not distinct from old.deleted_at then
      raise exception 'El informe ya está validado. Para corregirlo hay que reabrirlo.' using errcode = 'P0001';
    end if;
    if old.estado = 'validado' then
      raise exception 'Un informe validado no se elimina. Reábrelo primero.' using errcode = 'P0001';
    end if;
    new.valido_id := null;
    new.validado_at := null;
    new.contenido := null;
    return new;
  end if;

  if not (select public.tiene_permiso('laboratorio.validar')) then
    raise exception 'Tu rol no puede validar informes.' using errcode = '42501';
  end if;
  if new.estado = 'validado' then
    if new.contenido is null then
      raise exception 'Falta el contenido del informe.' using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.informe_muestras where informe_id = new.id) then
      raise exception 'El informe no tiene muestras.' using errcode = 'P0001';
    end if;
    new.valido_id := (select auth.uid());
    new.validado_at := now();
  else
    new.valido_id := null;
    new.validado_at := null;
    new.contenido := null;
  end if;
  return new;
end;
$$;
create trigger informes_proteger before insert or update on public.informes
  for each row execute function public.informes_proteger();

-- Las muestras de un informe validado tampoco cambian.
create function public.informe_muestras_proteger()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_informe uuid := coalesce(new.informe_id, old.informe_id);
begin
  if (select estado from public.informes where id = v_informe) = 'validado' then
    raise exception 'El informe ya está validado. Para corregirlo hay que reabrirlo.' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger informe_muestras_proteger before insert or update or delete on public.informe_muestras
  for each row execute function public.informe_muestras_proteger();

create trigger informes_set_updated_at before update on public.informes
  for each row execute function public.set_updated_at();
create trigger informes_set_created_by before insert on public.informes
  for each row execute function public.set_created_by();
create trigger informe_muestras_set_created_by before insert on public.informe_muestras
  for each row execute function public.set_created_by();
create trigger informes_bitacora after insert or update or delete on public.informes
  for each row execute function public.registrar_bitacora();

alter table public.informes enable row level security;
revoke all on public.informes from anon, authenticated;
grant select, insert, update on public.informes to authenticated;
create policy informes_select on public.informes for select to authenticated
  using ((select public.tiene_permiso('laboratorio.ver')));
create policy informes_insert on public.informes for insert to authenticated
  with check ((select public.tiene_permiso('laboratorio.editar')));
create policy informes_update on public.informes for update to authenticated
  using ((select public.tiene_permiso('laboratorio.editar')))
  with check ((select public.tiene_permiso('laboratorio.editar')));

alter table public.informe_muestras enable row level security;
revoke all on public.informe_muestras from anon, authenticated;
grant select, insert, delete on public.informe_muestras to authenticated;
create policy informe_muestras_select on public.informe_muestras for select to authenticated
  using ((select public.tiene_permiso('laboratorio.ver')));
create policy informe_muestras_insert on public.informe_muestras for insert to authenticated
  with check ((select public.tiene_permiso('laboratorio.editar')));
create policy informe_muestras_delete on public.informe_muestras for delete to authenticated
  using ((select public.tiene_permiso('laboratorio.editar')));
