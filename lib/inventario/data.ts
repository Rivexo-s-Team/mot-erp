import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Lecturas del inventario. RLS decide qué ve cada rol. */

/** Partes activas (y las inactivas que aún tienen existencia), con cuántas hay. */
export async function listarExistencias(filtro: {
  tipo?: string;
  busqueda?: string;
}) {
  const supabase = await createClient();
  let query = supabase
    .from("partes")
    .select("id, nombre, tipo, activo")
    .order("orden")
    .order("nombre");
  if (filtro.tipo) query = query.eq("tipo", filtro.tipo);
  // Se quitan los comodines para que la búsqueda sea texto literal.
  const texto = (filtro.busqueda ?? "").replace(/[%_\\]/g, "").trim();
  if (texto) query = query.ilike("nombre", `%${texto}%`);

  const [partes, existencias] = await Promise.all([
    query,
    supabase
      .from("inventario_existencias")
      .select("parte_id, existencia, ultimo_movimiento"),
  ]);
  if (partes.error || existencias.error)
    throw new Error("No se pudo cargar el inventario.");
  const porParte = new Map(existencias.data.map((e) => [e.parte_id, e]));
  return partes.data
    .map((p) => {
      const e = porParte.get(p.id);
      return {
        ...p,
        existencia: Number(e?.existencia ?? 0),
        ultimoMovimiento: e?.ultimo_movimiento ?? null,
      };
    })
    .filter((p) => p.activo || p.existencia !== 0);
}

export async function obtenerParte(id: string) {
  const supabase = await createClient();
  const [parte, existencia, movimientos] = await Promise.all([
    supabase
      .from("partes")
      .select("id, nombre, tipo, notas, activo")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("inventario_existencias")
      .select("existencia")
      .eq("parte_id", id)
      .maybeSingle(),
    supabase
      .from("inventario_movimientos")
      .select(
        "id, tipo, cantidad, fecha, referencia, notas, orden_id, created_at, ordenes_servicio (folio)",
      )
      .eq("parte_id", id)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);
  if (parte.error || existencia.error || movimientos.error)
    throw new Error("No se pudo cargar la parte.");
  if (!parte.data) return null;
  return {
    ...parte.data,
    existencia: Number(existencia.data?.existencia ?? 0),
    movimientos: movimientos.data,
  };
}

/** Partes que se pueden elegir al registrar un movimiento. */
export async function partesParaElegir() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partes")
    .select("id, nombre")
    .eq("activo", true)
    .order("orden")
    .order("nombre");
  if (error) throw new Error("No se pudieron cargar las partes.");
  return data.map((p) => ({ value: p.id, label: p.nombre }));
}
