-- Catálogos base (DISENO §4.1, §4.4 y §4.5): aceites, partes, actividades,
-- fallas y parámetros de laboratorio. Los valores iniciales salen del formato
-- de servicio en papel y del informe FOLAB-26-092.
--
-- Los ven todos los roles internos. Se desactivan en lugar de borrarse.

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table public.aceites (
  id uuid primary key default gen_random_uuid(),
  marca text not null check (length(btrim(marca)) > 0),
  nombre_comercial text not null check (length(btrim(nombre_comercial)) > 0),
  grado_iso_vg integer check (grado_iso_vg > 0),
  viscosidad_nominal_40c numeric check (viscosidad_nominal_40c > 0),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  unique (marca, nombre_comercial)
);
comment on table public.aceites is
  'Catálogo de aceites. La viscosidad nominal es la base del límite de viscosidad en laboratorio.';
comment on column public.aceites.viscosidad_nominal_40c is 'Viscosidad nominal a 40 °C, en cSt.';

create table public.partes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique check (length(btrim(nombre)) > 0),
  tipo text not null check (tipo in ('parte', 'accesorio')),
  notas text,
  orden integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);
comment on table public.partes is
  'Partes que se cambian y accesorios que se instalan en una orden de servicio. Sin costos: llegan con el inventario (Etapa 3).';

create table public.actividades (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique check (length(btrim(nombre)) > 0),
  orden integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);
comment on table public.actividades is 'Actividades de una orden de servicio (del formato en papel).';

create table public.fallas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique check (length(btrim(nombre)) > 0),
  permite_cargo_cliente boolean not null default false,
  orden integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);
comment on table public.fallas is 'Fallas o problemas que se reportan en una orden de servicio.';
comment on column public.fallas.permite_cargo_cliente is
  'Verdadero si la falla permite generar un cargo al cliente (daño por mal uso). El resto es costo de MOT.';

create table public.parametros_laboratorio (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique check (clave ~ '^[a-z][a-z0-9_]*$'),
  nombre text not null check (length(btrim(nombre)) > 0),
  unidad text,
  grupo text not null
    check (grupo in ('fisicoquimico', 'desgaste', 'aditivos', 'contaminantes', 'cualitativo')),
  metodo text,
  tipo_regla text not null
    check (tipo_regla in (
      'maximo', 'minimo', 'codigo_iso', 'nominal_pct',
      'linea_base_abs', 'linea_base_pct', 'sin_limite'
    )),
  limite_valor numeric,
  limite_texto text,
  base_comparacion text
    check (base_comparacion in ('usado_vs_tratado', 'virgen_vs_tratado', 'valor_teorico')),
  orden integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  -- Cada tipo de regla lleva exactamente el dato que necesita.
  constraint parametros_laboratorio_limite_check check (
    case tipo_regla
      when 'sin_limite' then limite_valor is null and limite_texto is null
      when 'codigo_iso' then limite_valor is null and limite_texto ~ '^\d{1,2}/\d{1,2}/\d{1,2}$'
      else limite_valor is not null and limite_texto is null
    end
  )
);
comment on table public.parametros_laboratorio is
  'Parámetros que mide el laboratorio, con su regla de límite. DISENO §4.5 la llama "parametros"; se nombra así para no confundirla con parametros_negocio.';
comment on column public.parametros_laboratorio.tipo_regla is
  'maximo: valor < límite. minimo: valor > límite. codigo_iso: código ISO 4406 máximo (limite_texto). nominal_pct: nominal del aceite ± %. linea_base_abs / linea_base_pct: muestra virgen ± valor o ± %. sin_limite: solo se reporta.';
comment on column public.parametros_laboratorio.base_comparacion is
  'Contra qué se calcula el % de desviación del informe.';

