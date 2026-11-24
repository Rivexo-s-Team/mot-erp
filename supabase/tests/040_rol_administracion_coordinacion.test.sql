-- Rol combinado de Administración y Coordinación: la suma de los dos, ni más ni menos.
begin;
select plan(8);

create schema pruebas;
grant usage on schema pruebas to authenticated;

create function pruebas.crear_usuario(p_rol text, p_nombre text) returns uuid language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email)
  values (v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'prueba-' || v_id || '@mot.test');
  insert into public.perfiles (id, nombre, correo, rol_id)
  select v_id, p_nombre, 'prueba-' || v_id || '@mot.test', id
  from public.roles where clave = p_rol;
  return v_id;
end $$;

create table pruebas.u (rol text primary key, id uuid);
insert into pruebas.u select clave, pruebas.crear_usuario(clave, 'Prueba ' || clave) from public.roles;
grant select on pruebas.u to authenticated;

create function pruebas.entrar(p_rol text) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from pruebas.u where rol = p_rol), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pruebas.uid(p_rol text) returns uuid language sql stable as
  $$select id from pruebas.u where rol = p_rol$$;

create table pruebas.d (clave text primary key, id uuid);
grant select on pruebas.d to authenticated;
create function pruebas.id(p_clave text) returns uuid language sql stable as
  $$select id from pruebas.d where clave = p_clave$$;
with c as (insert into public.cuentas (nombre) values ('ZZ Combinado') returning id)
insert into pruebas.d select 'cuenta', id from c;
with p as (insert into public.plantas (cuenta_id, nombre) values (pruebas.id('cuenta'), 'Planta') returning id)
insert into pruebas.d select 'planta', id from p;
with r as (insert into public.razones_sociales (cuenta_id, razon_social, rfc)
  values (pruebas.id('cuenta'), 'ZZ Combinado SA de CV', 'ZZC010101AAA') returning id)
insert into pruebas.d select 'razon', id from r;
insert into pruebas.d select 'rol_tecnico', id from public.roles where clave = 'tecnico';
grant select, insert on pruebas.d to authenticated;

select is(
  (select array_agg(p.clave order by p.clave) from public.rol_permisos rp
   join public.permisos p on p.id = rp.permiso_id join public.roles r on r.id = rp.rol_id
   where r.clave = 'administracion_coordinacion'),
  (select array_agg(distinct p.clave order by p.clave) from public.rol_permisos rp
   join public.permisos p on p.id = rp.permiso_id join public.roles r on r.id = rp.rol_id
   where r.clave in ('administracion', 'coordinacion')),
  'tiene exactamente los permisos de Administración más los de Coordinación'
);
select is(
  (select count(*)::int from public.rol_permisos rp join public.permisos p on p.id = rp.permiso_id
   join public.roles r on r.id = rp.rol_id
   where r.clave = 'administracion_coordinacion'
     and p.clave in ('usuarios.administrar', 'oportunidades.editar', 'laboratorio.editar', 'parametros.editar', 'flota.editar')),
  0, 'no gana permisos de Dirección, Comercial, Laboratorio ni Técnico'
);

select pruebas.entrar('administracion_coordinacion');
select lives_ok(
  $$insert into public.ordenes_servicio (tipo, cuenta_id, planta_id, tecnico_id, fecha_programada)
    values ('visita', pruebas.id('cuenta'), pruebas.id('planta'), pruebas.uid('tecnico'), date '2037-06-01')$$,
  'programa una visita y la asigna a un técnico (lo de Coordinación)'
);
select lives_ok(
  $$insert into public.cargos (cuenta_id, tipo, concepto, cantidad, unidad, precio_unitario, moneda)
    values (pruebas.id('cuenta'), 'servicio', 'Servicio de prueba', 1, 'servicio', 100, 'USD')$$,
  'captura un cargo (lo de Administración)'
);
select lives_ok(
  $$select public.registrar_pago(pruebas.id('razon'),
      jsonb_build_object('fecha', '2037-06-02', 'monto', '50.00', 'moneda', 'USD', 'forma_pago', '03'), '[]'::jsonb)$$,
  'registra un pago'
);
select is((select count(*)::int from public.oportunidades), 0, 'no ve oportunidades');
select throws_ok(
  $$insert into public.robox (numero_serie) values ('ZZ-COMB-1')$$,
  '42501', null, 'no da de alta Robox'
);
select throws_ok(
  $$insert into public.perfiles (id, nombre, correo, rol_id)
    values (pruebas.uid('cliente'), 'X', 'x@mot.test', pruebas.id('rol_tecnico'))$$,
  '42501', null, 'no da de alta usuarios'
);

select * from finish();
rollback;
