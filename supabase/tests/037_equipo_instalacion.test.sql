-- Datos de instalación del sitio en el equipo del cliente.
begin;
select plan(4);

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
with c as (insert into public.cuentas (nombre) values ('ZZ Instalación') returning id)
insert into pruebas.d select 'cuenta', id from c;
with p as (insert into public.plantas (cuenta_id, nombre) values (pruebas.id('cuenta'), 'Planta') returning id)
insert into pruebas.d select 'planta', id from p;
with e as (insert into public.equipos_cliente (planta_id, identificador) values (pruebas.id('planta'), 'EQ-1') returning id)
insert into pruebas.d select 'equipo', id from e;

select pruebas.entrar('comercial');
select lives_ok(
  $$update public.equipos_cliente set voltaje = '220 V trifásico', corriente = '16 A', distancia_reservorio_m = 4.5
    where id = pruebas.id('equipo')$$,
  'comercial captura los datos de instalación'
);
select throws_ok(
  $$update public.equipos_cliente set distancia_reservorio_m = 0 where id = pruebas.id('equipo')$$,
  '23514', null, 'la distancia debe ser mayor que cero'
);

select pruebas.entrar('tecnico');
select is(
  (select row(voltaje, corriente, distancia_reservorio_m)::text from public.equipos_cliente where id = pruebas.id('equipo')),
  '("220 V trifásico","16 A",4.5)', 'el técnico los consulta'
);
with c as (update public.equipos_cliente set voltaje = '110 V' where id = pruebas.id('equipo') returning 1)
select is((select count(*)::int from c), 0, 'pero no los cambia');

select * from finish();
rollback;
