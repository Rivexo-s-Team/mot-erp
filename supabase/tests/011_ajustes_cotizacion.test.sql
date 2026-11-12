-- Folio anual, estados de la cotización, cotizador desde contenedor y motivos de pérdida.
begin;
select plan(27);

create schema pruebas;
grant usage on schema pruebas to authenticated;

create function pruebas.crear_usuario(p_rol text) returns uuid language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email)
  values (v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'prueba-' || v_id || '@mot.test');
  insert into public.perfiles (id, nombre, correo, rol_id)
  select v_id, 'Prueba ' || p_rol, 'prueba-' || v_id || '@mot.test', id
  from public.roles where clave = p_rol;
  return v_id;
end $$;

create table pruebas.u (rol text primary key, id uuid);
insert into pruebas.u select clave, pruebas.crear_usuario(clave) from public.roles;
grant select on pruebas.u to authenticated;

create function pruebas.entrar(p_rol text) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from pruebas.u where rol = p_rol), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

insert into public.cuentas (id, nombre) values ('00000000-0000-0000-0000-0000000000c1', 'Cuenta Uno');
insert into public.oportunidades (id, cuenta_id, nombre, responsable_id, tipo, origen)
select v.id::uuid, '00000000-0000-0000-0000-0000000000c1', v.nombre, u.id, 'nuevo', 'prospeccion'
from pruebas.u u,
     (values ('00000000-0000-0000-0000-0000000000b1', 'Oportunidad Uno'),
             ('00000000-0000-0000-0000-0000000000b2', 'Oportunidad Dos')) as v (id, nombre)
where u.rol = 'comercial';

-- Punto de partida del consecutivo de este año, para no depender de datos previos.
create table pruebas.inicio as
select coalesce((select ultimo from public.folios_cotizacion
                  where anio = extract(year from (now() at time zone 'America/Mexico_City'))), 0) as n,
       extract(year from (now() at time zone 'America/Mexico_City'))::int as anio;
grant select on pruebas.inicio to authenticated;
create function pruebas.folio(p_mas int) returns text language sql as $$
  select 'CMOT ' || anio || '-' || lpad((n + p_mas)::text, 3, '0') from pruebas.inicio;
$$;

-- Folio ----------------------------------------------------------------------
select pruebas.entrar('comercial');
insert into public.cotizaciones (id, oportunidad_id, version)
  values ('00000000-0000-0000-0000-000000000071', '00000000-0000-0000-0000-0000000000b1', 1);
insert into public.cotizaciones (id, oportunidad_id, version)
  values ('00000000-0000-0000-0000-000000000072', '00000000-0000-0000-0000-0000000000b2', 1);
insert into public.cotizaciones (id, oportunidad_id, version)
  values ('00000000-0000-0000-0000-000000000073', '00000000-0000-0000-0000-0000000000b1', 2);

select is(
  (select folio from public.cotizaciones where id = '00000000-0000-0000-0000-000000000071'),
  pruebas.folio(1), 'la primera cotización recibe el siguiente folio del año (CMOT AAAA-NNN)'
);
select matches(
  (select folio from public.cotizaciones where id = '00000000-0000-0000-0000-000000000071'),
  '^CMOT \d{4}-\d{3}$', 'el folio tiene el formato CMOT AAAA-NNN'
);
select is(
  (select folio from public.cotizaciones where id = '00000000-0000-0000-0000-000000000072'),
  pruebas.folio(2), 'la cotización de otra oportunidad recibe el folio siguiente'
);
select is(
  (select folio from public.cotizaciones where id = '00000000-0000-0000-0000-000000000073'),
  pruebas.folio(1), 'la versión 2 conserva el folio de la versión 1'
);
select throws_ok(
  $$select * from public.folios_cotizacion$$, '42501', null,
  'los consecutivos no se pueden consultar ni cambiar desde la app'
);
select throws_ok(
  $$select public.siguiente_folio_cotizacion()$$, '42501', null,
  'nadie puede pedir (y gastar) folios directamente'
);

-- Estados --------------------------------------------------------------------
insert into public.cotizacion_lineas (cotizacion_id, concepto, cantidad, unidad, precio_unitario,
  numero_parte_cliente, referencia_costo_contenedor, referencia_litros_contenedor, precio_referencia, fuente_tipo)
values ('00000000-0000-0000-0000-000000000071', 'Limpieza por litro', 3120, 'litro', 10.15,
        'Limpieza por Litro', 2900, 200, 14.5, 'comprobante_cliente');
