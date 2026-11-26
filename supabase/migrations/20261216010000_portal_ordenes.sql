-- Portal de clientes, paso 4: órdenes de servicio (D65).
-- El cliente ve las visitas cerradas en sus plantas y su reporte firmado.
-- No ve órdenes programadas, en curso, canceladas ni de taller, ni las notas
-- internas con las que se programó la orden.

create function public.portal_ordenes()
returns table (
  id uuid, folio text, fecha date, planta text, equipo text, equipo_alias text,
  robox text, tecnico text
)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.folio, coalesce(o.fecha_real, o.fecha_programada), p.nombre,
         e.identificador, e.alias, r.numero_serie, t.nombre
  from public.ordenes_servicio o
  join public.plantas p on p.id = o.planta_id
  left join public.equipos_cliente e on e.id = o.equipo_cliente_id
  left join public.robox r on r.id = o.robox_id
  join public.perfiles t on t.id = o.tecnico_id
  where o.cuenta_id = public.mi_cuenta_portal()
    and o.tipo = 'visita'
    and o.estado = 'cerrada'
    and o.deleted_at is null
  order by coalesce(o.fecha_real, o.fecha_programada) desc, o.folio desc;
$$;
comment on function public.portal_ordenes() is
  'Portal: visitas cerradas en las plantas de la cuenta del usuario actual.';

-- Una visita cerrada con lo que imprime su reporte: lo capturado, las firmas
-- y los catálogos con los que se dibujan las casillas.
create function public.portal_orden(p_orden uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'orden', jsonb_build_object(
      'id', o.id, 'folio', o.folio, 'tipo', o.tipo, 'estado', o.estado,
      'fecha_programada', o.fecha_programada, 'fecha_real', o.fecha_real,
      'cliente', c.nombre, 'planta', p.nombre,
      'direccion', jsonb_build_object(
        'calle', p.calle, 'numero_exterior', p.numero_exterior, 'numero_interior', p.numero_interior,
        'colonia', p.colonia, 'municipio', p.municipio, 'estado', p.estado, 'codigo_postal', p.codigo_postal),
      'robox', (select r.numero_serie from public.robox r where r.id = o.robox_id),
      'tecnico', (select t.nombre from public.perfiles t where t.id = o.tecnico_id),
      'acompanante', (select t.nombre from public.perfiles t where t.id = o.acompanante_id)),
    'equipo', (
      select jsonb_build_object(
        'identificador', e.identificador, 'alias', e.alias, 'aplicacion', e.aplicacion,
        'aceite', (select a.marca || ' ' || a.nombre_comercial from public.aceites a where a.id = e.aceite_id))
      from public.equipos_cliente e where e.id = o.equipo_cliente_id),
    'filas', jsonb_build_object(
      'orden', jsonb_build_object(
        'id_caso', o.id_caso, 'temperatura_aceite_c', o.temperatura_aceite_c,
        'volumen_reservorio_l', o.volumen_reservorio_l, 'observaciones', o.observaciones),
      'lecturas', coalesce((
        select jsonb_agg(to_jsonb(l) - array['id', 'orden_id', 'created_at', 'updated_at', 'created_by'])
        from public.os_lecturas l where l.orden_id = o.id), '[]'::jsonb),
      'actividades', coalesce((
        select jsonb_agg(jsonb_build_object('actividad_id', x.actividad_id, 'cantidad', x.cantidad))
        from public.os_actividades x where x.orden_id = o.id), '[]'::jsonb),
      'fallas', coalesce((
        select jsonb_agg(jsonb_build_object('falla_id', x.falla_id))
        from public.os_fallas x where x.orden_id = o.id), '[]'::jsonb),
      'firmas', coalesce((
        select jsonb_agg(jsonb_build_object(
          'rol', x.rol, 'nombre', x.nombre, 'cargo', x.cargo, 'fecha', x.fecha, 'trazos', x.trazos))
        from public.os_firmas x where x.orden_id = o.id), '[]'::jsonb),
      'partes', coalesce((
        select jsonb_agg(jsonb_build_object('parte_id', x.parte_id, 'cantidad', x.cantidad))
        from public.os_partes x where x.orden_id = o.id), '[]'::jsonb)),
    'catalogos', jsonb_build_object(
      'actividades', coalesce((
        select jsonb_agg(jsonb_build_object('id', a.id, 'nombre', a.nombre) order by a.orden, a.nombre)
        from public.actividades a
        where a.activo or exists (
          select 1 from public.os_actividades x where x.orden_id = o.id and x.actividad_id = a.id)), '[]'::jsonb),
      'fallas', coalesce((
        select jsonb_agg(jsonb_build_object('id', f.id, 'nombre', f.nombre) order by f.orden, f.nombre)
        from public.fallas f
        where f.activo or exists (
          select 1 from public.os_fallas x where x.orden_id = o.id and x.falla_id = f.id)), '[]'::jsonb),
      -- Solo las partes que se usaron: el cliente no ve el catálogo de partes.
      'partes', coalesce((
        select jsonb_agg(jsonb_build_object('id', pa.id, 'nombre', pa.nombre) order by pa.orden, pa.nombre)
        from public.partes pa
        where exists (
          select 1 from public.os_partes x where x.orden_id = o.id and x.parte_id = pa.id)), '[]'::jsonb))
  )
  from public.ordenes_servicio o
  join public.cuentas c on c.id = o.cuenta_id
  join public.plantas p on p.id = o.planta_id
  where o.id = p_orden
    and o.cuenta_id = public.mi_cuenta_portal()
    and o.tipo = 'visita'
    and o.estado = 'cerrada'
    and o.deleted_at is null;
$$;
comment on function public.portal_orden(uuid) is
  'Portal: una visita cerrada de la cuenta del usuario actual, con lo que imprime su reporte. Null si no le toca.';

revoke execute on function public.portal_ordenes() from public, anon;
revoke execute on function public.portal_orden(uuid) from public, anon;
grant execute on function public.portal_ordenes() to authenticated;
grant execute on function public.portal_orden(uuid) to authenticated;
