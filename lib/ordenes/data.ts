import "server-only";
import { BUCKETS } from "@/lib/archivos/config";
import { listarContratos, nombreContrato } from "@/lib/contratos/data";
import { ubicaciones } from "@/lib/flota/data";
import { createClient } from "@/lib/supabase/server";
import { ESTADOS_ABIERTOS, type OpcionesOrden } from "./campos";
import {
  CAMPOS_LECTURA,
  capturaVacia,
  type Captura,
  type RolFirma,
} from "./captura";

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

// Captura de la visita ----------------------------------------------------------

/** Actividades y fallas que se pueden marcar (las activas, más las que la orden ya tenga). */
export async function catalogosCaptura(captura: Captura) {
  const supabase = await createClient();
  const [actividades, fallas] = await Promise.all([
    supabase
      .from("actividades")
      .select("id, nombre, lleva_cantidad, activo")
      .order("orden")
      .order("nombre"),
    supabase
      .from("fallas")
      .select("id, nombre, activo")
      .order("orden")
      .order("nombre"),
  ]);
  if (actividades.error || fallas.error)
    throw new Error("No se pudieron cargar los catálogos.");
  return {
    actividades: actividades.data
      .filter((a) => a.activo || a.id in captura.actividades)
      .map(({ id, nombre, lleva_cantidad }) => ({
        id,
        nombre,
        llevaCantidad: lleva_cantidad,
      })),
    fallas: fallas.data
      .filter((f) => f.activo || captura.fallas.includes(f.id))
      .map(({ id, nombre }) => ({ id, nombre })),
  };
}

const texto = (v: string | number | null | undefined) =>
  v === null || v === undefined ? "" : String(v);

/**
 * Lo capturado en una orden. Si todavía no hay nada, propone lo que el sistema
 * ya sabe: modelo, serie y programa del Robox, el volumen del reservorio del
 * equipo y el ID de caso de su carrusel.
 */
export async function obtenerCaptura(ordenId: string): Promise<{
  captura: Captura;
  /** Falso si lo que se devuelve es solo la propuesta inicial. */
  hayCaptura: boolean;
}> {
  const supabase = await createClient();
  const [orden, lecturas, actividades, fallas, firmas] = await Promise.all([
    supabase
      .from("ordenes_servicio")
      .select(
        "id_caso, temperatura_aceite_c, volumen_reservorio_l, observaciones, robox_id, equipo_cliente_id, robox (numero_serie, modelo, version_programa), equipos_cliente (volumen_reservorio_l)",
      )
      .eq("id", ordenId)
      .maybeSingle(),
    supabase.from("os_lecturas").select("*").eq("orden_id", ordenId),
    supabase
      .from("os_actividades")
      .select("actividad_id, cantidad")
      .eq("orden_id", ordenId),
    supabase.from("os_fallas").select("falla_id").eq("orden_id", ordenId),
    supabase
      .from("os_firmas")
      .select("rol, nombre, cargo, fecha, trazos")
      .eq("orden_id", ordenId),
  ]);
  if (
    orden.error ||
    lecturas.error ||
    actividades.error ||
    fallas.error ||
    firmas.error
  )
    throw new Error("No se pudo cargar la captura de la orden.");

  const captura = capturaVacia();
  const o = orden.data;
  if (!o) return { captura, hayCaptura: false };

  captura.id_caso = texto(o.id_caso);
  captura.temperatura_aceite_c = texto(o.temperatura_aceite_c);
  captura.volumen_reservorio_l = texto(o.volumen_reservorio_l);
  captura.observaciones = texto(o.observaciones);
  for (const l of lecturas.data) {
    if (l.momento !== "inicial" && l.momento !== "posterior") continue;
    const fila = l as unknown as Record<string, string | number | null>;
    for (const c of CAMPOS_LECTURA)
      captura.lecturas[l.momento][c.name] = texto(fila[c.name]);
  }
  for (const a of actividades.data)
    captura.actividades[a.actividad_id] = texto(a.cantidad);
  captura.fallas = fallas.data.map((f) => f.falla_id);
  for (const f of firmas.data) {
    if (f.rol !== "tecnico" && f.rol !== "cliente") continue;
    captura.firmas[f.rol as RolFirma] = {
      nombre: f.nombre,
      cargo: texto(f.cargo),
      fecha: texto(f.fecha),
      trazos: Array.isArray(f.trazos) ? (f.trazos as number[][]) : [],
    };
  }

  const hayCaptura =
    lecturas.data.length > 0 ||
    actividades.data.length > 0 ||
    fallas.data.length > 0 ||
    firmas.data.length > 0 ||
    [
      o.id_caso,
      o.temperatura_aceite_c,
      o.volumen_reservorio_l,
      o.observaciones,
    ].some((v) => v !== null);
  if (hayCaptura) return { captura, hayCaptura };

  // Propuesta inicial con lo que el sistema ya sabe.
  captura.volumen_reservorio_l = texto(o.equipos_cliente?.volumen_reservorio_l);
  if (o.robox) {
    captura.lecturas.inicial.modelo = texto(o.robox.modelo);
    captura.lecturas.inicial.numero_serie = texto(o.robox.numero_serie);
    captura.lecturas.inicial.programa = texto(o.robox.version_programa);
  }
  if (o.robox_id && o.equipo_cliente_id) {
    const u = (await ubicaciones({ roboxIds: [o.robox_id] })).get(o.robox_id);
    if (u) {
      const { data } = await supabase
        .from("carrusel_equipos")
        .select("id_caso")
        .eq("asignacion_id", u.asignacionId)
        .eq("equipo_cliente_id", o.equipo_cliente_id)
        .is("deleted_at", null)
        .maybeSingle();
      captura.id_caso = texto(data?.id_caso);
    }
  }
  return { captura, hayCaptura };
}

// Fotos de la visita ------------------------------------------------------------

/** Fotos de una orden, con un enlace temporal (5 minutos) para verlas. */
export async function evidenciasDeOrden(ordenId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("os_evidencias")
    .select("id, tipo, nombre, ruta, created_at")
    .eq("orden_id", ordenId)
    .is("deleted_at", null)
    .order("created_at");
  if (error) throw new Error("No se pudieron cargar las fotos.");
  if (data.length === 0) return [];
  const { data: enlaces } = await supabase.storage
    .from(BUCKETS.evidencia)
    .createSignedUrls(
      data.map((e) => e.ruta),
      300,
    );
  const urlPorRuta = new Map(
    (enlaces ?? []).map((e) => [e.path, e.signedUrl] as const),
  );
  return data.map(({ ruta, ...e }) => ({
    ...e,
    url: urlPorRuta.get(ruta) ?? null,
  }));
}

export type Evidencia = Awaited<ReturnType<typeof evidenciasDeOrden>>[number];
