import { describe, expect, it } from "vitest";
import { leerCfdi, problemaConCfdi, totalDistinto } from "./cfdi";

const UUID = "5c1b6a2e-3f4d-4a8b-9c0d-1e2f3a4b5c6d";
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" Serie="A" Folio="1024"
  Fecha="2026-11-17T10:15:00" Moneda="USD" TipoCambio="18.2530" SubTotal="600.00" Total="696.00"
  MetodoPago="PPD" FormaPago="99">
  <cfdi:Emisor Rfc="MOT2004297V3" Nombre="MOLECULAR OIL TECHNOLOGY" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="xaxx010101000" Nombre="CLIENTE" UsoCFDI="G03"/>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1"
      UUID="${UUID.toUpperCase()}" FechaTimbrado="2026-11-17T10:15:30"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;

describe("leerCfdi", () => {
  it("lee folio fiscal, serie, folio, fecha, total, moneda, tipo de cambio y RFC", () => {
    expect(leerCfdi(XML)).toEqual({
      uuid: UUID,
      serie: "A",
      folio: "1024",
      fecha: "2026-11-17",
      total: 696,
      moneda: "USD",
      tipoCambio: 18.253,
      rfcReceptor: "XAXX010101000",
    });
  });

  it("no confunde el RFC del emisor con el del receptor", () => {
    expect(leerCfdi(XML)?.rfcReceptor).not.toBe("MOT2004297V3");
  });

  it("funciona sin prefijos y con comillas simples", () => {
    const simple = `<Comprobante Total='100.50' Moneda='MXN'><Receptor Rfc='AAA010101AAA'/><TimbreFiscalDigital UUID='${UUID}'/></Comprobante>`;
    expect(leerCfdi(simple)).toMatchObject({
      uuid: UUID,
      total: 100.5,
      moneda: "MXN",
      serie: null,
      folio: null,
      fecha: null,
      tipoCambio: null,
    });
  });

  it("un archivo que no es un CFDI timbrado no se lee", () => {
    expect(leerCfdi("<html><body>hola</body></html>")).toBeNull();
    // Un CFDI sin timbrar no tiene folio fiscal.
    expect(
      leerCfdi(`<cfdi:Comprobante Total="1"></cfdi:Comprobante>`),
    ).toBeNull();
    expect(leerCfdi("")).toBeNull();
  });
});

describe("problemaConCfdi", () => {
  const factura = { uuid_fiscal: UUID, rfc: "XAXX010101000", moneda: "USD" };
  const cfdi = leerCfdi(XML);

  it("acepta el XML de la factura", () => {
    expect(problemaConCfdi(cfdi, factura)).toBeNull();
    expect(
      problemaConCfdi(cfdi, { ...factura, uuid_fiscal: UUID.toUpperCase() }),
    ).toBeNull();
  });

  it("rechaza el XML de otra factura, de otro RFC o en otra moneda", () => {
    expect(
      problemaConCfdi(cfdi, {
        ...factura,
        uuid_fiscal: "00000000-0000-4000-8000-000000000000",
      }),
    ).toMatch(/de otra factura/);
    expect(problemaConCfdi(cfdi, { ...factura, rfc: "BBB010101BBB" })).toMatch(
      /otro RFC/,
    );
    expect(problemaConCfdi(cfdi, { ...factura, moneda: "MXN" })).toMatch(
      /está en USD/,
    );
    expect(problemaConCfdi(null, factura)).toMatch(/no es el XML/);
  });
});

describe("totalDistinto", () => {
  it("tolera un centavo de redondeo", () => {
    expect(totalDistinto(696, 696)).toBe(false);
    expect(totalDistinto(696.01, 696)).toBe(false);
    expect(totalDistinto(696.02, 696)).toBe(true);
    expect(totalDistinto(null, 696)).toBe(false);
  });
});
