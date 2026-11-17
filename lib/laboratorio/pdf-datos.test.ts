import { describe, expect, it } from "vitest";
import type { ContenidoInforme } from "./informe";
import {
  datosInformePdf,
  MAX_MUESTRAS_PDF,
  type EntradaPdfInforme,
} from "./pdf-datos";

const muestra = (n: number): ContenidoInforme["muestras"][number] => ({
  id: `m${n}`,
  idMuestra: `2601${String(n).padStart(2, "0")}-${String(n).padStart(3, "0")}`,
  tipo: n === 1 ? "virgen" : "filtrado",
  fecha: `2026-01-${String(n).padStart(2, "0")}`,
  nivel: n === 1 ? "premium" : "basico_mpc",
  notas: n === 1 ? "Aceite nuevo" : null,
  aceite: {
    condicion: n === 3 ? "critico" : "precaucion",
    noPasa: 2,
    capturados: 5,
  },
  aditivos: n === 1 ? null : { condicion: "normal", noPasa: 0, capturados: 2 },
});

const contenido = (n: number): ContenidoInforme => ({
  version: 1,
  muestras: Array.from({ length: n }, (_, i) => muestra(i + 1)),
  grupos: [
    {
      grupo: "fisicoquimico",
      titulo: "Fisicoquímicos",
      filas: [
        {
          parametroId: "ss",
          clave: "solidos_suspendidos",
          nombre: "Sólidos suspendidos",
          unidad: "ppm",
          limite: "< 0.5",
          limites: [0.5],
          desviacion: -0.927225,
          valores: Array.from({ length: n }, (_, i) =>
            i === 1
              ? null
              : {
                  texto: String(i + 1),
                  veredicto: i === 0 ? ("pasa" as const) : ("no_pasa" as const),
                },
          ),
        },
        {
          parametroId: "iso",
          clave: "codigo_iso",
          nombre: "Código de limpieza",
          unidad: null,
          limite: "18/16/13",
          limites: [],
          desviacion: null,
          valores: Array.from({ length: n }, () => ({
            texto: "18/16/13",
            veredicto: "pasa" as const,
          })),
        },
      ],
    },
  ],
  condicionGeneral: "precaucion",
});

const entrada = (
  n: number,
  extra: Partial<EntradaPdfInforme["informe"]> = {},
): EntradaPdfInforme => ({
  informe: {
    folio: "FOLAB 26/092",
    estado: "validado",
    fecha_emision: "2026-07-15",
    observaciones: "  El aceite mejora.  ",
    recomienda_cambio_filtro: false,
    cliente: "Rassini",
    planta: "BYPASA",
    direccion: null,
    elaboro: "Laura Laboratorio",
    valido: "Diana Dirección",
    validado_el: "2026-07-16",
    ...extra,
  },
  equipo: {
    identificador: "11B113",
    alias: null,
    aplicacion: null,
    aceite: "Mobil DTE 25",
    volumen_reservorio_l: null,
  },
  idCaso: "RAS1-01",
  contenido: contenido(n),
});

