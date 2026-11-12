import { describe, expect, it } from "vitest";
import { describirCantidad } from "./campos";
import { datosParaPdf, nombreArchivo, type EntradaPdf } from "./pdf-datos";

// El ejemplo de la cotización tipo de MOT: CMOT 2026-050.
const entrada: EntradaPdf = {
  oportunidad: {
    cliente: "CONTICON",
    planta: null,
    direccion: "Parque Industrial Villagrán, Guanajuato",
  },
  cotizacion: {
    folio: "CMOT 2026-050",
    version: 1,
    estado: "enviada",
    moneda: "USD",
    vigencia: "2026-11-26",
    valor_total_contrato: null,
    litros_estimados: 3120,
    condiciones:
      "Limpieza de aceite por evento, recomendamos su repetición cada 6 meses.\n\n3.- Precio válido por 1 año.  ",
    condiciones_pago: "Contado",
    numero_requisicion: null,
    created_at: "2026-11-11T18:00:00Z",
    contactos: {
      nombre: "Juan Pérez",
      telefono_celular: null,
      telefono_oficina: "461 123 4567",
      correo: "juan@cliente.test",
    },
    lineas: [
      {
        concepto: "Limpieza por litro de aceite hidráulico",
        cantidad: 3120,
        unidad: "litro",
        precio_unitario: 10.15,
        recurrente: false,
        importe: 31668,
        numero_parte_cliente: "Limpieza por Litro",
        equipos_cliente: null,
      },
    ],
    totales: { total_unico: 31668, total_recurrente: 0 },
  },
};

const renta = {
  concepto: "Renta mensual de Robox",
  cantidad: 1,
  unidad: "mes",
  precio_unitario: 289,
  recurrente: true,
  importe: 289,
  numero_parte_cliente: null,
  equipos_cliente: { identificador: "11B116", alias: "REP4" },
};

