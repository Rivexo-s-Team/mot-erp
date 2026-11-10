-- `supabase db reset` deja el sistema usable: un usuario por rol y el caso Rassini.
begin;
select plan(7);

select is(
  (select count(*)::int from public.perfiles p join auth.users u on u.id = p.id
    where u.email like '%@mot.test' and p.activo),
  6, 'hay un usuario de prueba activo por rol'
);
select is(
  (select count(distinct rol_id)::int from public.perfiles),
  (select count(*)::int from public.roles),
  'cada rol tiene al menos un usuario'
);
select is(
  (select p.nombre || ', ' || p.municipio from public.plantas p
    join public.cuentas c on c.id = p.cuenta_id where c.nombre = 'Rassini'),
  'BYPASA, San Juan del Río', 'Rassini tiene la planta BYPASA'
);
select is(
  (select string_agg(e.identificador, ',' order by e.identificador) from public.equipos_cliente e
    join public.plantas p on p.id = e.planta_id where p.nombre = 'BYPASA'),
  '11B113,11B116', 'BYPASA tiene los equipos 11B113 y 11B116'
);
select is(
  (select e.alias || ' / ' || e.aplicacion || ' / ' || e.volumen_reservorio_l || ' L / ' || a.marca || ' ' || a.nombre_comercial
     from public.equipos_cliente e join public.aceites a on a.id = e.aceite_id
    where e.identificador = '11B116'),
  'REP4 / Prensa vulcanizadora / 280 L / Mobil DTE 25', 'el 11B116 trae los datos del formato de servicio'
);
select is(
  (select estado from public.robox where numero_serie = '545592'),
  'en_cliente', 'el Robox 545592 está en el cliente'
);
select is(
  (select count(*)::int from public.parametros_negocio), 4, 'los parámetros de negocio están cargados'
);

select * from finish();
rollback;
