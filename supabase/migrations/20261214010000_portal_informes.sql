-- Portal de clientes, paso 2: informes de laboratorio publicados (D63).
-- Un informe validado no aparece en el portal hasta que alguien con
-- laboratorio.validar lo publica. Reabrirlo lo retira.

alter table public.informes
  add column publicado_at timestamptz,
  add column publicado_por uuid references public.perfiles (id),
  add constraint informes_publicado_check check (
    (publicado_at is null and publicado_por is null) or estado = 'validado'
  );
comment on column public.informes.publicado_at is
  'Desde cuándo el cliente lo ve en el portal. Solo un informe validado se publica.';
create index informes_publicado_por_idx on public.informes (publicado_por);

-- Igual que antes, más la publicación: es lo único que cambia en un validado.
create or replace function public.informes_proteger()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  c_publicacion constant text[] := array['publicado_at', 'publicado_por', 'updated_at'];
begin
  if tg_op = 'INSERT' then
    new.estado := 'borrador';
    new.elaboro_id := coalesce((select auth.uid()), new.elaboro_id);
    new.valido_id := null;
    new.validado_at := null;
    new.contenido := null;
    new.publicado_at := null;
    new.publicado_por := null;
    return new;
  end if;

  new.cuenta_id := old.cuenta_id;
  new.planta_id := old.planta_id;
  new.equipo_cliente_id := old.equipo_cliente_id;
  new.elaboro_id := old.elaboro_id;

  if new.estado = old.estado then
    if old.estado = 'validado' then
      -- Publicar o retirar del portal: nada más cambia.
      if (new.publicado_at is null) <> (old.publicado_at is null)
         and (to_jsonb(new) - c_publicacion) = (to_jsonb(old) - c_publicacion) then
        if not (select public.tiene_permiso('laboratorio.validar')) then
          raise exception 'Tu rol no puede publicar informes.' using errcode = '42501';
        end if;
        if new.publicado_at is null then
          new.publicado_por := null;
        else
          new.publicado_at := now();
          new.publicado_por := (select auth.uid());
        end if;
        return new;
      end if;
      if new.deleted_at is not distinct from old.deleted_at then
        raise exception 'El informe ya está validado. Para corregirlo hay que reabrirlo.' using errcode = 'P0001';
      end if;
      raise exception 'Un informe validado no se elimina. Reábrelo primero.' using errcode = 'P0001';
    end if;
    new.valido_id := null;
    new.validado_at := null;
    new.contenido := null;
    new.publicado_at := null;
    new.publicado_por := null;
    return new;
  end if;

  if not (select public.tiene_permiso('laboratorio.validar')) then
    raise exception 'Tu rol no puede validar informes.' using errcode = '42501';
  end if;
  -- Validar no publica, y reabrir retira del portal.
  new.publicado_at := null;
  new.publicado_por := null;
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

-- Lo que el cliente ve: solo informes publicados de su cuenta.
create function public.portal_informes()
returns table (
  id uuid, folio text, fecha_emision date, planta text, equipo text, equipo_alias text,
  condicion_general text, muestras integer, recomienda_cambio_filtro boolean, publicado_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, i.folio, i.fecha_emision, p.nombre, e.identificador, e.alias,
         i.contenido ->> 'condicionGeneral', jsonb_array_length(i.contenido -> 'muestras'),
         i.recomienda_cambio_filtro, i.publicado_at
  from public.informes i
  join public.plantas p on p.id = i.planta_id
  join public.equipos_cliente e on e.id = i.equipo_cliente_id
  where i.cuenta_id = public.mi_cuenta_portal()
    and i.estado = 'validado'
    and i.publicado_at is not null
    and i.deleted_at is null
  order by i.fecha_emision desc, i.folio desc;
$$;
comment on function public.portal_informes() is
  'Portal: informes de laboratorio publicados de la cuenta del usuario actual.';

-- Un informe publicado completo: lo mismo que imprime su PDF, nada más.
create function public.portal_informe(p_informe uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', i.id,
    'folio', i.folio,
    'fecha_emision', i.fecha_emision,
    'observaciones', i.observaciones,
    'recomienda_cambio_filtro', i.recomienda_cambio_filtro,
    'validado_at', i.validado_at,
    'contenido', i.contenido,
    'cliente', c.nombre,
    'planta', p.nombre,
    'direccion', jsonb_build_object(
      'calle', p.calle, 'numero_exterior', p.numero_exterior, 'numero_interior', p.numero_interior,
      'colonia', p.colonia, 'municipio', p.municipio, 'estado', p.estado, 'codigo_postal', p.codigo_postal),
    'equipo', jsonb_build_object(
      'identificador', e.identificador, 'alias', e.alias, 'aplicacion', e.aplicacion,
      'volumen_reservorio_l', e.volumen_reservorio_l,
      'aceite', (select a.marca || ' ' || a.nombre_comercial from public.aceites a where a.id = e.aceite_id)),
    'elaboro', (select pf.nombre from public.perfiles pf where pf.id = i.elaboro_id),
    'valido', (select pf.nombre from public.perfiles pf where pf.id = i.valido_id),
    'id_caso', (select m.id_caso from public.muestras m
                where m.id = (i.contenido -> 'muestras' -> -1 ->> 'id')::uuid)
  )
  from public.informes i
  join public.cuentas c on c.id = i.cuenta_id
  join public.plantas p on p.id = i.planta_id
  join public.equipos_cliente e on e.id = i.equipo_cliente_id
  where i.id = p_informe
    and i.cuenta_id = public.mi_cuenta_portal()
    and i.estado = 'validado'
    and i.publicado_at is not null
    and i.deleted_at is null;
$$;
comment on function public.portal_informe(uuid) is
  'Portal: un informe publicado de la cuenta del usuario actual, con lo que imprime su PDF. Null si no le toca.';

revoke execute on function public.portal_informes() from public, anon;
revoke execute on function public.portal_informe(uuid) from public, anon;
grant execute on function public.portal_informes() to authenticated;
grant execute on function public.portal_informe(uuid) to authenticated;