-- ---------------------------------------------------------------------------
-- Triggers estándar; bitácora en lo que define límites de laboratorio
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['aceites', 'partes', 'actividades', 'fallas', 'parametros_laboratorio'] loop
    execute format(
      'create trigger %1$s_set_updated_at before update on public.%1$I
         for each row execute function public.set_updated_at()', t);
    execute format(
      'create trigger %1$s_set_created_by before insert on public.%1$I
         for each row execute function public.set_created_by()', t);
  end loop;
end $$;

create trigger aceites_bitacora after insert or update or delete on public.aceites
  for each row execute function public.registrar_bitacora();
create trigger parametros_laboratorio_bitacora after insert or update or delete on public.parametros_laboratorio
  for each row execute function public.registrar_bitacora();

-- ---------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------

insert into public.permisos (clave, descripcion) values
  ('catalogos.ver', 'Consultar los catálogos base.'),
  ('catalogos_laboratorio.editar', 'Editar aceites y parámetros de laboratorio.'),
  ('catalogos_partes.editar', 'Editar el catálogo de partes y accesorios.'),
  ('catalogos_operacion.editar', 'Editar los catálogos de actividades y fallas.');

insert into public.rol_permisos (rol_id, permiso_id)
select r.id, p.id
from (values
  ('direccion', 'catalogos.ver'),
  ('comercial', 'catalogos.ver'),
  ('tecnico', 'catalogos.ver'),
  ('laboratorio', 'catalogos.ver'),
  ('administracion', 'catalogos.ver'),
  ('direccion', 'catalogos_laboratorio.editar'),
  ('laboratorio', 'catalogos_laboratorio.editar'),
  ('direccion', 'catalogos_partes.editar'),
  ('administracion', 'catalogos_partes.editar'),
  ('direccion', 'catalogos_operacion.editar')
) as m (rol, permiso)
join public.roles r on r.clave = m.rol
join public.permisos p on p.clave = m.permiso;

-- ---------------------------------------------------------------------------
-- RLS: todos los internos ven; cada catálogo lo edita quien tiene su permiso.
-- No hay borrado: se desactiva.
-- ---------------------------------------------------------------------------

do $$
declare
  c record;
begin
  for c in
    select * from (values
      ('aceites', 'catalogos_laboratorio.editar'),
      ('parametros_laboratorio', 'catalogos_laboratorio.editar'),
      ('partes', 'catalogos_partes.editar'),
      ('actividades', 'catalogos_operacion.editar'),
      ('fallas', 'catalogos_operacion.editar')
    ) as v (tabla, permiso)
  loop
    execute format('alter table public.%I enable row level security', c.tabla);
    execute format('revoke all on public.%I from anon, authenticated', c.tabla);
    execute format('grant select, insert, update on public.%I to authenticated', c.tabla);
    execute format(
      'create policy %1$s_select on public.%1$I for select to authenticated
         using ((select public.tiene_permiso(''catalogos.ver'')))', c.tabla);
    execute format(
      'create policy %1$s_insert on public.%1$I for insert to authenticated
         with check ((select public.tiene_permiso(%2$L)))', c.tabla, c.permiso);
    execute format(
      'create policy %1$s_update on public.%1$I for update to authenticated
         using ((select public.tiene_permiso(%2$L)))
         with check ((select public.tiene_permiso(%2$L)))', c.tabla, c.permiso);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Datos iniciales
-- ---------------------------------------------------------------------------

-- El único aceite que aparece en los documentos de Rassini (equipos 11B113 y 11B116).
insert into public.aceites (marca, nombre_comercial, grado_iso_vg, viscosidad_nominal_40c) values
  ('Mobil', 'DTE 25', 46, 46);

insert into public.actividades (nombre, orden) values
  ('Presentación', 10), ('Levantamiento', 20), ('Entrega', 30), ('Instalación', 40),
  ('Puesta en marcha', 50), ('Capacitación', 60), ('Toma de muestras', 70),
  ('Cambio de filtros', 80), ('Rotación o movilización', 90), ('Limpieza', 100),
  ('Mantenimiento', 110), ('Adecuación', 120), ('Reemplazo', 130), ('Retiro', 140);

insert into public.fallas (nombre, orden, permite_cargo_cliente) values
  ('Robox no enciende', 10, false),
  ('Loop de arranque', 20, false),
  ('Pantalla no responde', 30, false),
  ('Alarma activa', 40, false),
  ('Falla de bomba', 50, false),
  ('Medidor de flujo no gira', 60, false),
  ('Fuga de aceite', 70, false),
  ('Presión alta o flujo bajo', 80, false),
  ('Presión baja o flujo alto', 90, false),
  ('Presión o flujo irregular', 100, false),
  ('Obstrucción', 110, false),
  ('Desempeño', 120, false),
  ('Componente descompuesto', 130, false),
  ('Componente dañado por el cliente', 140, true);

-- PENDIENTE(P7, P10): el formato en papel marca variantes con letras
-- (O-rings C/F/B, válvula C/G, manómetro A/D, cable A/P/S, kits H/M) cuyo
-- significado falta confirmar con el área técnica. Por ahora van como una sola
-- parte; solo la bomba se separa en S, M y L, que sí está en DISENO §4.4.
insert into public.partes (nombre, tipo, orden) values
  ('Filtro SKF500/HY (Core)', 'parte', 10),
  ('Filtro SKF500/DST', 'parte', 20),
  ('Filtro sinterizado', 'parte', 30),
  ('Imán de neodimio', 'parte', 40),
  ('Post-filtro', 'parte', 50),
  ('O-rings', 'parte', 60),
  ('Válvula de alivio', 'parte', 70),
  ('Medidor de flujo', 'parte', 80),
  ('Bomba S', 'parte', 90),
  ('Bomba M', 'parte', 100),
  ('Bomba L', 'parte', 110),
  ('Motor', 'parte', 120),
  ('Manómetro', 'parte', 130),
  ('HMI (pantalla touch)', 'parte', 140),
  ('Cable', 'parte', 150),
  ('Fuente de poder', 'parte', 160),
  ('Robox completo', 'parte', 170),
  ('Kit de conexión rápida H', 'accesorio', 210),
  ('Kit de conexión rápida M', 'accesorio', 220),
  ('Kit de conexión rápida M extra', 'accesorio', 230),
  ('Kit pre-filtro', 'accesorio', 240),
  ('Kit Safe Filter externo', 'accesorio', 250),
  ('Manómetro diferencial', 'accesorio', 260),
  ('Sensor de temperatura', 'accesorio', 270),
  ('Sensor de humedad', 'accesorio', 280),
  ('Contador de partículas', 'accesorio', 290),
  ('Regulador eléctrico', 'accesorio', 300),
  ('Enfriador de aceite', 'accesorio', 310),
  ('Anclaje de elevación', 'accesorio', 320);

-- Límites tomados de la columna LMP del informe FOLAB-26-092.
-- PENDIENTE(P5): falta qué nivel de análisis incluye cada parámetro.
-- PENDIENTE(P6): el pH usa > 5.5 (informe); la guía dice > 5.0.
-- Donde DISENO §4.5 y el informe difieren (agua libre; Mg, Ba y Mo) se sigue
-- el informe, que no les pone límite.
insert into public.parametros_laboratorio
  (clave, nombre, unidad, grupo, metodo, tipo_regla, limite_valor, limite_texto, base_comparacion, orden)
values
  ('codigo_iso', 'Código de limpieza (4/6/14 µm)', null, 'fisicoquimico', 'ISO 4406:99', 'codigo_iso', null, '18/16/13', 'usado_vs_tratado', 10),
  ('particulas_4um', 'Partículas 4 µm', 'part/100 mL', 'fisicoquimico', 'ISO 4406:99', 'sin_limite', null, null, 'usado_vs_tratado', 20),
  ('particulas_6um', 'Partículas 6 µm', 'part/100 mL', 'fisicoquimico', 'ISO 4406:99', 'sin_limite', null, null, 'usado_vs_tratado', 30),
  ('particulas_14um', 'Partículas 14 µm', 'part/100 mL', 'fisicoquimico', 'ISO 4406:99', 'sin_limite', null, null, 'usado_vs_tratado', 40),
  ('solidos_suspendidos', 'Sólidos suspendidos', 'ppm', 'fisicoquimico', null, 'maximo', 0.5, null, 'usado_vs_tratado', 50),
  ('mpc', 'MPC (> 0.45 µm)', 'ΔE', 'fisicoquimico', 'ASTM D7843', 'maximo', 15, null, 'usado_vs_tratado', 60),
  ('solidos_sedimentables', 'Sólidos sedimentables', '% m/v', 'fisicoquimico', null, 'sin_limite', null, null, null, 70),
  ('viscosidad_40c', 'Viscosidad a 40 °C', 'cSt', 'fisicoquimico', 'ASTM D445', 'nominal_pct', 10, null, 'usado_vs_tratado', 80),
  ('agua_disuelta', 'Agua disuelta', 'ppm', 'fisicoquimico', 'ASTM D6304 / E2412', 'maximo', 500, null, 'valor_teorico', 90),
  ('agua_libre', 'Agua libre', 'ppm', 'fisicoquimico', 'ASTM D6304 / E2412', 'sin_limite', null, null, null, 100),
  ('tan', 'TAN (número ácido)', 'mg KOH/g', 'fisicoquimico', 'ASTM D664', 'linea_base_abs', 0.20, null, 'virgen_vs_tratado', 110),
  ('ph', 'pH', null, 'fisicoquimico', 'ASTM D664', 'minimo', 5.5, null, 'virgen_vs_tratado', 120),
  ('oxidacion', 'Oxidación', 'Abs/cm', 'fisicoquimico', 'FTIR ASTM E2412', 'linea_base_abs', 0.20, null, 'virgen_vs_tratado', 130),

  ('ag', 'Plata (Ag)', 'ppm', 'desgaste', 'XRF / ASTM D6481', 'sin_limite', null, null, 'usado_vs_tratado', 210),
  ('al', 'Aluminio (Al)', 'ppm', 'desgaste', 'XRF / ASTM D6481', 'maximo', 15, null, 'usado_vs_tratado', 220),
  ('cu', 'Cobre (Cu)', 'ppm', 'desgaste', 'XRF / ASTM D6481', 'maximo', 50, null, 'usado_vs_tratado', 230),
  ('fe', 'Hierro (Fe)', 'ppm', 'desgaste', 'XRF / ASTM D6481', 'maximo', 50, null, 'usado_vs_tratado', 240),
  ('ti', 'Titanio (Ti)', 'ppm', 'desgaste', 'XRF / ASTM D6481', 'sin_limite', null, null, 'usado_vs_tratado', 250),
  ('cr', 'Cromo (Cr)', 'ppm', 'desgaste', 'XRF / ASTM D6481', 'sin_limite', null, null, 'usado_vs_tratado', 260),
  ('pb', 'Plomo (Pb)', 'ppm', 'desgaste', 'XRF / ASTM D6481', 'maximo', 15, null, 'usado_vs_tratado', 270),
  ('sn', 'Estaño (Sn)', 'ppm', 'desgaste', 'XRF / ASTM D6481', 'maximo', 50, null, 'usado_vs_tratado', 280),
  ('v', 'Vanadio (V)', 'ppm', 'desgaste', 'XRF / ASTM D6481', 'sin_limite', null, null, 'usado_vs_tratado', 290),

  ('zn', 'Zinc (Zn)', 'ppm', 'aditivos', 'XRF', 'linea_base_pct', 15, null, 'virgen_vs_tratado', 310),
  ('s', 'Azufre (S)', 'ppm', 'aditivos', 'XRF', 'linea_base_pct', 15, null, 'virgen_vs_tratado', 320),
  ('ca', 'Calcio (Ca)', 'ppm', 'aditivos', 'XRF', 'linea_base_pct', 15, null, 'virgen_vs_tratado', 330),
  ('p', 'Fósforo (P)', 'ppm', 'aditivos', 'XRF', 'linea_base_pct', 15, null, 'virgen_vs_tratado', 340),
  ('mg', 'Magnesio (Mg)', 'ppm', 'aditivos', 'XRF', 'sin_limite', null, null, 'virgen_vs_tratado', 350),
  ('ba', 'Bario (Ba)', 'ppm', 'aditivos', 'XRF', 'sin_limite', null, null, 'virgen_vs_tratado', 360),
  ('mo', 'Molibdeno (Mo)', 'ppm', 'aditivos', 'XRF', 'sin_limite', null, null, 'virgen_vs_tratado', 370),

  ('si', 'Silicio (Si)', 'ppm', 'contaminantes', 'XRF', 'sin_limite', null, null, 'usado_vs_tratado', 410),
  ('na', 'Sodio (Na)', 'ppm', 'contaminantes', 'XRF', 'sin_limite', null, null, 'usado_vs_tratado', 420),
  ('k', 'Potasio (K)', 'ppm', 'contaminantes', 'XRF', 'sin_limite', null, null, 'usado_vs_tratado', 430),

  ('ftir', 'FTIR (composición química)', null, 'cualitativo', 'FTIR ASTM E2412', 'sin_limite', null, null, null, 510),
  ('colorimetria', 'Colorimetría', null, 'cualitativo', null, 'sin_limite', null, null, null, 520),
  ('escala_barnices', 'Escala de barnices MPC', null, 'cualitativo', 'ASTM D7843', 'sin_limite', null, null, null, 530);
