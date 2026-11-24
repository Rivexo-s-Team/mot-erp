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
    ('coordinacion', 'Carla Coordinación', 'Coordinación de servicio'),
    ('administracion_coordinacion', 'Ana Administración y Coordinación', 'Administración y coordinación'),
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

-- Ejemplo para probar los contratos en local (inventado: Rassini no aparece en
-- la lista de rentas del director comercial).
with contrato as (
  insert into public.contratos
    (cuenta_id, planta_id, tipo, estado, fecha_inicio, fecha_termino, incluye_laboratorio, notas)
  select p.cuenta_id, p.id, 'renta', 'vigente', date '2025-06-01', date '2028-05-31', true,
         'Contrato de ejemplo.'
  from public.plantas p where p.nombre = 'BYPASA'
  returning id, planta_id
)
insert into public.contrato_tarifas (contrato_id, planta_id, orden, concepto, unidad, precio, equipo_cliente_id)
select c.id, c.planta_id, 1, 'Renta mensual de Robox', 'mes', 300, e.id
from contrato c
join public.equipos_cliente e on e.planta_id = c.planta_id and e.identificador = '11B116';

-- Orden de compra de ejemplo para el contrato anterior (inventada).
with oc as (
  insert into public.ordenes_compra (contrato_id, numero, monto, fecha_inicio, fecha_termino)
  select id, 'OC-EJEMPLO-001', 10800, date '2025-06-01', date '2028-05-31'
  from public.contratos where notas = 'Contrato de ejemplo.'
  returning id, contrato_id
)
update public.contrato_tarifas t set orden_compra_id = oc.id
from oc where t.contrato_id = oc.contrato_id;

-- El Robox 545592 trabaja en Rassini BYPASA, en rotación entre los dos equipos.
-- El ID de caso RAS1-08 viene del formato de servicio en papel (DISENO §4.3).
with asignacion as (
  insert into public.asignaciones_robox (robox_id, contrato_id, planta_id, fecha_inicio)
  select r.id, c.id, c.planta_id, date '2025-06-01'
  from public.robox r, public.contratos c
  where r.numero_serie = '545592' and c.notas = 'Contrato de ejemplo.'
  returning id, planta_id
),
carrusel as (
  insert into public.carrusel_equipos (asignacion_id, planta_id, equipo_cliente_id, orden, id_caso)
  select a.id, a.planta_id, e.id,
         case e.identificador when '11B116' then 1 else 2 end,
         case e.identificador when '11B116' then 'RAS1-08' end
  from asignacion a
  join public.equipos_cliente e on e.planta_id = a.planta_id and e.identificador in ('11B116', '11B113')
  returning asignacion_id
)
insert into public.movimientos_robox (asignacion_id, planta_id, fecha, equipo_destino_id, movido_por, notas)
select a.id, a.planta_id, date '2025-06-01', e.id, 'mot', 'Instalación.'
from asignacion a
join public.equipos_cliente e on e.planta_id = a.planta_id and e.identificador = '11B116'
where exists (select 1 from carrusel);

-- Orden de servicio de ejemplo, como la del formato en papel del 2 nov 2026
-- (allá el folio es "261102 DV"; aquí toma las iniciales del técnico de prueba).
insert into public.ordenes_servicio
  (tipo, cuenta_id, planta_id, contrato_id, equipo_cliente_id, robox_id, tecnico_id, fecha_programada, notas)
select 'visita', p.cuenta_id, p.id, c.id, e.id, r.id, pf.id, date '2026-11-02',
       'Toma de muestra y rotación del Robox.'
from public.plantas p
join public.contratos c on c.planta_id = p.id and c.notas = 'Contrato de ejemplo.'
join public.equipos_cliente e on e.planta_id = p.id and e.identificador = '11B116'
cross join (select id from public.robox where numero_serie = '545592') r
cross join (select id from public.perfiles where correo = 'tecnico@mot.test') pf
where p.nombre = 'BYPASA';

-- Filtro del Robox 545592: el formato del 2 nov 2026 marca "Filter used 74 días",
-- así que se instaló 74 días antes.
insert into public.filtros_instalados (robox_id, parte_id, fecha_instalacion, notas)
select r.id, p.id, date '2026-11-02' - 74, 'Fecha calculada con la lectura "Filter used" del 02/11/2026.'
from public.robox r, public.partes p
where r.numero_serie = '545592' and p.nombre = 'Filtro SKF500/HY (Core)';

-- Visita recurrente de ejemplo: cada mes a Rassini BYPASA.
insert into public.visitas_programadas
  (contrato_id, planta_id, equipo_cliente_id, robox_id, tecnico_id, cada_cantidad, cada_unidad, proxima_fecha, notas)
