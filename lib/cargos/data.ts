import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Lecturas de cargos. RLS: solo quien tiene cargos.ver y precios.ver. */

const COLUMNAS =
  "id, cuenta_id, contrato_id, orden_id, tipo, concepto, cantidad, unidad, precio_unitario, importe, moneda, estado, notas, created_at, cuentas (nombre), ordenes_servicio (folio)";

export async function listarCargos(filtro: {
  estado?: string;
  ordenId?: string;
}) {
  const supabase = await createClient();
  let query = supabase
    .from("cargos")
    .select(COLUMNAS)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (filtro.estado) query = query.eq("estado", filtro.estado);
  if (filtro.ordenId) query = query.eq("orden_id", filtro.ordenId);
  const { data, error } = await query;
  if (error) throw new Error("No se pudieron cargar los cargos.");
  return data;
}

export type Cargo = Awaited<ReturnType<typeof listarCargos>>[number];

export async function obtenerCargo(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cargos")
    .select(COLUMNAS)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error("No se pudo cargar el cargo.");
  return data;
}

/** ¿La orden tiene marcada una falla que permite cobrarle al cliente (daño por mal uso)? */
export async function ordenPermiteCargoAlCliente(
  ordenId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("os_fallas")
    .select("fallas!inner (permite_cargo_cliente)")
    .eq("orden_id", ordenId)
    .eq("fallas.permite_cargo_cliente", true)
    .limit(1);
  if (error) throw new Error("No se pudieron cargar las fallas de la orden.");
  return data.length > 0;
}

/** Partes usadas en una orden, como texto, para proponer el concepto del cargo. */
export async function partesDeOrden(ordenId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("os_partes")
    .select("cantidad, partes (nombre, orden)")
    .eq("orden_id", ordenId);
  if (error) throw new Error("No se pudieron cargar las partes de la orden.");
  return data
    .sort((a, b) => (a.partes?.orden ?? 0) - (b.partes?.orden ?? 0))
    .map((p) => `${p.partes?.nombre ?? "Parte"} (${p.cantidad})`);
}
