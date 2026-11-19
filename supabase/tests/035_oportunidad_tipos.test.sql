-- Tipos de oportunidad: cliente nuevo, ampliación (up sell) y venta cruzada (cross sell).
begin;
select plan(3);

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
with c as (insert into public.cuentas (nombre) values ('ZZ Tipos') returning id)
insert into pruebas.d select 'cuenta', id from c;

select pruebas.entrar('comercial');
select lives_ok(
  $$insert into public.oportunidades (cuenta_id, nombre, responsable_id, tipo, origen)
    values (pruebas.id('cuenta'), 'Laboratorio para otra planta', pruebas.uid('comercial'), 'venta_cruzada', 'cliente_anterior')$$,
  'comercial registra una venta cruzada'
);
select lives_ok(
  $$insert into public.oportunidades (cuenta_id, nombre, responsable_id, tipo, origen)
    values (pruebas.id('cuenta'), 'Segundo Robox', pruebas.uid('comercial'), 'ampliacion', 'cliente_anterior')$$,
  'y una ampliación'
);
select throws_ok(
  $$insert into public.oportunidades (cuenta_id, nombre, responsable_id, tipo, origen)
    values (pruebas.id('cuenta'), 'Otra', pruebas.uid('comercial'), 'regalo', 'cliente_anterior')$$,
  '23514', null, 'no hay otros tipos'
);

select * from finish();
rollback;
