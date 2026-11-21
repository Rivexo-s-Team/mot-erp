import "server-only";
import { tienePermiso, type Sesion } from "@/lib/auth/session";
import { diasDeAtraso } from "@/lib/facturacion/cobranza";
import { facturasPorCobrar } from "@/lib/facturacion/data";
import { alertasDeFiltro } from "@/lib/flota/data";
import { hoyEnMexico } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Conteos } from "./pendientes";

const masDias = (dia: string, n: number) => {
  const [a, m, d] = dia.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
};

/**
 * Conteos del tablero de inicio. Cada uno se consulta solo si el rol puede ver
 * ese módulo (RLS de todos modos lo impediría). Quien llena órdenes pero no
 * las administra ve las suyas.
 */
export async function conteosDeInicio(sesion: Sesion): Promise<Conteos> {
  const supabase = await createClient();
  const hoy = hoyEnMexico();
  const puede = (p: string) => tienePermiso(sesion, p);
  const soloMias =
    puede("ordenes.editar") && !puede("ordenes.administrar") ? sesion.id : null;

  const ordenes = (estado: string) => {
    let q = supabase
      .from("ordenes_servicio")
      .select("id", { count: "exact", head: true })
      .eq("estado", estado)
      .is("deleted_at", null);
    if (soloMias) q = q.eq("tecnico_id", soloMias);
    return q;
  };
  const cuenta = async (
    q: PromiseLike<{ count: number | null; error: unknown }>,
  ) => {
    const { count, error } = await q;
    if (error) throw new Error("No se pudo cargar el tablero de inicio.");
    return count ?? 0;
  };
  const si = <T>(permiso: boolean, f: () => Promise<T>) =>
    permiso ? f() : Promise.resolve(null);

  const veOrdenes = puede("ordenes.ver");
  const veLab = puede("laboratorio.ver");
  const [
    visitasAtrasadas,
    visitasSemana,
    ordenesEnCurso,
    filtrosPorCambiar,
    muestrasEnProceso,
    informesBorrador,
    oportunidadesAbiertas,
    seguimientosPorHacer,
    cargosPorFacturar,
    porCobrar,
  ] = await Promise.all([
    si(veOrdenes, () =>
      cuenta(ordenes("programada").lt("fecha_programada", hoy)),
    ),
    si(veOrdenes, () =>
      cuenta(
        ordenes("programada")
          .gte("fecha_programada", hoy)
          .lte("fecha_programada", masDias(hoy, 7)),
      ),
    ),
    si(veOrdenes, () => cuenta(ordenes("en_curso"))),
    si(puede("flota.ver"), async () => {
      const { data, error } = await supabase
        .from("robox")
        .select("id")
        .neq("estado", "baja")
        .is("deleted_at", null);
      if (error) throw new Error("No se pudo cargar el tablero de inicio.");
      return (await alertasDeFiltro(data.map((r) => r.id))).size;
    }),
    si(veLab, () =>
      cuenta(
        supabase
          .from("muestras")
          .select("id", { count: "exact", head: true })
          .in("estado", ["pendiente", "recibida", "en_analisis"])
          .is("deleted_at", null),
      ),
    ),
    si(veLab, () =>
      cuenta(
        supabase
          .from("informes")
          .select("id", { count: "exact", head: true })
          .eq("estado", "borrador")
          .is("deleted_at", null),
      ),
    ),
    si(puede("oportunidades.ver"), () =>
      cuenta(
        supabase
          .from("oportunidades")
          .select("id", { count: "exact", head: true })
          .not("etapa", "in", "(ganada,perdida,descartada)")
          .is("deleted_at", null),
      ),
    ),
    si(puede("oportunidades.ver"), () =>
      cuenta(
        supabase
          .from("oportunidades")
          .select("id", { count: "exact", head: true })
          .not("etapa", "in", "(ganada,perdida)")
          .lte("siguiente_paso_fecha", hoy)
          .is("deleted_at", null),
      ),
    ),
    si(puede("cargos.ver") && puede("precios.ver"), () =>
      cuenta(
        supabase
          .from("cargos")
          .select("id", { count: "exact", head: true })
          .eq("estado", "pendiente")
          .is("factura_id", null)
          .is("deleted_at", null),
      ),
    ),
    si(puede("facturacion.ver"), () => facturasPorCobrar()),
  ]);

  return {
    visitasAtrasadas,
    visitasSemana,
    ordenesEnCurso,
    filtrosPorCambiar,
    muestrasEnProceso,
    informesBorrador,
    oportunidadesAbiertas,
    seguimientosPorHacer,
    cargosPorFacturar,
    facturasPorCobrar: porCobrar ? porCobrar.length : null,
    facturasVencidas: porCobrar
      ? porCobrar.filter((f) => diasDeAtraso(f, hoy) > 0).length
      : null,
  };
}

/** Las siguientes visitas programadas (atrasadas primero), para el tablero. */
export async function proximasVisitas(sesion: Sesion, limite = 5) {
  if (!tienePermiso(sesion, "ordenes.ver")) return [];
  const supabase = await createClient();
  let q = supabase
    .from("ordenes_servicio")
    .select("id, folio, fecha_programada, cuentas (nombre), plantas (nombre)")
    .eq("estado", "programada")
    .is("deleted_at", null)
    .order("fecha_programada")
    .limit(limite);
  if (
    tienePermiso(sesion, "ordenes.editar") &&
    !tienePermiso(sesion, "ordenes.administrar")
  )
    q = q.eq("tecnico_id", sesion.id);
  const { data, error } = await q;
  if (error) throw new Error("No se pudieron cargar las visitas.");
  return data;
}