select c.id, c.planta_id, e.id, r.id, pf.id, 1, 'meses', date '2026-12-02', 'Toma de muestra y rotación del Robox.'
from public.contratos c
join public.equipos_cliente e on e.planta_id = c.planta_id and e.identificador = '11B116'
cross join (select id from public.robox where numero_serie = '545592') r
cross join (select id from public.perfiles where correo = 'tecnico@mot.test') pf
where c.notas = 'Contrato de ejemplo.';

-- Documentos de acceso de ejemplo (fechas inventadas).
insert into public.documentos_acceso (tipo_id, perfil_id, fecha_vencimiento, notas)
select t.id, null, date '2027-06-30', 'Registro REPSE de ejemplo.'
from public.tipos_documento_acceso t where t.nombre = 'REPSE';
insert into public.documentos_acceso (tipo_id, perfil_id, fecha_vencimiento)
select t.id, pf.id, null
from public.tipos_documento_acceso t, public.perfiles pf
where t.nombre like 'Equipo de protección%' and pf.correo = 'tecnico@mot.test';

-- Requisito de acceso de la planta de ejemplo.
insert into public.requisitos_planta (planta_id, categoria, nombre, detalle)
select id, 'acceso_planta', 'Registro en caseta con identificación oficial', 'Llegar 15 minutos antes.'
from public.plantas where nombre = 'BYPASA';

-- Muestras del equipo 11B113 de Rassini, tal como aparecen en el informe
-- FOLAB-26-092 (IDs, tipos, fechas de muestreo y niveles reales). La fecha de
-- recepción no viene en el informe: se usa la de muestreo.
insert into public.muestras
  (id_muestra, cuenta_id, planta_id, equipo_cliente_id, id_caso, tipo, tomada_por,
   fecha_muestreo, fecha_recepcion, nivel_analisis, estado, notas)
select m.id_muestra, p.cuenta_id, p.id, e.id, 'RAS1-01', m.tipo, m.tomada_por,
       m.fecha, m.fecha, m.nivel, 'concluida', m.notas
from public.plantas p
join public.equipos_cliente e on e.planta_id = p.id and e.identificador = '11B113'
cross join (values
  ('251106-329', 'virgen', 'mot', date '2025-11-06', 'premium', 'Aceite nuevo'),
  ('251209-380', 'usado', 'mot', date '2025-12-16', 'premium', null),
  ('260216-044', 'filtrado', 'mot', date '2026-02-16', 'basico_mpc', null),
  ('260430-078', 'filtrado', 'mot', date '2026-04-30', 'basico_mpc', null),
  ('260522-093', 'filtrado', 'mot', date '2026-05-22', 'basico_mpc', null),
  ('260617-092', 'filtrado', 'cliente', date '2026-06-17', 'basico_mpc', 'Tomada por cliente')
) as m (id_muestra, tipo, tomada_por, fecha, nivel, notas)
where p.nombre = 'BYPASA';

