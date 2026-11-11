-- Datos de desarrollo. `supabase db reset` aplica las migraciones y luego este archivo.
-- SOLO para la base local: nunca se aplica a mot-dev ni a producción.
-- Los catálogos y el caso Rassini se agregan en los pasos 4 a 6 de la Etapa 0.

-- Un usuario de prueba por rol: <rol>@mot.test, contraseña mot-local-1234
with nuevos (rol, nombre, puesto) as (
  values
    ('direccion', 'Diana Dirección', 'Directora General'),
    ('comercial', 'Carlos Comercial', 'Director Comercial'),
    ('tecnico', 'Tomás Técnico', 'Especialista de campo'),
    ('laboratorio', 'Laura Laboratorio', 'Responsable de laboratorio'),
    ('administracion', 'Adrián Administración', 'Administración'),
    ('cliente', 'Clara Cliente', 'Mantenimiento (Rassini)')
),
usuarios as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new
  )
  select
    '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    rol || '@mot.test', extensions.crypt('mot-local-1234', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(),
    '', '', '', ''
  from nuevos
  returning id, email
),
identidades as (
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  select gen_random_uuid(), id, id::text,
    jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
    'email', now(), now(), now()
  from usuarios
)
insert into public.perfiles (id, nombre, correo, puesto, rol_id)
select u.id, n.nombre, u.email, n.puesto, r.id
from usuarios u
join nuevos n on n.rol || '@mot.test' = u.email
join public.roles r on r.clave = n.rol;

-- Caso real de Rassini (DISENO §5, Etapa 0). Datos tomados del formato de
-- servicio del 2 nov 2026 (equipo 11B116) y del informe FOLAB-26-092 (11B113).
with cuenta as (
  insert into public.cuentas (nombre) values ('Rassini') returning id
),
planta as (
  insert into public.plantas (cuenta_id, nombre, calle, colonia, municipio, estado)
  select id, 'BYPASA', 'Oriente 6', 'Nuevo San Juan', 'San Juan del Río', 'Querétaro'
  from cuenta
  returning id, cuenta_id
),
-- Quien firmó de recibido el formato de servicio. Sin teléfono: no se lee con certeza.
contacto as (
  insert into public.contactos (cuenta_id, planta_id, nombre, area, puesto, recibe_informes)
  select cuenta_id, id, 'Jair Ocampo Franco', 'mantenimiento', 'Ing. de Mantenimiento', true
  from planta
)
insert into public.equipos_cliente (planta_id, identificador, alias, aplicacion, aceite_id, volumen_reservorio_l)
select planta.id, e.identificador, e.alias, e.aplicacion, aceite.id, e.volumen
from planta
cross join (select id from public.aceites where marca = 'Mobil' and nombre_comercial = 'DTE 25') aceite
cross join (values
  -- El informe de laboratorio no trae alias, aplicación ni capacidad del 11B113.
  ('11B113', null, null, null::numeric),
  ('11B116', 'REP4', 'Prensa vulcanizadora', 280)
) as e (identificador, alias, aplicacion, volumen);

-- Robox instalado en Rassini. El modelo no se lee bien en el formato en papel;
-- se captura cuando el área técnica comparta su inventario (P10).
insert into public.robox (numero_serie, version_programa, estado)
values ('545592', '6.5', 'en_cliente');

-- Ejemplo para probar el pipeline en local (inventado, no es una venta real).
with canal as (
  insert into public.canales_venta (nombre, notas)
  values ('Vendedor externo Querétaro', 'Ejemplo de canal de venta.')
  returning id
),
oportunidad as (
  insert into public.oportunidades
    (cuenta_id, planta_id, nombre, responsable_id, canal_venta_id, tipo, origen, etapa, volumen_estimado_l)
  select p.cuenta_id, p.id, 'Ampliación: segundo Robox en BYPASA', pf.id, canal.id,
         'ampliacion', 'cliente_anterior', 'visita', 560
  from public.plantas p
  cross join canal
  cross join (select id from public.perfiles where correo = 'comercial@mot.test') pf
  where p.nombre = 'BYPASA'
  returning id, responsable_id
)
insert into public.actividades_comerciales (oportunidad_id, tipo, fecha, responsable_id, notas)
select id, 'visita', current_date - 3, responsable_id, 'Recorrido por la planta con mantenimiento.'
from oportunidad;