describe("datosParaPdf", () => {
  const d = datosParaPdf(entrada);
  const valor = (
    lista: { etiqueta: string; valor: string }[],
    etiqueta: string,
  ) => lista.find((r) => r.etiqueta === etiqueta)?.valor;

  it("arma el encabezado como la cotización tipo de MOT", () => {
    expect(valor(d.encabezado, "Cotización No.")).toBe("CMOT 2026-050");
    expect(valor(d.encabezado, "Fecha")).toBe("11/11/2026");
    expect(valor(d.encabezado, "Válido hasta")).toBe("26/11/2026");
    expect(valor(d.encabezado, "Condiciones de pago")).toBe("Contado");
    expect(valor(d.encabezado, "No. Requisición")).toBe("—");
    expect(valor(d.encabezado, "Servicio")).toBe("Planta Cliente");
  });

  it("dirige la cotización al contacto elegido", () => {
    expect(valor(d.cliente, "Empresa")).toBe("CONTICON");
    expect(valor(d.cliente, "Atención")).toBe("Juan Pérez");
    expect(valor(d.cliente, "Teléfono")).toBe("461 123 4567");
    expect(valor(d.cliente, "Email")).toBe("juan@cliente.test");
  });

  it("sin contacto deja guiones, no espacios vacíos", () => {
    const sin = datosParaPdf({
      ...entrada,
      cotizacion: { ...entrada.cotizacion, contactos: null },
    });
    expect(valor(sin.cliente, "Atención")).toBe("—");
    expect(valor(sin.cliente, "Email")).toBe("—");
  });

  it("reproduce la partida del ejemplo: 3,120 L × 10.15 = 31,668.00 USD", () => {
    expect(d.partidas[0]).toEqual({
      descripcion: "Limpieza por litro de aceite hidráulico",
      detalle: null,
      numeroParte: "Limpieza por Litro",
      cantidad: "3120 litros",
      precioUnitario: "10.15 USD",
      subtotal: "31,668.00 USD",
    });
    expect(d.totales).toEqual([{ etiqueta: "TOTAL", valor: "31,668.00 USD" }]);
  });

  it("empieza las notas con IVA y moneda, y numera las del vendedor una por renglón", () => {
    expect(d.notas).toEqual([
      "Precios más IVA.",
      "Tipo de moneda USD.",
      "Limpieza de aceite por evento, recomendamos su repetición cada 6 meses.",
      "Precio válido por 1 año.",
    ]);
  });

  it("separa los totales cuando hay partidas de una vez y recurrentes", () => {
    const mixta = datosParaPdf({
      ...entrada,
      cotizacion: {
        ...entrada.cotizacion,
        lineas: [...entrada.cotizacion.lineas, renta],
        totales: { total_unico: 31668, total_recurrente: 289 },
      },
    });
    expect(mixta.totales).toEqual([
      { etiqueta: "TOTAL (una sola vez)", valor: "31,668.00 USD" },
      { etiqueta: "TOTAL recurrente (por periodo)", valor: "289.00 USD" },
    ]);
    expect(mixta.partidas[1]?.detalle).toBe(
      "Equipo 11B116 (REP4) · Recurrente",
    );
    expect(mixta.partidas[1]?.numeroParte).toBe("—");
  });

  it("una cotización solo de renta muestra el total por periodo", () => {
    const soloRenta = datosParaPdf({
      ...entrada,
      cotizacion: {
        ...entrada.cotizacion,
        lineas: [renta],
        totales: { total_unico: 0, total_recurrente: 289 },
      },
    });
    expect(soloRenta.totales).toEqual([
      { etiqueta: "TOTAL (por periodo)", valor: "289.00 USD" },
    ]);
  });

  it("las versiones posteriores lo indican junto al folio", () => {
    const v2 = datosParaPdf({
      ...entrada,
      cotizacion: { ...entrada.cotizacion, version: 2 },
    });
    expect(v2.folio).toBe("CMOT 2026-050 (versión 2)");
    expect(v2.nombreArchivo).toBe("Cotizacion-CMOT-2026-050-v2.pdf");
  });

  it("solo el borrador se marca como tal", () => {
    const estado = (e: string) =>
      datosParaPdf({
        ...entrada,
        cotizacion: { ...entrada.cotizacion, estado: e },
      }).esBorrador;
    expect(estado("borrador")).toBe(true);
    expect(estado("enviada")).toBe(false);
    expect(estado("aceptada")).toBe(false);
  });

  it("no lleva datos internos: ni notas, ni costo del contenedor, ni precio de referencia", () => {
    const conInternos = {
      ...entrada,
      cotizacion: {
        ...entrada.cotizacion,
        notas: "NOTA INTERNA: margen alto",
        lineas: entrada.cotizacion.lineas.map((l) => ({
          ...l,
          precio_referencia: 14.5,
          referencia_costo_contenedor: 2900,
          referencia_litros_contenedor: 200,
          fuente_url: "https://interno.test",
        })),
      },
    };
    const texto = JSON.stringify(datosParaPdf(conInternos));
    expect(texto).not.toContain("NOTA INTERNA");
    expect(texto).not.toContain("14.5");
    expect(texto).not.toContain("2900");
    expect(texto).not.toContain("interno.test");
  });
});

describe("nombreArchivo", () => {
  it("usa el folio, sin espacios", () => {
    expect(nombreArchivo("CMOT 2026-050", 1)).toBe(
      "Cotizacion-CMOT-2026-050.pdf",
    );
    expect(nombreArchivo("///", 1)).toBe("Cotizacion-MOT.pdf");
  });
});

describe("describirCantidad", () => {
  it("usa singular y plural correctos", () => {
    expect(describirCantidad(280, "litro")).toBe("280 litros");
    expect(describirCantidad(1, "litro")).toBe("1 litro");
    expect(describirCantidad(36, "mes")).toBe("36 meses");
    expect(describirCantidad(2, "servicio")).toBe("2 servicios");
    expect(describirCantidad(1, "evento")).toBe("1 evento");
  });
});