-- Resultados de esas muestras, copiados del informe FOLAB-26-092 (los "-" del
-- informe no se capturan). El MPC de la muestra 251209-380 viene calculado en
-- el Excel; se redondea a 3 decimales.
insert into public.muestra_resultados (muestra_id, parametro_id, valor_texto)
select m.id, p.id, btrim(v.valor)
from (values
  ('codigo_iso',            '21/19/14', '21/20/17', '19/17/14', '19/17/13', '18/17/13', '18/16/13'),
  ('particulas_4um',        '1335937', '1831620', '310493', '391613', '217547', '132090'),
  ('particulas_6um',        '276930', '730540', '127187', '114973', '69317', '46600'),
  ('particulas_14um',       '13160', '72150', '11770', '7967', '5867', '4330'),
  ('solidos_suspendidos',   '2.158', '8.011', '1.28', '1.052', '0.794', '0.583'),
  ('mpc',                   '1.8', '3.199', '1.8', '1.8', '1.8', '4.3'),
  ('solidos_sedimentables', 'No detectado', 'No detectado', 'No detectado', 'No detectado', 'No detectado', 'No detectado'),
  ('viscosidad_40c',        '100.795', '46.435', '46.203', '47.375', '46.382', '46.763'),
  ('agua_disuelta',         '<300', '316.6', '159.59', '369', null, null),
  ('agua_libre',            'No detectado', 'No detectado', 'No detectado', 'No detectado', 'No detectado', 'No detectado'),
  ('tan',                   'No detectado', '0.79709', '0.72774', null, null, null),
  ('ph',                    'No detectado', '7', '6.8', null, null, null),
  ('oxidacion',             '1.372', '1.239', '1.237', '1.268', '1.238', '1.268'),
  ('ag', '0', '7.92', null, '7.28', '8.81', '7.04'),
  ('al', '0', '0', null, '80.6', '184', '169'),
  ('cu', '26.7', '27.6', null, '27.1', '28.2', '27.5'),
  ('fe', '13.7', '13.6', null, '14.1', '13.6', '14.9'),
  ('ti', '0', '0', null, '0', '0', '0'),
  ('cr', '0', '0', null, '7.96', '0', '7.1'),
  ('pb', '0', '0', null, '0', '0', '0'),
  ('sn', '26.2', '23.4', null, '20.9', '36.2', '17.9'),
  ('v',  '0', '0', null, '0', '0', '0'),
  ('zn', '19.9', '501', null, '500', '487', '489'),
  ('s',  '6943', '684', null, '679', '659', '664'),
  ('ca', '0', '0', null, '0', '0', '0'),
  ('p',  '82.8', '193', null, '170', '168', '168'),
  ('mg', '0', '0', null, '0', '0', '0'),
  ('ba', '0', '0', null, '0', '0', '0'),
  ('mo', '0', '0', null, '0', '0', '0'),
  ('si', '0', '0', null, '0', '0', '0'),
  ('na', '0', '0', null, '0', '0', '0'),
  ('k',  '0', '0', null, '0', '0', '0')
) as f (clave, m1, m2, m3, m4, m5, m6)
join public.parametros_laboratorio p on p.clave = f.clave
cross join lateral (values
  ('251106-329', f.m1), ('251209-380', f.m2), ('260216-044', f.m3),
  ('260430-078', f.m4), ('260522-093', f.m5), ('260617-092', f.m6)
) as v (id_muestra, valor)
join public.muestras m on m.id_muestra = v.id_muestra
where v.valor is not null;

-- Informe en borrador del equipo 11B113 con sus seis muestras, para compararlo
-- contra el FOLAB-26-092 real. Las observaciones son de ejemplo.
with informe as (
  insert into public.informes (folio, cuenta_id, planta_id, equipo_cliente_id, fecha_emision, observaciones, elaboro_id)
  select 'FOLAB-26-092', p.cuenta_id, p.id, e.id, date '2026-07-15',
         'Observaciones de ejemplo: el código de limpieza ya está dentro del límite.',
         (select id from public.perfiles where correo = 'laboratorio@mot.test')
  from public.plantas p
  join public.equipos_cliente e on e.planta_id = p.id and e.identificador = '11B113'
  where p.nombre = 'BYPASA'
  returning id, equipo_cliente_id
)
insert into public.informe_muestras (informe_id, muestra_id, equipo_cliente_id)
select i.id, m.id, i.equipo_cliente_id
from informe i
join public.muestras m on m.equipo_cliente_id = i.equipo_cliente_id;

-- Razón social y condiciones de crédito de ejemplo para probar la facturación
-- en local (inventadas: el RFC es el genérico del SAT).
with razon as (
  insert into public.razones_sociales (cuenta_id, razon_social, rfc, regimen_fiscal, codigo_postal_fiscal, uso_cfdi, usa_portal_proveedores)
  select id, 'Rassini Ejemplo SA de CV', 'XAXX010101000', '601', '76800', 'G03', true
  from public.cuentas where nombre = 'Rassini'
  returning id, cuenta_id
)
insert into public.condiciones_credito
  (razon_social_id, cuenta_id, dias_credito, requiere_orden_compra, metodo_pago, forma_pago, portal)
select id, cuenta_id, 30, true, 'PPD', '99', 'Portal de proveedores de ejemplo' from razon;

-- Pagos únicos del contrato de ejemplo (D15: dos meses de anticipo más la
-- instalación). Los importes son de ejemplo.
insert into public.contrato_tarifas (contrato_id, planta_id, concepto, unidad, precio, es_anticipo, orden)
select c.id, c.planta_id, v.concepto, 'unico', v.precio, v.es_anticipo, v.orden
from public.contratos c
cross join (values
  ('Anticipo de 2 meses de renta', 600, true, 10),
  ('Instalación del Robox', 1000, false, 20)
) as v (concepto, precio, es_anticipo, orden)
where c.notas = 'Contrato de ejemplo.';

-- Portal de clientes: Clara Cliente pertenece a Rassini.
insert into public.usuarios_portal (perfil_id, cuenta_id)
select pf.id, c.id
from public.perfiles pf, public.cuentas c
where pf.correo = 'cliente@mot.test' and c.nombre = 'Rassini';
