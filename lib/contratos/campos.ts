import { MONEDAS } from "@/lib/clientes/campos";
import type { Campo, Opcion, Validador } from "@/lib/forms/campos";

/** Contratos y tarifas (DISENO §4.3, decisiones D15 y D18). */

export const TIPOS_CONTRATO: Opcion[] = [
  { value: "renta", label: "Renta" },
  { value: "por_evento", label: "Por evento" },
  { value: "unico", label: "Servicio único" },
  { value: "servicio", label: "Servicio" },
  { value: "laboratorio", label: "Laboratorio" },
];

export const ESTADOS_CONTRATO: Opcion[] = [
  { value: "borrador", label: "Borrador" },
  { value: "vigente", label: "Vigente" },
  { value: "terminado", label: "Terminado" },
  { value: "cancelado", label: "Cancelado" },
];

export const UNIDADES_TARIFA: Opcion[] = [
  { value: "mes", label: "Por mes" },
  { value: "litro", label: "Por litro" },
  { value: "evento", label: "Por evento" },
  { value: "servicio", label: "Por servicio" },
  { value: "unico", label: "Pago único" },
];

export const etiqueta = (opciones: Opcion[], valor: string | null) =>
  opciones.find((o) => o.value === valor)?.label ?? valor ?? "—";

export function camposContrato(
  plantas: Opcion[],
  razonesSociales: Opcion[],
  contratosOrigen: Opcion[],
  monedaInicial = "USD",
): Campo[] {
  return [
    {
      name: "planta_id",
      label: "Planta",
      tipo: "referencia",
      opciones: plantas,
      soloAlCrear: true,
      ayuda:
        "Un contrato es de una sola planta. Después ya no se puede cambiar.",
    },
    {
      name: "tipo",
      label: "Tipo de contrato",
      tipo: "opciones",
      opciones: TIPOS_CONTRATO,
    },
    {
      name: "estado",
      label: "Estado",
      tipo: "opciones",
      opciones: ESTADOS_CONTRATO,
      valorInicial: "borrador",
      ayuda: "Borrador mientras se firma; Vigente cuando ya está en operación.",
    },
    {
      name: "razon_social_id",
      label: "Razón social a facturar",
      tipo: "referencia",
      opcional: true,
      opciones: razonesSociales,
      ayuda:
        razonesSociales.length === 0
          ? "Este cliente aún no tiene razones sociales. Se agregan en su ficha."
          : undefined,
    },
    {
      name: "referencia",
      label: "Referencia o número de contrato",
      tipo: "texto",
      opcional: true,
      max: 80,
    },
    {
      name: "contrato_origen_id",
      label: "Es ampliación de",
      tipo: "referencia",
      opcional: true,
      opciones: contratosOrigen,
      ayuda: "Déjalo en Ninguno si es un contrato nuevo.",
    },
    { name: "fecha_inicio", label: "Inicio", tipo: "fecha", opcional: true },
    {
      name: "fecha_termino",
      label: "Término",
      tipo: "fecha",
      opcional: true,
      ayuda: "Las rentas se firman normalmente a 3 años.",
    },
    {
      name: "moneda",
      label: "Moneda",
      tipo: "opciones",
      opciones: MONEDAS,
      valorInicial: monedaInicial,
      ayuda: "Todas las tarifas del contrato van en esta moneda.",
    },
    { name: "incluye_filtros", label: "Incluye filtros", tipo: "casilla" },
    {
      name: "incluye_laboratorio",
      label: "Incluye análisis de laboratorio",
      tipo: "casilla",
    },
    {
      name: "frecuencia_visitas",
      label: "Frecuencia de visitas",
      tipo: "texto",
      opcional: true,
      max: 80,
      ayuda: "Ejemplos: Mensual, Cada 15 días.",
    },
    { name: "notas", label: "Notas", tipo: "textoLargo", opcional: true },
  ];
}

export const validarContrato: Validador = (v) =>
  v.fecha_inicio && v.fecha_termino && v.fecha_termino < v.fecha_inicio
    ? {
        campo: "fecha_termino",
        mensaje: "El término no puede ser anterior al inicio.",
      }
    : null;

