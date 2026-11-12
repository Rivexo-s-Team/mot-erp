-- Etapa 2, paso 1: flota de Robox (DISENO §4.3).
-- La tabla robox ya existe en versión mínima; aquí se completa y se abre al área técnica.

alter table public.robox add column notas text;

-- El número de serie es único entre los Robox vigentes (sin distinguir mayúsculas).
alter table public.robox drop constraint robox_numero_serie_key;
create unique index robox_numero_serie_vigente_key on public.robox (lower(btrim(numero_serie)))
  where deleted_at is null;
create index robox_estado_idx on public.robox (estado) where deleted_at is null;

-- El área técnica lleva el inventario de Robox: Técnico también lo edita (D19).
insert into public.rol_permisos (rol_id, permiso_id)
select r.id, p.id
from public.roles r
join public.permisos p on p.clave = 'flota.editar'
where r.clave = 'tecnico'
on conflict (rol_id, permiso_id) do nothing;
