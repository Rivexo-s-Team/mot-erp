import type { Campo, Opcion, Validador } from "@/lib/forms/campos";

/** Inventario de partes y accesorios (DISENO §4.4). La existencia es la suma de los movimientos. */

export const TIPOS_MOVIMIENTO: Opcion[] = [
  { value: "entrada", label: "Entrada (compra o devolución)" },
  { value: "salida", label: "Salida (uso fuera de una orden)" },
  { value: "ajuste", label: "Ajuste por conteo" },
];

export const etiquetaMovimiento = (tipo: string) =>
  tipo === "entrada" ? "Entrada" : tipo === "salida" ? "Salida" : "Ajuste";

export function camposMovimiento(partes: Opcion[], hoy: string): Campo[] {
  return [
    {
      name: "parte_id",
      label: "Parte o accesorio",
      tipo: "referencia",
      opciones: partes,
    },
    {
      name: "tipo",
      label: "Tipo de movimiento",
      tipo: "opciones",
      opciones: TIPOS_MOVIMIENTO,
      valorInicial: "entrada",
      ayuda:
        "Las partes usadas en una orden de servicio salen solas al cerrar la orden; no las registres aquí.",
    },
    {
      name: "cantidad",
      label: "Cantidad",
      tipo: "numero",
      ayuda:
        "En entradas y salidas, cuántas piezas. En un ajuste, cuántas hay en realidad según el conteo.",
    },
    {
      name: "fecha",
      label: "Fecha",
      tipo: "fecha",
      valorInicial: hoy,
      ayuda: "Un ajuste siempre se registra con la fecha de hoy.",
    },
    {
      name: "referencia",
      label: "Referencia",
      tipo: "texto",
      opcional: true,
      max: 80,
      ayuda: "Factura o remisión de la compra, por ejemplo.",
    },
    { name: "notas", label: "Notas", tipo: "textoLargo", opcional: true },
  ];
}

/** Entradas y salidas llevan cantidad mayor que cero; un conteo puede dar cero. */
export const validarMovimiento: Validador = (v) =>
  v.tipo !== "ajuste" && Number(v.cantidad) <= 0
    ? { campo: "cantidad", mensaje: "Debe ser mayor que cero." }
    : null;

/** Cantidad con signo que se guarda: las salidas restan. */
export const cantidadConSigno = (tipo: string, cantidad: number) =>
  tipo === "salida" ? -cantidad : cantidad;

/** "+10", "-2": así se muestra un movimiento en el historial. */
export function textoCantidad(cantidad: number | string): string {
  const n = Number(cantidad);
  return `${n > 0 ? "+" : ""}${n}`;
}

/** Cómo anda la existencia de una parte, para resaltarla en la lista. */
export function nivelExistencia(
  existencia: number | string,
): "negativa" | "agotada" | "disponible" {
  const n = Number(existencia);
  return n < 0 ? "negativa" : n === 0 ? "agotada" : "disponible";
}
