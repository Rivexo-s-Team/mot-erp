-- Estado Bloqueado del Robox: apartado para un cliente, sin estar asignado todavía.
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
with c as (insert into public.cuentas (nombre) values ('ZZ Bloqueos') returning id)
insert into pruebas.d select 'cuenta', id from c;
with p as (insert into public.plantas (cuenta_id, nombre) values (pruebas.id('cuenta'), 'Planta') returning id)
insert into pruebas.d select 'planta', id from p;
with k as (insert into public.contratos (cuenta_id, planta_id, tipo, estado, moneda)
  values (pruebas.id('cuenta'), pruebas.id('planta'), 'renta', 'vigente', 'USD') returning id)
insert into pruebas.d select 'contrato', id from k;
with r as (insert into public.robox (numero_serie) values ('ZZ-BLOQ-1') returning id)
insert into pruebas.d select 'robox', id from r;

select pruebas.entrar('tecnico');
select lives_ok(
  $$update public.robox set estado = 'bloqueado', notas = 'Apartado para ZZ Bloqueos' where id = pruebas.id('robox')$$,
  'operación aparta un Robox: queda bloqueado'
);
select throws_ok(
  $$update public.robox set estado = 'reservado' where id = pruebas.id('robox')$$,
  '23514', null, 'no hay otros estados'
);

select pruebas.entrar('direccion');
select lives_ok(
  $$insert into public.asignaciones_robox (robox_id, contrato_id, planta_id, fecha_inicio)
    values (pruebas.id('robox'), pruebas.id('contrato'), pruebas.id('planta'), date '2037-02-01')$$,
  'un Robox bloqueado sí se puede asignar al contrato'
);
select is((select estado from public.robox where id = pruebas.id('robox')), 'en_cliente',
  'al asignarlo pasa a en cliente');
select throws_ok(
  $$update public.robox set estado = 'bloqueado' where id = pruebas.id('robox')$$,
  'P0001', null, 'asignado, no se puede marcar bloqueado a mano'
);
select lives_ok(
  $$update public.asignaciones_robox set fecha_fin = date '2037-03-01' where robox_id = pruebas.id('robox')$$,
  'se termina la asignación'
);
select is((select estado from public.robox where id = pruebas.id('robox')), 'disponible',
  'y vuelve a disponible, no a bloqueado');

select pruebas.entrar('comercial');
with c as (update public.robox set estado = 'bloqueado' where id = pruebas.id('robox') returning 1)
select is((select count(*)::int from c), 0, 'comercial consulta la flota pero no bloquea');

select * from finish();
rollback;
