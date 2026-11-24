-- Portal de clientes: quién entra y a qué cuenta pertenece.
begin;
select plan(16);

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
-- Un segundo usuario de portal, de otra cuenta, y uno más sin perfil todavía.
insert into pruebas.u values ('cliente_b', pruebas.crear_usuario('cliente', 'Prueba cliente B'));
insert into pruebas.u values ('nuevo', gen_random_uuid());
insert into auth.users (id, instance_id, aud, role, email)
select id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prueba-nuevo@mot.test'
from pruebas.u where rol = 'nuevo';
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
with c as (insert into public.cuentas (nombre) values ('ZZ Portal A') returning id)
insert into pruebas.d select 'a', id from c;
with c as (insert into public.cuentas (nombre) values ('ZZ Portal B') returning id)
insert into pruebas.d select 'b', id from c;

-- Sin liga, el usuario con rol cliente no pertenece a ninguna cuenta.
select pruebas.entrar('cliente');
select is(public.mi_cuenta_portal(), null, 'sin liga a una cuenta, el cliente no tiene cuenta');
select is((select count(*)::int from public.portal_mi_cuenta()), 0, 'y el portal no le da ninguna');
select throws_ok(
  $$insert into public.usuarios_portal (perfil_id, cuenta_id) values (pruebas.uid('cliente'), pruebas.id('a'))$$,
  '42501', null, 'el cliente no se da acceso a sí mismo'
);

select pruebas.entrar('comercial');
select throws_ok(
  $$insert into public.usuarios_portal (perfil_id, cuenta_id) values (pruebas.uid('cliente'), pruebas.id('a'))$$,
  '42501', null, 'comercial no da acceso al portal'
);
select throws_ok(
  $$select public.crear_usuario_portal(pruebas.uid('nuevo'), pruebas.id('a'), 'Nuevo', 'prueba-nuevo@mot.test', '')$$,
  '42501', null, 'ni con la función de alta'
);

select pruebas.entrar('direccion');
select lives_ok(
  $$insert into public.usuarios_portal (perfil_id, cuenta_id) values
      (pruebas.uid('cliente'), pruebas.id('a')), (pruebas.uid('cliente_b'), pruebas.id('b'))$$,
  'dirección liga a cada usuario del portal con su cuenta'
);
select throws_ok(
  $$insert into public.usuarios_portal (perfil_id, cuenta_id) values (pruebas.uid('tecnico'), pruebas.id('a'))$$,
  '23514', null, 'un usuario interno no puede ser del portal'
);
select throws_ok(
  $$insert into public.usuarios_portal (perfil_id, cuenta_id) values (pruebas.uid('cliente'), pruebas.id('b'))$$,
  '23505', null, 'un usuario del portal pertenece a una sola cuenta'
);
select throws_ok(
  $$update public.perfiles set rol_id = (select id from public.roles where clave = 'direccion')
    where id = pruebas.uid('cliente')$$,
  '23514', null, 'a un usuario del portal no se le da un rol interno'
);
select lives_ok(
  $$select public.crear_usuario_portal(pruebas.uid('nuevo'), pruebas.id('a'), 'Nuevo del portal', 'prueba-nuevo@mot.test', ' Compras ')$$,
  'el alta crea el perfil y su liga de una vez'
);
select is(
  (select row(pf.puesto, r.clave, up.cuenta_id = pruebas.id('a'))::text
   from public.perfiles pf join public.roles r on r.id = pf.rol_id
   join public.usuarios_portal up on up.perfil_id = pf.id where pf.id = pruebas.uid('nuevo')),
  '(Compras,cliente,t)', 'con rol cliente y en la cuenta indicada'
);

select pruebas.entrar('cliente');
select is(
  (select nombre from public.portal_mi_cuenta()), 'ZZ Portal A', 'el cliente ve el nombre de su cuenta'
);
select is(
  (select count(*)::int from public.usuarios_portal), 1, 'y solo su propia liga, no la de otros usuarios'
);
select is((select count(*)::int from public.cuentas), 0, 'no lee la tabla de cuentas');

select pruebas.entrar('cliente_b');
select is(public.mi_cuenta_portal(), pruebas.id('b'), 'el usuario de otra cuenta ve la suya');

-- Desactivado, deja de tener cuenta.
select pruebas.entrar('direccion');
update public.perfiles set activo = false where id = pruebas.uid('cliente_b');
select pruebas.entrar('cliente_b');
select is(public.mi_cuenta_portal(), null, 'desactivado, ya no tiene cuenta en el portal');

select * from finish();
rollback;
