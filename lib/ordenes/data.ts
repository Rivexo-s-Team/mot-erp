import "server-only";
import { listarContratos, nombreContrato } from "@/lib/contratos/data";
import { ubicaciones } from "@/lib/flota/data";
import { createClient } from "@/lib/supabase/server";
import { ESTADOS_ABIERTOS, type OpcionesOrden } from "./campos";

/** Lecturas de órdenes de servicio. RLS decide qué ve cada rol. */

/** Usuarios internos: nombre para mostrar y quiénes pueden llevar una orden. */
export async function directorioTecnicos() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("directorio_tecnicos");
  if (error) throw new Error("No se pudo cargar el directorio.");
  const nombres = new Map(data.map((d) => [d.id, d.nombre]));
  const asignables = data
    .filter((d) => d.asignable)
    .map((d) => ({ value: d.id, label: d.nombre }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
  return { nombres, asignables };
}

const COLUMNAS =
  "id, folio, tipo, estado, cuenta_id, planta_id, contrato_id, equipo_cliente_id, robox_id, tecnico_id, acompanante_id, fecha_programada, fecha_real, notas, updated_at, cuentas (nombre), plantas (nombre), equipos_cliente (identificador, alias), robox (numero_serie)";

export async function listarOrdenes(filtro: {
  estado?: string;
  /** Solo las órdenes donde esta persona va como responsable o acompañante. */
  personaId?: string;
  /** Solo programadas y en curso. */
  abiertas?: boolean;
}) {
  const supabase = await createClient();
  let query = supabase
    .from("ordenes_servicio")
    .select(COLUMNAS)
    .is("deleted_at", null)
    .order("fecha_programada", { ascending: !!filtro.abiertas })
    .order("folio");
  if (filtro.estado) query = query.eq("estado", filtro.estado);
  if (filtro.abiertas) query = query.in("estado", ESTADOS_ABIERTOS);
  if (filtro.personaId)
    query = query.or(
      `tecnico_id.eq.${filtro.personaId},acompanante_id.eq.${filtro.personaId}`,
    );
  const { data, error } = await query;
  if (error) throw new Error("No se pudieron cargar las órdenes de servicio.");
  return data;
}

export type Orden = Awaited<ReturnType<typeof listarOrdenes>>[number];

export async function contarOrdenesPorEstado() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ordenes_servicio")
    .select("estado")
    .is("deleted_at", null);
  if (error) throw new Error("No se pudieron cargar las órdenes de servicio.");
  const conteo = new Map<string, number>();
  for (const o of data) conteo.set(o.estado, (conteo.get(o.estado) ?? 0) + 1);
  return { conteo, total: data.length };
}

export async function obtenerOrden(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ordenes_servicio")
    .select(COLUMNAS)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error("No se pudo cargar la orden de servicio.");
  return data;
}

/** "Rassini · BYPASA", o "Taller" si la orden no es de un cliente. */
export const lugarOrden = (o: {
  cuentas: { nombre: string } | null;
  plantas: { nombre: string } | null;
}) =>
  o.cuentas
    ? `${o.cuentas.nombre}${o.plantas ? ` · ${o.plantas.nombre}` : ""}`
    : "Taller";

/** Robox que se pueden elegir en una orden, con dónde está cada uno. */
async function roboxParaElegir() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("robox")
    .select("id, numero_serie")
    .is("deleted_at", null)
    .neq("estado", "baja")
    .order("numero_serie");
  if (error) throw new Error("No se pudo cargar la flota.");
  const ubicacion = await ubicaciones({ roboxIds: data.map((r) => r.id) });
  return data.map((r) => {
    const u = ubicacion.get(r.id);
    return {
      value: r.id,
      label: `${r.numero_serie}${u ? ` · ${u.cuenta}, ${u.planta}` : ""}`,
    };
  });
}

/** Opciones del formulario de una orden. Sin cuenta (taller) solo hay Robox y técnicos. */
export async function opcionesOrden(
  cuentaId: string | null,
): Promise<OpcionesOrden> {
  const supabase = await createClient();
  const [robox, { asignables }] = await Promise.all([
    roboxParaElegir(),
    directorioTecnicos(),
  ]);
  if (!cuentaId)
    return {
      plantas: [],
      contratos: [],
      equipos: [],
      robox,
      tecnicos: asignables,
    };

  const [plantas, equipos, contratos] = await Promise.all([
    supabase
      .from("plantas")
      .select("id, nombre")
      .eq("cuenta_id", cuentaId)
      .is("deleted_at", null)
      .order("nombre"),
    supabase
      .from("equipos_cliente")
      .select("id, identificador, alias, plantas!inner (nombre, cuenta_id)")
      .eq("plantas.cuenta_id", cuentaId)
      .is("deleted_at", null)
      .order("identificador"),
    listarContratos({ cuentaId }),
  ]);
  if (plantas.error || equipos.error)
    throw new Error("No se pudieron cargar los datos del cliente.");
  return {
    plantas: plantas.data.map((p) => ({ value: p.id, label: p.nombre })),
    equipos: equipos.data.map((e) => ({
      value: e.id,
      label: `${e.identificador}${e.alias ? ` (${e.alias})` : ""} · ${e.plantas.nombre}`,
    })),
    contratos: contratos
      .filter((c) => c.estado === "borrador" || c.estado === "vigente")
      .map((c) => ({
        value: c.id,
        label: `${nombreContrato(c)}${c.referencia ? ` · ${c.referencia}` : ""}`,
      })),
    robox,
    tecnicos: asignables,
  };
}
