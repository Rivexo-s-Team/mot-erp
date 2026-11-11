import { describe, expect, it } from "vitest";
import { describirCantidad } from "./campos";
import { datosParaPdf, nombreArchivo, type EntradaPdf } from "./pdf-datos";

const entrada: EntradaPdf = {
  oportunidad: {
    nombre: "Ampliación: segundo Robox",
    cliente: "Rassini",
    planta: "BYPASA",
  },
  cotizacion: {
    version: 2,
    estado: "enviada",
    moneda: "USD",
    vigencia: "2026-12-31",
    valor_total_contrato: 54000,
    litros_estimados: null,
    condiciones: "  Pago a 30 días.  ",
    created_at: "2026-11-10T18:00:00Z",
    lineas: [
      {
        concepto: "Limpieza de aceite por litro",
        cantidad: 280,
        unidad: "litro",
        precio_unitario: 3.64,
        recurrente: false,
        importe: 1019.2,
        equipos_cliente: { identificador: "11B116", alias: "REP4" },
      },
      {
        concepto: "Renta mensual de Robox",
        cantidad: 1,
        unidad: "mes",
        precio_unitario: 1500,
        recurrente: true,
        importe: 1500,
        equipos_cliente: null,
      },
    ],
    totales: { total_unico: 1019.2, total_recurrente: 1500 },
  },
};

describe("datosParaPdf", () => {
  const d = datosParaPdf(entrada);

  it("arma encabezado, fechas y cliente", () => {
    expect(d.titulo).toBe("Cotización · versión 2");
    expect(d.cliente).toBe("Rassini");
    expect(d.planta).toBe("BYPASA");
    expect(d.fecha).toBe("10/11/2026");
    expect(d.vigencia).toBe("31/12/2026");
    expect(d.esBorrador).toBe(false);
  });

  it("formatea las partidas con cantidad, precio e importe", () => {
    expect(d.partidas[0]).toEqual({
      concepto: "Limpieza de aceite por litro",
      equipo: "11B116 (REP4)",
      cantidad: "280 litros",
      precioUnitario: "3.64 USD",
      importe: "1,019.20 USD",
      tipo: "Una sola vez",
    });
    expect(d.partidas[1]?.cantidad).toBe("1 mes");
    expect(d.partidas[1]?.tipo).toBe("Recurrente");
  });

  it("separa el total de una sola vez del recurrente", () => {
    expect(d.totales).toEqual([
      { etiqueta: "Total (una sola vez)", valor: "1,019.20 USD" },
      { etiqueta: "Total recurrente (por periodo)", valor: "1,500.00 USD" },
    ]);
  });

  it("solo muestra el total que aplica", () => {
    const soloRenta = datosParaPdf({
      ...entrada,
      cotizacion: {
        ...entrada.cotizacion,
        lineas: [entrada.cotizacion.lineas[1]!],
      },
    });
    expect(soloRenta.totales.map((t) => t.etiqueta)).toEqual([
      "Total recurrente (por periodo)",
    ]);
  });

  it("incluye el valor total del contrato y las condiciones, ya limpias", () => {
    expect(d.datosAdicionales).toEqual([
      { etiqueta: "Valor total del contrato", valor: "54,000.00 USD" },
    ]);
    expect(d.condiciones).toBe("Pago a 30 días.");
  });

  it("marca como borrador lo que no se ha enviado", () => {
    const borrador = datosParaPdf({
      ...entrada,
      cotizacion: { ...entrada.cotizacion, estado: "borrador" },
    });
    expect(borrador.esBorrador).toBe(true);
  });

  it("no lleva datos internos: ni notas ni precio de referencia", () => {
    const conInternos = {
      ...entrada,
      cotizacion: {
        ...entrada.cotizacion,
        notas: "NOTA INTERNA: margen alto",
        lineas: entrada.cotizacion.lineas.map((l) => ({
          ...l,
          precio_referencia: 5.2,
          fuente_url: "https://interno.test",
        })),
      },
    };
    const texto = JSON.stringify(datosParaPdf(conInternos));
    expect(texto).not.toContain("NOTA INTERNA");
    expect(texto).not.toContain("5.2");
    expect(texto).not.toContain("interno.test");
  });
});

describe("nombreArchivo", () => {
  it("quita acentos y caracteres raros", () => {
    expect(nombreArchivo("Rassini", 1)).toBe("Cotizacion-Rassini-v1.pdf");
    expect(nombreArchivo("Química del Bajío, S.A. de C.V.", 3)).toBe(
      "Cotizacion-Quimica-del-Bajio-S-A-de-C-V-v3.pdf",
    );
    expect(nombreArchivo("///", 1)).toBe("Cotizacion-MOT-v1.pdf");
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
