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