export function camposTarifa(
  equipos: Opcion[],
  moneda: string,
  ordenesCompra: Opcion[] = [],
): Campo[] {
  return [
    {
      name: "concepto",
      label: "Concepto",
      tipo: "texto",
      max: 200,
      ayuda:
        "En una renta, una tarifa por cada Robox. Ejemplo: Renta mensual de Robox.",
    },
    {
      name: "unidad",
      label: "Se cobra",
      tipo: "opciones",
      opciones: UNIDADES_TARIFA,
      valorInicial: "mes",
      ayuda: "Pago único: anticipo, instalación u otro cargo de una sola vez.",
    },
    {
      name: "precio",
      label: `Precio sin IVA (${moneda})`,
      tipo: "numero",
    },
    {
      name: "equipo_cliente_id",
      label: "Equipo del cliente",
      tipo: "referencia",
      opcional: true,
      opciones: equipos,
      ayuda: "Solo si el precio es de un equipo o tanque en particular.",
    },
    {
      name: "orden_compra_id",
      label: "Orden de compra que la cubre",
      tipo: "referencia",
      opcional: true,
      opciones: ordenesCompra,
      ayuda:
        ordenesCompra.length === 0
          ? "Este contrato aún no tiene órdenes de compra. Se agregan en su ficha."
          : "Déjalo en Ninguno si el cliente no exige orden de compra.",
    },
    {
      name: "orden",
      label: "Orden en la lista",
      tipo: "entero",
      opcional: true,
    },
    { name: "notas", label: "Notas", tipo: "textoLargo", opcional: true },
  ];
}

export type PartidaCotizada = {
  orden: number;
  concepto: string;
  unidad: string;
  precio_unitario: string | number;
  importe: string | number;
  recurrente: boolean;
  equipo_cliente_id: string | null;
  equipo_planta_id: string | null;
};

export type TarifaNueva = {
  orden: number;
  concepto: string;
  unidad: string;
  precio: string | number;
  equipo_cliente_id: string | null;
};

/**
 * Tarifas iniciales de un contrato a partir de las partidas de la cotización
 * aceptada. Es solo un punto de partida que el usuario revisa:
 * - un servicio de una sola vez pasa como pago único, con su importe total;
 * - lo demás conserva su unidad y su precio unitario;
 * - el equipo se conserva solo si es de la planta del contrato.
 */
export function partidasATarifas(
  partidas: PartidaCotizada[],
  plantaId: string,
): TarifaNueva[] {
  return partidas.map((p, i) => {
    const unico = !p.recurrente && p.unidad === "servicio";
    return {
      orden: p.orden || i + 1,
      concepto: p.concepto,
      unidad: unico ? "unico" : p.unidad,
      precio: unico ? p.importe : p.precio_unitario,
      equipo_cliente_id:
        p.equipo_planta_id === plantaId ? p.equipo_cliente_id : null,
    };
  });
}

/** "01/04/2024 al 31/03/2027", o lo que se sepa. */
export function textoVigencia(
  inicio: string | null,
  termino: string | null,
  formato: (dia: string) => string,
): string {
  if (inicio && termino) return `${formato(inicio)} al ${formato(termino)}`;
  if (inicio) return `Desde el ${formato(inicio)}`;
  if (termino) return `Hasta el ${formato(termino)}`;
  return "Sin fechas";
}

/** Orden de compra del cliente. El monto va en la moneda del contrato. */
export function camposOrdenCompra(moneda: string): Campo[] {
  return [
    {
      name: "numero",
      label: "Número de orden de compra",
      tipo: "texto",
      max: 60,
      ayuda: "Tal como lo da el cliente. Ejemplo: 5300402443.",
    },
    {
      name: "monto",
      label: `Monto sin IVA (${moneda})`,
      tipo: "numero",
      opcional: true,
      ayuda: "Déjalo vacío si la orden no fija un monto.",
    },
    {
      name: "fecha_inicio",
      label: "Vigente desde",
      tipo: "fecha",
      opcional: true,
    },
    {
      name: "fecha_termino",
      label: "Vigente hasta",
      tipo: "fecha",
      opcional: true,
    },
    { name: "notas", label: "Notas", tipo: "textoLargo", opcional: true },
  ];
}

export const validarOrdenCompra: Validador = (v) =>
  v.fecha_inicio && v.fecha_termino && v.fecha_termino < v.fecha_inicio
    ? {
        campo: "fecha_termino",
        mensaje: "El término no puede ser anterior al inicio.",
      }
    : null;

/** Una orden está vencida cuando su último día de vigencia ya pasó. */
export const ordenVencida = (fechaTermino: string | null, hoy: string) =>
  fechaTermino !== null && fechaTermino < hoy;