describe("datosInformePdf", () => {
  const d = datosInformePdf(entrada(3));

  it("encabezado con folio, fecha y condición general", () => {
    expect(d.folio).toBe("FOLAB 26/092");
    expect(d.nombreArchivo).toBe("Informe_FOLAB_26_092.pdf");
    expect(d.fechaEmision).toBe("15/07/2026");
    expect(d.condicionGeneral).toBe("Precaución");
    expect(d.sinValidar).toBe(false);
  });

  it("los tres bloques del informe de MOT; lo que falta dice No disponible", () => {
    expect(d.cliente).toEqual([
      { etiqueta: "ID de caso", valor: "RAS1-01" },
      { etiqueta: "Compañía", valor: "Rassini BYPASA" },
      { etiqueta: "Dirección", valor: "No disponible" },
    ]);
    expect(d.ultimaMuestra).toEqual([
      { etiqueta: "ID de muestra", valor: "260103-003" },
      { etiqueta: "Tipo de servicio", valor: "Básico + MPC" },
      { etiqueta: "Fecha de muestreo", valor: "03/01/2026" },
    ]);
    expect(d.equipo.map((r) => r.valor)).toEqual([
      "11B113",
      "No disponible",
      "Mobil DTE 25",
      "No disponible",
    ]);
  });

  it("una columna por muestra con sus datos y condiciones", () => {
    expect(d.columnas).toEqual(["260101-001", "260102-002", "260103-003"]);
    const fila = (t: string) =>
      d.encabezado.find((f) => f.titulo === t)?.celdas.map((c) => c.texto);
    expect(fila("Tipo de muestra")).toEqual([
      "Virgen (línea base)",
      "Filtrado",
      "Filtrado",
    ]);
    expect(fila("Anotaciones")).toEqual(["Aceite nuevo", "—", "—"]);
    expect(fila("Condición del aceite")).toEqual([
      "Precaución",
      "Precaución",
      "Crítico",
    ]);
    expect(fila("Condición de aditivos")).toEqual(["—", "Normal", "Normal"]);
  });

  it("marca lo que no pasa y escribe límite y desviación", () => {
    const ss = d.grupos[0]?.filas[0];
    expect(ss?.celdas).toEqual([
      { texto: "1", noPasa: false },
      { texto: "—", noPasa: false },
      { texto: "3", noPasa: true },
    ]);
    expect(ss).toMatchObject({
      unidad: "ppm",
      limite: "< 0.5",
      desviacion: "-92.7 %",
    });
    expect(d.grupos[0]?.filas[1]).toMatchObject({
      unidad: "",
      desviacion: "—",
    });
  });

  it("gráficas de los parámetros numéricos, con la misma geometría que la pantalla", () => {
    expect(d.graficas).toHaveLength(1);
    const g = d.graficas[0]?.series[0];
    expect(g).toMatchObject({
      nombre: "Sólidos suspendidos",
      ultimo: "3",
      ejeMin: "0",
      ejeMax: "5",
    });
    expect(g?.trazo.puntos).toHaveLength(2);
    expect(g?.trazo.limites).toHaveLength(1);
    expect(d.ejeFechas).toEqual(["01/01/26", "03/01/26"]);
  });

  it("escribe Delta en lugar de la letra griega, que la fuente del PDF no trae", () => {
    const e = entrada(3);
    const fila = e.contenido.grupos[0]?.filas[0];
    if (fila) fila.unidad = "ΔE";
    const r = datosInformePdf(e);
    expect(r.grupos[0]?.filas[0]?.unidad).toBe("Delta E");
    expect(r.graficas[0]?.series[0]?.unidad).toBe("Delta E");
  });

  it("observaciones y firmas", () => {
    expect(d.observaciones).toBe("El aceite mejora.");
    expect(d.elaboro).toBe("Laura Laboratorio");
    expect(d.valido).toBe("Diana Dirección · 16/07/2026");
    expect(d.recomendacion).toBeNull();
    expect(
      datosInformePdf(entrada(3, { recomienda_cambio_filtro: true }))
        .recomendacion,
    ).toBe("Se recomienda cambiar el filtro del RecondOil Box.");
  });

  it("un borrador lo advierte y no lleva quién validó", () => {
    const b = datosInformePdf(
      entrada(3, { estado: "borrador", observaciones: " " }),
    );
    expect(b.sinValidar).toBe(true);
    expect(b.valido).toBe("Sin validar");
    expect(b.observaciones).toBeNull();
  });

  it("si hay más muestras de las que caben, imprime las más recientes y lo dice", () => {
    const g = datosInformePdf(entrada(MAX_MUESTRAS_PDF + 2));
    expect(g.columnas).toHaveLength(MAX_MUESTRAS_PDF);
    expect(g.columnas[0]).toBe("260103-003");
    expect(g.grupos[0]?.filas[0]?.celdas).toHaveLength(MAX_MUESTRAS_PDF);
    expect(g.avisoMuestras).toBe(
      "El informe tiene 10 muestras; se imprimen las 8 más recientes.",
    );
    expect(d.avisoMuestras).toBeNull();
  });
});
