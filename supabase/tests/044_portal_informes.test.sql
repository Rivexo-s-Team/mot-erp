-- Portal de clientes: el cliente ve solo los informes publicados de su cuenta.
begin;
select plan(17);

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

-- Dos cuentas, cada una con planta, equipo, muestra, usuario del portal e informe.
create function pruebas.armar(p text) returns void language plpgsql as $$
begin
  with c as (insert into public.cuentas (nombre) values ('ZZ Portal ' || p) returning id)
  insert into pruebas.d select 'cuenta_' || p, id from c;
  with x as (insert into public.plantas (cuenta_id, nombre, municipio) values (pruebas.id('cuenta_' || p), 'Planta ' || p, 'Celaya') returning id)
  insert into pruebas.d select 'planta_' || p, id from x;
  with x as (insert into public.equipos_cliente (planta_id, identificador) values (pruebas.id('planta_' || p), 'EQ-' || p) returning id)
  insert into pruebas.d select 'equipo_' || p, id from x;
  with x as (insert into public.muestras (cuenta_id, planta_id, equipo_cliente_id, tipo, fecha_muestreo, id_caso)
    values (pruebas.id('cuenta_' || p), pruebas.id('planta_' || p), pruebas.id('equipo_' || p), 'filtrado', '2037-06-17', 'CASO-' || p) returning id)
  insert into pruebas.d select 'muestra_' || p, id from x;
end $$;
select pruebas.armar('a');
select pruebas.armar('b');
insert into public.usuarios_portal (perfil_id, cuenta_id) values
  (pruebas.uid('cliente'), pruebas.id('cuenta_a')), (pruebas.uid('cliente_b'), pruebas.id('cuenta_b'));

create function pruebas.informe(p text, p_folio text) returns void language plpgsql as $$
declare v uuid;
begin
  insert into public.informes (folio, cuenta_id, planta_id, equipo_cliente_id, observaciones)
  values (p_folio, pruebas.id('cuenta_' || p), pruebas.id('planta_' || p), pruebas.id('equipo_' || p), 'Aceite en buen estado')
  returning id into v;
  insert into public.informe_muestras (informe_id, muestra_id, equipo_cliente_id)
  values (v, pruebas.id('muestra_' || p), pruebas.id('equipo_' || p));
  insert into pruebas.d values ('inf_' || p_folio, v);
end $$;
create function pruebas.contenido(p text) returns jsonb language sql stable as $$
  select jsonb_build_object('version', 1, 'condicionGeneral', 'normal', 'grupos', '[]'::jsonb,
    'muestras', jsonb_build_array(jsonb_build_object('id', pruebas.id('muestra_' || p))))
$$;
grant execute on all functions in schema pruebas to authenticated;

select pruebas.entrar('laboratorio');
select pruebas.informe('a', 'ZZ-A1');
select pruebas.informe('a', 'ZZ-A2');
select pruebas.informe('b', 'ZZ-B1');

update public.informes set publicado_at = now() where id = pruebas.id('inf_ZZ-A1');
select is(
  (select publicado_at from public.informes where id = pruebas.id('inf_ZZ-A1')), null,
  'un borrador no se publica'
);
update public.informes set estado = 'validado', contenido = pruebas.contenido('a') where id in (pruebas.id('inf_ZZ-A1'), pruebas.id('inf_ZZ-A2'));
update public.informes set estado = 'validado', contenido = pruebas.contenido('b') where id = pruebas.id('inf_ZZ-B1');
select is(
  (select count(*)::int from public.informes where folio like 'ZZ-%' and publicado_at is not null), 0,
  'validar no publica'
);

select pruebas.entrar('cliente');
select is((select count(*)::int from public.portal_informes()), 0, 'el cliente no ve informes sin publicar');
select is(public.portal_informe(pruebas.id('inf_ZZ-A1')), null, 'ni abriéndolos por su id');

select pruebas.entrar('tecnico');
select lives_ok(
  $$update public.informes set publicado_at = now() where id = pruebas.id('inf_ZZ-A1')$$,
  'quien no elabora informes no cambia nada al intentar publicar'
);
select pruebas.entrar('laboratorio');
select is(
  (select publicado_at from public.informes where id = pruebas.id('inf_ZZ-A1')), null,
  'y el informe sigue sin publicar'
);
select lives_ok(
  $$update public.informes set publicado_at = now()
    where id in (pruebas.id('inf_ZZ-A1'), pruebas.id('inf_ZZ-B1'))$$,
  'el laboratorio publica informes validados'
);
select is(
  (select publicado_por from public.informes where id = pruebas.id('inf_ZZ-A1')), pruebas.uid('laboratorio'),
  'queda quién lo publicó'
);
select throws_ok(
  $$update public.informes set observaciones = 'otra', publicado_at = null where id = pruebas.id('inf_ZZ-A1')$$,
  'P0001', null, 'publicar o retirar no sirve para cambiar un informe validado'
);

select pruebas.entrar('cliente');
select is(
  (select string_agg(folio, ',') from public.portal_informes()), 'ZZ-A1',
  'el cliente ve solo el informe publicado de su cuenta'
);
select is(
  (select row(planta, equipo, condicion_general, muestras)::text from public.portal_informes()),
  '("Planta a",EQ-a,normal,1)', 'con su planta, equipo, condición y número de muestras'
);
select is(
  (select row(j ->> 'folio', j ->> 'cliente', j ->> 'id_caso', j ->> 'elaboro', j -> 'direccion' ->> 'municipio')::text
   from public.portal_informe(pruebas.id('inf_ZZ-A1')) j),
  '(ZZ-A1,"ZZ Portal a",CASO-a,"Prueba laboratorio",Celaya)', 'y lo abre con lo que imprime su PDF'
);
select is(public.portal_informe(pruebas.id('inf_ZZ-B1')), null, 'no abre el informe publicado de otra cuenta');
select is((select count(*)::int from public.informes), 0, 'no lee la tabla de informes');

select pruebas.entrar('cliente_b');
select is(
  (select string_agg(folio, ',') from public.portal_informes()), 'ZZ-B1', 'la otra cuenta ve solo el suyo'
);

-- Retirar y reabrir.
select pruebas.entrar('laboratorio');
update public.informes set publicado_at = null where id = pruebas.id('inf_ZZ-B1');
update public.informes set estado = 'borrador' where id = pruebas.id('inf_ZZ-A1');
select is(
  (select row(publicado_at, publicado_por)::text from public.informes where id = pruebas.id('inf_ZZ-A1')),
  '(,)', 'reabrir un informe lo retira del portal'
);
select pruebas.entrar('cliente_b');
select is((select count(*)::int from public.portal_informes()), 0, 'retirado, el cliente deja de verlo');

select * from finish();
rollback;
