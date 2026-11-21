-- Cuentas bancarias de MOT y a cuál cayó cada pago.
begin;
select plan(9);

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
with c as (insert into public.cuentas (nombre) values ('ZZ Bancos') returning id)
insert into pruebas.d select 'cuenta', id from c;
with r as (insert into public.razones_sociales (cuenta_id, razon_social, rfc)
  values (pruebas.id('cuenta'), 'ZZ Bancos SA de CV', 'ZZB010101AAA') returning id)
insert into pruebas.d select 'razon', id from r;
grant select, insert on pruebas.d to authenticated;

select pruebas.entrar('administracion');
select lives_ok(
  $$with b as (insert into public.cuentas_bancarias (nombre, banco, terminacion, moneda)
      values ('ZZ Dólares', 'Banco de prueba', '4321', 'USD') returning id)
    insert into pruebas.d select 'banco', id from b$$,
  'administración da de alta una cuenta bancaria'
);
select throws_ok(
  $$insert into public.cuentas_bancarias (nombre, terminacion) values ('ZZ Mala', '012345678901234567')$$,
  '23514', null, 'solo se guardan los últimos 4 dígitos, nunca el número completo'
);
select lives_ok(
  $$insert into pruebas.d select 'pago', public.registrar_pago(pruebas.id('razon'),
      jsonb_build_object('fecha', '2037-03-01', 'monto', '100.00', 'moneda', 'USD', 'forma_pago', '03',
                         'cuenta_bancaria_id', pruebas.id('banco')), '[]'::jsonb)$$,
  'el pago se registra con la cuenta donde cayó'
);
select is((select cuenta_bancaria_id from public.pagos where id = pruebas.id('pago')), pruebas.id('banco'),
  'y la guarda');
select lives_ok(
  $$select public.registrar_pago(pruebas.id('razon'),
      jsonb_build_object('fecha', '2037-03-02', 'monto', '50.00', 'moneda', 'USD', 'forma_pago', '03'), '[]'::jsonb)$$,
  'la cuenta es opcional'
);

select pruebas.entrar('comercial');
select is((select count(*)::int from public.cuentas_bancarias where nombre = 'ZZ Dólares'), 1,
  'comercial consulta las cuentas');
select throws_ok(
  $$insert into public.cuentas_bancarias (nombre) values ('ZZ Otra')$$,
  '42501', null, 'pero no las da de alta'
);

select pruebas.entrar('tecnico');
select is((select count(*)::int from public.cuentas_bancarias), 0, 'el técnico no ve las cuentas bancarias');
select is((select count(*)::int from public.pagos), 0, 'ni los pagos');

select * from finish();
rollback;
