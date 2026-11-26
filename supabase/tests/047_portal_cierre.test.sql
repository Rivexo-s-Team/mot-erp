-- Portal de clientes, cierre: un usuario del portal no lee ninguna tabla ni vista interna.
-- Recorre todo el esquema público, así que una tabla nueva que se abra por error lo hace fallar.
begin;
select plan(5);

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
insert into pruebas.u values ('cliente_b', pruebas.crear_usuario('cliente', 'Prueba cliente B'));
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
grant select, insert on pruebas.d to authenticated;
create function pruebas.id(p_clave text) returns uuid language sql stable as
  $$select id from pruebas.d where clave = p_clave$$;

with c as (insert into public.cuentas (nombre) values ('ZZ Cierre portal') returning id)
insert into pruebas.d select 'cuenta', id from c;
insert into public.usuarios_portal (perfil_id, cuenta_id) values (pruebas.uid('cliente'), pruebas.id('cuenta'));

-- Filas que el usuario actual alcanza a ver en cada tabla y vista del esquema público.
create function pruebas.visibles() returns table (relacion text, filas bigint) language plpgsql as $$
declare r record;
begin
  for r in select c.relname from pg_class c join pg_namespace s on s.oid = c.relnamespace
           where s.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'p') order by 1 loop
    begin
      relacion := r.relname;
      execute format('select count(*) from public.%I', r.relname) into filas;
      if filas > 0 then return next; end if;
    exception when insufficient_privilege then null;
    end;
  end loop;
end $$;
grant execute on all functions in schema pruebas to authenticated;

select pruebas.entrar('direccion');
select ok(
  (select count(*) from pruebas.visibles()) > 10,
  'la base tiene datos: dirección ve filas en muchas tablas'
);

select pruebas.entrar('cliente');
select is(
  (select string_agg(relacion || ':' || filas, ',' order by relacion) from pruebas.visibles()),
  'perfiles:1,roles:1,usuarios_portal:1',
  'el cliente solo ve su perfil, su rol y su liga a la cuenta; nada más en todo el esquema'
);
select is(
  (select count(*)::int from storage.objects), 0, 'no ve ningún archivo del almacén que no sea de sus facturas'
);
select is(
  (select count(*)::int from public.directorio_tecnicos()) + (select count(*)::int from public.directorio_comercial())
  + (select count(*)::int from public.umbrales_condicion_aceite()), 0,
  'las funciones internas de directorio y parámetros no le devuelven nada'
);
select is(public.mis_permisos(), '{}'::text[], 'y no tiene ningún permiso interno');

select * from finish();
rollback;
