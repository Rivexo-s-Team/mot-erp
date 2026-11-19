import type { Opcion } from "@/lib/forms/campos";

/**
 * Prospecto o cliente: no se captura, se deduce de los contratos de la cuenta.
 * cliente: tiene algún contrato vigente. anterior: tuvo contrato (terminado)
 * y hoy ninguno vigente. prospecto: nunca ha tenido contrato en firme (los
 * borradores y los cancelados no cuentan).
 */
export type TipoCuenta = "cliente" | "prospecto" | "anterior";

export const TIPOS_CUENTA: Opcion[] = [
  { value: "cliente", label: "Cliente" },
  { value: "prospecto", label: "Prospecto" },
  { value: "anterior", label: "Cliente anterior" },
];

export function tipoDeCuenta(estadosDeContratos: string[]): TipoCuenta {
  if (estadosDeContratos.includes("vigente")) return "cliente";
  if (estadosDeContratos.includes("terminado")) return "anterior";
  return "prospecto";
}

export const nombreTipoCuenta = (tipo: TipoCuenta) =>
  TIPOS_CUENTA.find((t) => t.value === tipo)?.label ?? tipo;

/** Variante de la etiqueta para cada tipo. */
export const VARIANTE_TIPO_CUENTA = {
  cliente: "exito",
  prospecto: "secondary",
  anterior: "neutro",
} as const satisfies Record<TipoCuenta, string>;
