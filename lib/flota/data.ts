import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Lecturas de la flota. RLS decide qué ve cada rol. */

const COLUMNAS =
  "id, numero_serie, modelo, version_programa, sim, estado, fecha_alta, notas, created_at, updated_at";

export async function listarRobox(filtro: {
  estado?: string;
  busqueda?: string;
}) {
  const supabase = await createClient();
  let query = supabase
    .from("robox")
    .select(COLUMNAS)
    .is("deleted_at", null)
    .order("numero_serie");
  if (filtro.estado) query = query.eq("estado", filtro.estado);
  // Se quitan los comodines para que la búsqueda sea texto literal.
  const texto = (filtro.busqueda ?? "").replace(/[%_\\]/g, "").trim();
  if (texto) query = query.ilike("numero_serie", `%${texto}%`);

  const { data, error } = await query;
  if (error) throw new Error("No se pudo cargar la flota.");
  return data;
}

/** Cuántos Robox vigentes hay en cada estado. */
export async function contarPorEstado() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("robox")
    .select("estado")
    .is("deleted_at", null);
  if (error) throw new Error("No se pudo cargar la flota.");
  const conteo = new Map<string, number>();
  for (const r of data) conteo.set(r.estado, (conteo.get(r.estado) ?? 0) + 1);
  return { conteo, total: data.length };
}

export async function obtenerRobox(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("robox")
    .select(COLUMNAS)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error("No se pudo cargar el Robox.");
  return data;
}

// Asignaciones, carrusel y movimientos -----------------------------------------

export type Ubicacion = {
  asignacionId: string;
  contratoId: string;
  cuentaId: string;
  plantaId: string;
  cuenta: string;
  planta: string;
  tanque: string | null;
  tanqueId: string | null;
  fechaInicio: string;
};

type EquipoBasico = { id: string; identificador: string; alias: string | null };

async function equiposPorId(ids: string[]) {
  const mapa = new Map<string, EquipoBasico>();
  if (ids.length === 0) return mapa;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("equipos_cliente")
    .select("id, identificador, alias")
    .in("id", ids);
  if (error) throw new Error("No se pudieron cargar los equipos.");
  for (const e of data) mapa.set(e.id, e);
  return mapa;
}

const nombre = (e: EquipoBasico | undefined) =>
  e ? `${e.identificador}${e.alias ? ` (${e.alias})` : ""}` : null;

/**
 * Dónde está cada Robox asignado: cliente, planta y tanque actual. Se calcula
 * de la asignación activa y el último movimiento (vista robox_ubicacion).
 * Se puede limitar a unos Robox o a un contrato.
 */
export async function ubicaciones(filtro?: {
  roboxIds?: string[];
  contratoId?: string;
}) {
  const mapa = new Map<string, Ubicacion>();
  if (filtro?.roboxIds && filtro.roboxIds.length === 0) return mapa;
  const supabase = await createClient();
  let query = supabase
    .from("robox_ubicacion")
    .select(
      "robox_id, asignacion_id, contrato_id, planta_id, cuenta_id, fecha_inicio, equipo_cliente_id",
    );
  if (filtro?.roboxIds) query = query.in("robox_id", filtro.roboxIds);
  if (filtro?.contratoId) query = query.eq("contrato_id", filtro.contratoId);
  const { data, error } = await query;
  if (error) throw new Error("No se pudo cargar la ubicación de los Robox.");
  if (data.length === 0) return mapa;

  const ids = <T>(valores: (T | null)[]) => [
    ...new Set(valores.filter((v): v is T => v !== null)),
  ];
  const [plantas, equipos] = await Promise.all([
    supabase
      .from("plantas")
      .select("id, nombre, cuentas (nombre)")
      .in("id", ids(data.map((u) => u.planta_id))),
    equiposPorId(ids(data.map((u) => u.equipo_cliente_id))),
  ]);
  if (plantas.error) throw new Error("No se pudo cargar la ubicación.");
  const plantaPorId = new Map(plantas.data.map((p) => [p.id, p]));

  for (const u of data) {
    if (
      !u.robox_id ||
      !u.asignacion_id ||
      !u.contrato_id ||
      !u.planta_id ||
      !u.cuenta_id ||
      !u.fecha_inicio
    )
      continue;
    const planta = plantaPorId.get(u.planta_id);
    mapa.set(u.robox_id, {
      asignacionId: u.asignacion_id,
      contratoId: u.contrato_id,
      cuentaId: u.cuenta_id,
      plantaId: u.planta_id,
      cuenta: planta?.cuentas?.nombre ?? "—",
      planta: planta?.nombre ?? "—",
      tanqueId: u.equipo_cliente_id,
      tanque: u.equipo_cliente_id
        ? nombre(equipos.get(u.equipo_cliente_id))
        : null,
      fechaInicio: u.fecha_inicio,
    });
  }
  return mapa;
}

/** Todas las asignaciones de un Robox, la más reciente primero. */
export async function asignacionesDeRobox(roboxId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("asignaciones_robox")
    .select(
      "id, contrato_id, planta_id, fecha_inicio, fecha_fin, notas, contratos (tipo, cuentas (nombre), plantas (nombre))",
    )
    .eq("robox_id", roboxId)
    .is("deleted_at", null)
    .order("fecha_inicio", { ascending: false });
  if (error) throw new Error("No se pudieron cargar las asignaciones.");
  return data;
}

export type Asignacion = Awaited<
  ReturnType<typeof asignacionesDeRobox>
>[number];

export async function carruselDeAsignacion(asignacionId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("carrusel_equipos")
    .select(
      "id, equipo_cliente_id, orden, id_caso, equipos_cliente (identificador, alias)",
    )
    .eq("asignacion_id", asignacionId)
    .is("deleted_at", null)
    .order("orden")
    .order("created_at");
  if (error) throw new Error("No se pudo cargar el carrusel.");
  return data;
}

/** Movimientos de una asignación, el más reciente primero, con el nombre de cada tanque. */
export async function movimientosDeAsignacion(asignacionId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("movimientos_robox")
    .select(
      "id, fecha, equipo_origen_id, equipo_destino_id, movido_por, notas, created_at",
    )
    .eq("asignacion_id", asignacionId)
    .is("deleted_at", null)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error("No se pudieron cargar los movimientos.");
  const equipos = await equiposPorId([
    ...new Set(
      data.flatMap((m) =>
        m.equipo_origen_id
          ? [m.equipo_origen_id, m.equipo_destino_id]
          : [m.equipo_destino_id],
      ),
    ),
  ]);
  return data.map((m) => ({
    ...m,
    origen: m.equipo_origen_id ? nombre(equipos.get(m.equipo_origen_id)) : null,
    destino: nombre(equipos.get(m.equipo_destino_id)) ?? "—",
  }));
}

/** Robox que hoy están asignados a un contrato, con su tanque actual. */
export async function roboxDeContrato(contratoId: string) {
  const ubicacion = await ubicaciones({ contratoId });
  if (ubicacion.size === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("robox")
    .select("id, numero_serie, estado")
    .in("id", [...ubicacion.keys()])
    .order("numero_serie");
  if (error) throw new Error("No se pudieron cargar los Robox del contrato.");
  return data.map((r) => ({ ...r, ubicacion: ubicacion.get(r.id) }));
}
