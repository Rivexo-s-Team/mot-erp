/**
 * Tablero de inicio: qué hay por atender, según lo que cada quien puede ver.
 * Sin base ni navegador.
 */

/** Cada conteo es `null` cuando el rol no puede ver ese módulo. */
export type Conteos = {
  visitasAtrasadas: number | null;
  visitasSemana: number | null;
  ordenesEnCurso: number | null;
  filtrosPorCambiar: number | null;
  muestrasEnProceso: number | null;
  informesBorrador: number | null;
  oportunidadesAbiertas: number | null;
  /** Oportunidades cuyo siguiente paso ya toca. */
  seguimientosPorHacer: number | null;
  cargosPorFacturar: number | null;
  facturasPorCobrar: number | null;
  facturasVencidas: number | null;
};

export type Pendiente = {
  clave: string;
  titulo: string;
  valor: number;
  detalle: string;
  href: string;
  tono: "peligro" | "aviso" | "neutro";
};

const plural = (n: number, uno: string, varios: string) =>
  n === 1 ? uno : varios;

/** Las tarjetas del tablero, en el orden en que conviene atenderlas. */
export function pendientes(c: Conteos): Pendiente[] {
  const lista: Pendiente[] = [];
  if (c.visitasSemana !== null && c.visitasAtrasadas !== null) {
    lista.push({
      clave: "visitas",
      titulo: "Visitas de esta semana",
      valor: c.visitasSemana + c.visitasAtrasadas,
      detalle:
        c.visitasAtrasadas > 0
          ? `${c.visitasAtrasadas} ${plural(c.visitasAtrasadas, "atrasada", "atrasadas")}`
          : "Programadas en los próximos 7 días",
      href: "/agenda",
      tono: c.visitasAtrasadas > 0 ? "peligro" : "neutro",
    });
  }
  if (c.ordenesEnCurso !== null)
    lista.push({
      clave: "en_curso",
      titulo: "Órdenes en curso",
      valor: c.ordenesEnCurso,
      detalle: "Iniciadas y sin cerrar",
      href: "/ordenes?estado=en_curso",
      tono: c.ordenesEnCurso > 0 ? "aviso" : "neutro",
    });
  if (c.filtrosPorCambiar !== null)
    lista.push({
      clave: "filtros",
      titulo: "Filtros por cambiar",
      valor: c.filtrosPorCambiar,
      detalle: "Robox con alerta de cambio de filtro",
      href: "/flota",
      tono: c.filtrosPorCambiar > 0 ? "aviso" : "neutro",
    });
  if (c.muestrasEnProceso !== null)
    lista.push({
      clave: "muestras",
      titulo: "Muestras en proceso",
      valor: c.muestrasEnProceso,
      detalle: "Pendientes, recibidas o en análisis",
      href: "/laboratorio/muestras",
      tono: c.muestrasEnProceso > 0 ? "aviso" : "neutro",
    });
  if (c.informesBorrador !== null)
    lista.push({
      clave: "informes",
      titulo: "Informes por validar",
      valor: c.informesBorrador,
      detalle: "En borrador",
      href: "/laboratorio/informes",
      tono: c.informesBorrador > 0 ? "aviso" : "neutro",
    });
  if (c.oportunidadesAbiertas !== null)
    lista.push({
      clave: "oportunidades",
      titulo: "Oportunidades abiertas",
      valor: c.oportunidadesAbiertas,
      detalle: "Ventas en curso",
      href: "/oportunidades",
      tono: "neutro",
    });
  if (c.seguimientosPorHacer !== null)
    lista.push({
      clave: "seguimientos",
      titulo: "Seguimientos por hacer",
      valor: c.seguimientosPorHacer,
      detalle: "Oportunidades cuyo siguiente paso ya toca",
      href: "/oportunidades",
      tono: c.seguimientosPorHacer > 0 ? "aviso" : "neutro",
    });
  if (c.cargosPorFacturar !== null)
    lista.push({
      clave: "cargos",
      titulo: "Cargos por facturar",
      valor: c.cargosPorFacturar,
      detalle: "Pendientes y sin factura",
      href: "/cargos",
      tono: c.cargosPorFacturar > 0 ? "aviso" : "neutro",
    });
  if (c.facturasPorCobrar !== null && c.facturasVencidas !== null)
    lista.push({
      clave: "cobranza",
      titulo: "Facturas por cobrar",
      valor: c.facturasPorCobrar,
      detalle:
        c.facturasVencidas > 0
          ? `${c.facturasVencidas} ${plural(c.facturasVencidas, "vencida", "vencidas")}`
          : "Ninguna vencida",
      href: "/cobranza",
      tono: c.facturasVencidas > 0 ? "peligro" : "neutro",
    });
  return lista;
}
