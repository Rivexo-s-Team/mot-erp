import { describe, expect, it } from "vitest";
import { capturaVacia } from "./captura";
import { datosOrdenPdf, type EntradaPdfOrden } from "./pdf-datos";

const MUESTRAS = "11111111-1111-4111-8111-111111111111";
const ROTACION = "22222222-2222-4222-8222-222222222222";
const LIMPIEZA = "33333333-3333-4333-8333-333333333333";
const FUGA = "44444444-4444-4444-8444-444444444444";

/** La orden del formato en papel del 2 nov 2026 (Rassini, 11B116). */
function rassini(): EntradaPdfOrden {
  const captura = capturaVacia();
  captura.id_caso = "RAS1-08";
  captura.temperatura_aceite_c = "22.3";
  captura.volumen_reservorio_l = "280";
  Object.assign(captura.lecturas.inicial, {
    modelo: "L15",
    numero_serie: "545592",
    programa: "6.5",
    presion_filtro: "3.5 / HY",
    filter_used_dias: "74",
    filter_lifetime_dias: "365",
    runtime_dias: "74",
    ack_flow_l: "138.278",
    presion_bar: "3.51",
    flujo_l_min: "0.683",
    temperatura_c: "20.8",
  });
  captura.actividades = { [MUESTRAS]: "1", [ROTACION]: "" };
  const trazos = [
    [10, 20, 30, 40],
    [50, 60],
  ];
  captura.firmas.tecnico = {
    nombre: "Daniel Vargas Reséndiz",
    cargo: "Servicio",
    fecha: "2026-11-02",
    trazos,
  };
  captura.firmas.cliente = {
    nombre: "Jair Ocampo Franco",
    cargo: "Mantenimiento",
    fecha: "2026-11-02",
    trazos,
  };
  return {
    orden: {
      folio: "261102 DV",
      tipo: "visita",
      estado: "cerrada",
      fecha_programada: "2026-11-02",
      fecha_real: "2026-11-02",
      cliente: "Rassini",
      planta: "BYPASA",
      direccion: "Oriente 6, Nuevo San Juan, San Juan del Río, Querétaro",
      robox: "545592",
      tecnico: "Daniel Vargas Reséndiz",
      acompanante: null,
    },
    equipo: {
      identificador: "11B116",
      alias: "REP4",
      aplicacion: "Prensa vulcanizadora",
      aceite: "Mobil DTE 25",
    },
    captura,
    actividades: [
      { id: MUESTRAS, nombre: "Toma de muestras" },
      { id: ROTACION, nombre: "Rotación o movilización" },
      { id: LIMPIEZA, nombre: "Limpieza" },
    ],
    fallas: [{ id: FUGA, nombre: "Fuga de aceite" }],
  };
}

const valor = (renglones: { etiqueta: string; valor: string }[], e: string) =>
  renglones.find((r) => r.etiqueta === e)?.valor;

describe("PDF de la orden de servicio", () => {
  it("reproduce el encabezado del formato de Rassini", () => {
    const d = datosOrdenPdf(rassini());
    expect(d.folio).toBe("261102 DV");
    expect(d.tipo).toBe("Visita de servicio");
    expect(d.sinCerrar).toBe(false);
    expect(valor(d.cliente, "Cliente")).toBe("Rassini");
    expect(valor(d.cliente, "Planta")).toBe("BYPASA");
    expect(valor(d.servicio, "Fecha")).toBe("02/11/2026");
    expect(valor(d.servicio, "Robox")).toBe("545592");
    expect(valor(d.equipo, "ID de caso")).toBe("RAS1-08");
    expect(valor(d.equipo, "Equipo")).toBe("11B116 (REP4)");
    expect(valor(d.equipo, "Aceite")).toBe("Mobil DTE 25");
    expect(valor(d.equipo, "Reservorio")).toBe("280 litros");
    expect(valor(d.equipo, "Temperatura")).toBe("22.3 °C");
  });

  it("lista todo el catálogo y marca lo que se hizo, con su cantidad", () => {
    const d = datosOrdenPdf(rassini());
    expect(d.actividades).toEqual([
      { nombre: "Toma de muestras (1)", marcada: true },
      { nombre: "Rotación o movilización", marcada: true },
      { nombre: "Limpieza", marcada: false },
    ]);
    expect(d.fallas).toEqual([{ nombre: "Fuga de aceite", marcada: false }]);
  });

  it("pone las lecturas tal como se capturaron y raya lo vacío", () => {
    const d = datosOrdenPdf(rassini());
    expect(d.lecturas).toHaveLength(11);
    const fila = (p: string) => d.lecturas.find((l) => l.parametro === p);
    expect(fila("Ack. flow (litros)")).toMatchObject({
      inicial: "138.278",
      posterior: "—",
    });
    expect(fila("Flujo (L/min)")?.inicial).toBe("0.683");
    expect(fila("Presión / Filtro")?.inicial).toBe("3.5 / HY");
  });

  it("lleva las dos firmas con nombre, cargo, fecha y trazos", () => {
    const d = datosOrdenPdf(rassini());
    expect(d.firmas).toHaveLength(2);
    expect(d.firmas[1]).toMatchObject({
      firmada: true,
      nombre: "Jair Ocampo Franco",
      cargo: "Mantenimiento",
      fecha: "02/11/2026",
      trazos: ["10,20 30,40", "50,60 50,60"],
    });
  });

  it("no incluye las notas internas de la orden, solo las de la visita", () => {
    const e = rassini();
    e.captura.observaciones = "Se dejó el Robox en el 11B113.";
    const d = datosOrdenPdf(e);
    expect(d.notas).toBe("Se dejó el Robox en el 11B113.");
    expect(JSON.stringify(d)).not.toContain("notas internas");
    expect(Object.keys(e.orden)).not.toContain("notas");
  });

  it("una orden sin cerrar lo advierte y no imprime firmas a medias", () => {
    const e = rassini();
    e.orden.estado = "en_curso";
    e.orden.fecha_real = null;
    e.captura.firmas.cliente = {
      nombre: "Jair Ocampo Franco",
      cargo: "Mantenimiento",
      fecha: "",
      trazos: [],
    };
    const d = datosOrdenPdf(e);
    expect(d.sinCerrar).toBe(true);
    expect(d.firmas[1]).toMatchObject({
      firmada: false,
      nombre: "",
      trazos: [],
    });
  });

  it("una orden de taller no lleva cliente ni firma del cliente", () => {
    const e = rassini();
    e.orden.tipo = "taller";
    e.orden.cliente = null;
    e.orden.planta = null;
    e.equipo = null;
    const d = datosOrdenPdf(e);
    expect(d.tipo).toBe("Taller");
    expect(d.cliente).toEqual([{ etiqueta: "Lugar", valor: "Taller de MOT" }]);
    expect(d.firmas).toHaveLength(1);
    expect(valor(d.equipo, "Equipo")).toBe("—");
  });

  it("arma un nombre de archivo sin espacios", () => {
    expect(datosOrdenPdf(rassini()).nombreArchivo).toBe("Orden-261102-DV.pdf");
    const e = rassini();
    e.orden.folio = "261102 DV 2";
    expect(datosOrdenPdf(e).nombreArchivo).toBe("Orden-261102-DV-2.pdf");
  });
});
