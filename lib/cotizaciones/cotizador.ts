/**
 * Cotizador por litro (DISENO §4.2): precio sugerido = el mayor entre un
 * porcentaje del precio del aceite nuevo y un piso. El porcentaje y el piso
 * vienen de parametros_negocio; aquí no hay valores fijos.
 *
 * Se calcula con enteros (millonésimas) para no perder centavos por el
 * redondeo de los números con punto flotante.
 */

const ESCALA = 1_000_000n;

/** "5.2" → 5200000n (millonésimas). Acepta hasta 6 decimales. */
function aMillonesimas(valor: string | number): bigint {
  const texto = String(valor).trim();
  if (!/^\d+(\.\d+)?$/.test(texto))
    throw new Error(`Número no válido: "${texto}"`);
  const [entero = "0", decimales = ""] = texto.split(".");
  return BigInt(entero) * ESCALA + BigInt(decimales.padEnd(6, "0").slice(0, 6));
}

/** Millonésimas → texto con 2 decimales, redondeando hacia arriba desde medio centavo. */
function aCentavos(millonesimas: bigint): string {
  const centavos = (millonesimas + 5_000n) / 10_000n;
  return `${centavos / 100n}.${(centavos % 100n).toString().padStart(2, "0")}`;
}

export type ParametrosCotizador = {
  /** Fracción del precio del aceite nuevo (0.70 = 70 %). */
  porcentaje: string | number;
  /** Precio mínimo por litro, en `monedaPiso`. */
  piso: string | number;
  monedaPiso: string;
};

export type Sugerencia = {
  /** Precio sugerido por litro, con 2 decimales, en la moneda de la cotización. */
  precio: string;
  /** Verdadero si ganó el piso (el porcentaje daba menos). */
  aplicoPiso: boolean;
  porPorcentaje: string;
  pisoEnMoneda: string;
};

/**
 * @param precioReferencia precio del aceite nuevo por litro, en la moneda de la cotización
 * @param moneda moneda de la cotización
 * @param tipoCambio unidades de `moneda` por 1 unidad de la moneda del piso; solo se usa si son distintas
 * @returns null si faltan datos para calcular (referencia vacía o tipo de cambio faltante)
 */
export function precioSugeridoPorLitro(
  precioReferencia: string | number,
  parametros: ParametrosCotizador,
  moneda: string,
  tipoCambio?: string | number | null,
): Sugerencia | null {
  const referencia = String(precioReferencia).trim();
  if (referencia === "" || !/^\d+(\.\d+)?$/.test(referencia)) return null;

  let piso = aMillonesimas(parametros.piso);
  if (moneda !== parametros.monedaPiso) {
    if (
      tipoCambio === null ||
      tipoCambio === undefined ||
      String(tipoCambio).trim() === ""
    ) {
      return null;
    }
    piso = (piso * aMillonesimas(tipoCambio)) / ESCALA;
  }
  const porPorcentaje =
    (aMillonesimas(referencia) * aMillonesimas(parametros.porcentaje)) / ESCALA;
  const aplicoPiso = piso > porPorcentaje;

  return {
    precio: aCentavos(aplicoPiso ? piso : porPorcentaje),
    aplicoPiso,
    porPorcentaje: aCentavos(porPorcentaje),
    pisoEnMoneda: aCentavos(piso),
  };
}

/**
 * Precio de referencia por litro a partir de lo que cuesta un contenedor de
 * aceite nuevo y sus litros (ej. 2,900 USD ÷ 200 L = 14.50). Null si falta un dato.
 */
export function precioReferenciaDeContenedor(
  costo: string | number,
  litros: string | number,
): string | null {
  const c = String(costo).trim();
  const l = String(litros).trim();
  if (!/^\d+(\.\d+)?$/.test(c) || !/^\d+(\.\d+)?$/.test(l)) return null;
  const divisor = aMillonesimas(l);
  if (divisor === 0n) return null;
  // Cuatro decimales: suficiente para no perder precisión antes de aplicar el porcentaje.
  const diezmilesimas = (aMillonesimas(c) * 10_000n + divisor / 2n) / divisor;
  const texto = `${diezmilesimas / 10_000n}.${(diezmilesimas % 10_000n).toString().padStart(4, "0")}`;
  return texto.replace(/0{1,2}$/, "");
}

/** 0.70 → "70 %". */
export function comoPorcentaje(fraccion: string | number): string {
  const centesimas = aMillonesimas(fraccion) / 100n; // diezmilésimas
  const entero = centesimas / 100n;
  const resto = centesimas % 100n;
  return `${entero}${resto === 0n ? "" : `.${resto.toString().padStart(2, "0").replace(/0$/, "")}`} %`;
}
