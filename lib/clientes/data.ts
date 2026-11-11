import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Lecturas del expediente del cliente. RLS decide qué ve cada rol. */

export async function listarCuentas(busqueda: string) {
  const supabase = await createClient();
  let query = supabase
    .from("cuentas")
    .select(
      "id, nombre, tipo_industria, plantas (id, nombre, municipio, estado, deleted_at)",
    )
    .is("deleted_at", null)
    .order("nombre");
  // Se quitan los comodines para que la búsqueda sea texto literal.
  const texto = busqueda.replace(/[%_\\]/g, "").trim();
  if (texto) query = query.ilike("nombre", `%${texto}%`);

  const { data, error } = await query;
  if (error) throw new Error("No se pudieron cargar los clientes.");
  return data.map((c) => ({
    ...c,
    plantas: c.plantas.filter((p) => p.deleted_at === null),
  }));
}

export async function obtenerCuenta(id: string) {
  const supabase = await createClient();
  const [cuenta, plantas, razones, contactos] = await Promise.all([
    supabase
      .from("cuentas")
      .select("id, nombre, tipo_industria, notas")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("plantas")
      .select(
        "id, nombre, calle, numero_exterior, numero_interior, colonia, municipio, estado, codigo_postal, referencia, razon_social_id",
      )
      .eq("cuenta_id", id)
      .is("deleted_at", null)
      .order("nombre"),
    supabase
      .from("razones_sociales")
      .select(
        "id, razon_social, rfc, regimen_fiscal, codigo_postal_fiscal, uso_cfdi, usa_portal_proveedores, notas",
      )
      .eq("cuenta_id", id)
      .is("deleted_at", null)
      .order("razon_social"),
    supabase
      .from("contactos")
      .select(
        "id, nombre, area, puesto, planta_id, telefono_celular, telefono_oficina, correo, recibe_facturas, recibe_informes, notas",
      )
      .eq("cuenta_id", id)
      .is("deleted_at", null)
      .order("nombre"),
  ]);
  if (cuenta.error || plantas.error || razones.error || contactos.error) {
    throw new Error("No se pudo cargar el cliente.");
  }
  if (!cuenta.data) return null;

  return {
    ...cuenta.data,
    plantas: plantas.data,
    razonesSociales: razones.data,
    contactos: contactos.data,
  };
}

/** Una planta con sus equipos, requisitos y (si el rol puede) el costo de aceite de cada equipo. */
export async function obtenerPlanta(cuentaId: string, plantaId: string) {
  const supabase = await createClient();
  const [planta, equipos, requisitos] = await Promise.all([
    supabase
      .from("plantas")
      .select(
        "id, nombre, calle, numero_exterior, numero_interior, colonia, municipio, estado, codigo_postal, referencia, cuentas!inner (id, nombre, deleted_at), razones_sociales (razon_social)",
      )
      .eq("id", plantaId)
      .eq("cuenta_id", cuentaId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("equipos_cliente")
      .select(
        "id, identificador, alias, aplicacion, marca, aceite_id, volumen_reservorio_l, numero_contenedores, volumen_contenedor_l, tipo_conexion, altura, localizacion, temperatura_operacion_c, frecuencia_cambio_aceite, toma_muestras, notas, aceites (marca, nombre_comercial)",
      )
      .eq("planta_id", plantaId)
      .is("deleted_at", null)
      .order("identificador"),
    supabase
      .from("requisitos_planta")
      .select("id, categoria, nombre, detalle")
      .eq("planta_id", plantaId)
      .is("deleted_at", null)
      .order("categoria")
      .order("nombre"),
  ]);
  if (planta.error || equipos.error || requisitos.error) {
    throw new Error("No se pudo cargar la planta.");
  }
  if (!planta.data || planta.data.cuentas.deleted_at !== null) return null;

  // RLS devuelve los costos solo a quien puede ver precios; a los demás, nada.
  const ids = equipos.data.map((e) => e.id);
  const costos = ids.length
    ? await supabase
        .from("equipos_cliente_costos")
        .select("equipo_cliente_id, costo_aceite_virgen, moneda")
        .in("equipo_cliente_id", ids)
    : { data: [], error: null };
  if (costos.error) throw new Error("No se pudo cargar la planta.");
  const costoPorEquipo = new Map(
    costos.data.map((c) => [c.equipo_cliente_id, c]),
  );

  return {
    ...planta.data,
    cuenta: { id: planta.data.cuentas.id, nombre: planta.data.cuentas.nombre },
    equipos: equipos.data.map((e) => ({
      ...e,
      costo: costoPorEquipo.get(e.id) ?? null,
    })),
    requisitos: requisitos.data,
  };
}

export type PlantaCompleta = NonNullable<
  Awaited<ReturnType<typeof obtenerPlanta>>
>;

/** Cuántos equipos vigentes tiene cada planta de una cuenta. */
export async function contarEquiposPorPlanta(plantaIds: string[]) {
  const conteo = new Map<string, number>();
  if (plantaIds.length === 0) return conteo;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("equipos_cliente")
    .select("planta_id")
    .in("planta_id", plantaIds)
    .is("deleted_at", null);
  if (error) throw new Error("No se pudo cargar el cliente.");
  for (const e of data)
    conteo.set(e.planta_id, (conteo.get(e.planta_id) ?? 0) + 1);
  return conteo;
}

export async function listarAceitesActivos() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("aceites")
    .select("id, marca, nombre_comercial, grado_iso_vg")
    .eq("activo", true)
    .order("marca")
    .order("nombre_comercial");
  if (error) throw new Error("No se pudieron cargar los aceites.");
  return data.map((a) => ({
    value: a.id,
    label: `${a.marca} ${a.nombre_comercial}${a.grado_iso_vg ? ` (ISO VG ${a.grado_iso_vg})` : ""}`,
  }));
}

export type CuentaCompleta = NonNullable<
  Awaited<ReturnType<typeof obtenerCuenta>>
>;
