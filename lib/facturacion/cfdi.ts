/**
 * Lectura del XML de un CFDI 4.0 (o 3.3) ya timbrado, para comprobar que el
 * archivo que se sube es el de la factura registrada. Solo lee lo necesario;
 * no valida el sello ni el esquema. Sin base ni navegador.
 */

export type DatosCfdi = {
  uuid: string;
  serie: string | null;
  folio: string | null;
  /** Día de emisión (aaaa-mm-dd). */
  fecha: string | null;
  total: number | null;
  moneda: string | null;
  tipoCambio: number | null;
  rfcReceptor: string | null;
};

/** Atributos de la primera etiqueta con ese nombre (sin importar su prefijo). */
function atributos(
  xml: string,
  etiqueta: string,
): Record<string, string> | null {
  const m = new RegExp(`<(?:[\\w.-]+:)?${etiqueta}\\b([^>]*)>`, "i").exec(xml);
  if (!m) return null;
  const resultado: Record<string, string> = {};
  for (const a of (m[1] ?? "").matchAll(
    /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g,
  ))
    resultado[(a[1] ?? "").toLowerCase()] = a[2] ?? a[3] ?? "";
  return resultado;
}

const numero = (v: string | undefined) =>
  v !== undefined && /^\d+(\.\d+)?$/.test(v) ? Number(v) : null;

/** Lee el CFDI. Null si el archivo no es un CFDI timbrado. */
export function leerCfdi(xml: string): DatosCfdi | null {
  const comprobante = atributos(xml, "Comprobante");
  const timbre = atributos(xml, "TimbreFiscalDigital");
  const uuid = timbre?.uuid?.toLowerCase();
  if (!comprobante || !uuid || !/^[0-9a-f-]{36}$/.test(uuid)) return null;
  const receptor = atributos(xml, "Receptor");
  return {
    uuid,
    serie: comprobante.serie || null,
    folio: comprobante.folio || null,
    fecha: /^\d{4}-\d{2}-\d{2}/.test(comprobante.fecha ?? "")
      ? (comprobante.fecha ?? "").slice(0, 10)
      : null,
    total: numero(comprobante.total),
    moneda: comprobante.moneda?.toUpperCase() || null,
    tipoCambio: numero(comprobante.tipocambio),
    rfcReceptor: receptor?.rfc?.toUpperCase() || null,
  };
}

/**
 * ¿El XML es el de esta factura? Devuelve el motivo si no lo es. El folio
 * fiscal y el RFC deben coincidir; el total se compara aparte porque puede
 * diferir por centavos de redondeo.
 */
export function problemaConCfdi(
  cfdi: DatosCfdi | null,
  factura: { uuid_fiscal: string | null; rfc: string | null; moneda: string },
): string | null {
  if (!cfdi) return "El archivo no es el XML de una factura timbrada.";
  if (cfdi.uuid !== factura.uuid_fiscal?.toLowerCase())
    return `El XML es de otra factura: su folio fiscal es ${cfdi.uuid}.`;
  if (
    cfdi.rfcReceptor &&
    factura.rfc &&
    cfdi.rfcReceptor !== factura.rfc.toUpperCase()
  )
    return `El XML está a nombre de otro RFC (${cfdi.rfcReceptor}).`;
  if (cfdi.moneda && cfdi.moneda !== factura.moneda)
    return `El XML está en ${cfdi.moneda} y la factura en ${factura.moneda}.`;
  return null;
}

/** El total del XML difiere del que calcula el sistema por más de un centavo. */
export const totalDistinto = (
  xmlTotal: number | null,
  totalSistema: number | null,
) =>
  xmlTotal !== null &&
  totalSistema !== null &&
  Math.abs(Math.round(xmlTotal * 100) - Math.round(totalSistema * 100)) > 1;