select is(
  (select importe from public.cotizacion_lineas where cotizacion_id = '00000000-0000-0000-0000-000000000071'),
  31668.00::numeric, 'el ejemplo de MOT: 3,120 L × 10.15 = 31,668.00'
);
select throws_ok(
  $$insert into public.cotizacion_lineas (cotizacion_id, concepto, cantidad, unidad, precio_unitario, referencia_costo_contenedor)
    values ('00000000-0000-0000-0000-000000000071', 'X', 1, 'litro', 1, 2900)$$,
  '23514', null, 'el costo del contenedor va junto con sus litros'
);
select throws_ok(
  $$update public.cotizaciones set estado = 'aceptada' where id = '00000000-0000-0000-0000-000000000071'$$,
  'P0001', null, 'un borrador no se puede aceptar sin enviarlo antes'
);
select lives_ok(
  $$update public.cotizaciones set estado = 'enviada' where id = '00000000-0000-0000-0000-000000000071'$$,
  'comercial marca la cotización como enviada'
);
select lives_ok(
  $$update public.cotizaciones set estado = 'aceptada' where id = '00000000-0000-0000-0000-000000000071'$$,
  'y después como aceptada'
);
select throws_ok(
  $$update public.cotizacion_lineas set precio_unitario = 1 where cotizacion_id = '00000000-0000-0000-0000-000000000071'$$,
  'P0001', null, 'una cotización aceptada no deja cambiar sus partidas'
);
select throws_ok(
  $$update public.cotizaciones set numero_requisicion = 'REQ-1' where id = '00000000-0000-0000-0000-000000000071'$$,
  'P0001', null, 'ni sus datos'
);
select throws_ok(
  $$update public.cotizaciones set estado = 'borrador' where id = '00000000-0000-0000-0000-000000000071'$$,
  'P0001', null, 'ni volver a borrador'
);
select lives_ok(
  $$update public.cotizaciones set estado = 'rechazada' where id = '00000000-0000-0000-0000-000000000071'$$,
  'sí se puede corregir de aceptada a rechazada'
);
select throws_ok(
  $$update public.cotizaciones set estado = 'cancelada' where id = '00000000-0000-0000-0000-000000000072'$$,
  '23514', null, 'el estado debe ser uno de los cuatro definidos'
);

-- Motivos de pérdida ----------------------------------------------------------
select is((select count(*)::int from public.motivos_perdida where activo), 7, 'hay 7 motivos de pérdida');
select throws_ok(
  $$update public.oportunidades set etapa = 'perdida' where id = '00000000-0000-0000-0000-0000000000b2'$$,
  '23514', null, 'perdida sigue exigiendo un motivo'
);
select lives_ok(
  $$update public.oportunidades
       set etapa = 'perdida', motivo_perdida_id = (select id from public.motivos_perdida order by orden limit 1)
     where id = '00000000-0000-0000-0000-0000000000b2'$$,
  'basta con elegir un motivo de la lista'
);
update public.oportunidades set etapa = 'seguimiento' where id = '00000000-0000-0000-0000-0000000000b2';
select is(
  (select motivo_perdida_id from public.oportunidades where id = '00000000-0000-0000-0000-0000000000b2'),
  null, 'al reabrirla se limpia el motivo de la lista'
);
select lives_ok(
  $$update public.oportunidades set etapa = 'perdida', motivo_perdida = 'Otro: cambio de dueño'
     where id = '00000000-0000-0000-0000-0000000000b2'$$,
  'o con escribir el motivo'
);
select lives_ok(
  $$insert into public.motivos_perdida (nombre, orden) values ('Precio', 80)$$,
  'comercial agrega un motivo a la lista'
);

-- Quién ve ---------------------------------------------------------------------
select pruebas.entrar('tecnico');
select is((select count(*)::int from public.motivos_perdida), 0, 'técnico no ve los motivos de pérdida');
select throws_ok(
  $$insert into public.motivos_perdida (nombre) values ('X')$$, '42501', null,
  'técnico no agrega motivos'
);
select pruebas.entrar('cliente');
select is((select count(*)::int from public.motivos_perdida), 0, 'cliente no ve los motivos de pérdida');

-- Configuración ---------------------------------------------------------------
select pruebas.entrar('direccion');
select is(
  (select valor from public.parametros_negocio where clave = 'cotizacion_vigencia_dias'),
  15::numeric, 'la vigencia por defecto es de 15 días'
);
select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity),
  0, 'todas las tablas de public tienen RLS activado'
);

select * from finish();
rollback;
