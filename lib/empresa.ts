/**
 * Datos de MOT que se imprimen en los documentos para el cliente, tomados de
 * su cotización tipo (hoja "Cotizacion Tipo" del 12 nov 2026).
 * Cambian muy rara vez; si llegaran a cambiar seguido, se pasan a la base.
 */
export const EMPRESA = {
  razonSocial: "MOLECULAR OIL TECHNOLOGY SAPI DE CV",
  rfc: "MOT2004297V3",
  domicilio: [
    "Carretera Estatal 431 KM 2+200 Lote 100-3",
    "Col. La Machorra",
    "El Marqués, Querétaro, CP 76246",
  ],
  domicilioPie:
    "Carretera Estatal No. 431, km 2+200, Lote 100-3, Parque Tecnológico Innovación Querétaro, Col. La Machorra, El Marqués, Querétaro, CP 76246",
  leyendaPie: "DST® Double Separation Technology by SKF",
} as const;
