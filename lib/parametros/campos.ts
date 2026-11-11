import type { Campo } from "@/lib/forms/campos";

/** Edición de un parámetro de negocio: solo cambia su valor. */
export const CAMPOS_PARAMETRO: Campo[] = [
  { name: "valor", label: "Valor", tipo: "numero" },
];

/** Cómo se muestra cada valor según su unidad. */
export function describirValor(p: {
  valor: number;
  unidad: string;
  moneda: string | null;
}): string {
  switch (p.unidad) {
    case "fraccion":
      return `${p.valor} (${Math.round(p.valor * 10000) / 100} %)`;
    case "por_litro":
      return `${p.valor.toFixed(2)} ${p.moneda ?? ""} por litro`;
    case "pruebas_no_pasa":
      return `${p.valor} pruebas "no pasa"`;
    default:
      return String(p.valor);
  }
}

/** Ayuda para quien edita, según la unidad del parámetro. */
export function ayudaValor(unidad: string, moneda: string | null): string {
  switch (unidad) {
    case "fraccion":
      return "Escríbelo como fracción: 0.70 es 70 %.";
    case "por_litro":
      return `Importe en ${moneda ?? "la moneda indicada"} por litro.`;
    case "pruebas_no_pasa":
      return "Número entero de pruebas.";
    default:
      return "";
  }
}
