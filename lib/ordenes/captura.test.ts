import { describe, expect, it } from "vitest";
import {
  aCargaUtil,
  CAMPOS_LECTURA,
  capturaInicial,
  capturaVacia,
  leerBorrador,
  problemaCaptura,
  resumenCaptura,
  type Captura,
} from "./captura";

const MUESTRAS = "11111111-1111-4111-8111-111111111111";
const ROTACION = "22222222-2222-4222-8222-222222222222";
const FUGA = "33333333-3333-4333-8333-333333333333";

/** El formato en papel del 2 nov 2026 (Rassini, 11B116). */
function rassini(): Captura {
  const c = capturaVacia();
  c.id_caso = "RAS1-08";
  c.temperatura_aceite_c = "22.3";
  c.volumen_reservorio_l = "280";
  Object.assign(c.lecturas.inicial, {
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
  c.actividades = { [MUESTRAS]: "1", [ROTACION]: "" };
  return c;
}

describe("captura de la visita", () => {
  it("la lectura tiene los 11 renglones del formato", () => {
    expect(CAMPOS_LECTURA).toHaveLength(11);
    expect(Object.keys(capturaVacia().lecturas.inicial)).toHaveLength(11);
  });

  it("una captura vacía es válida: todo es opcional", () => {
    expect(problemaCaptura(capturaVacia())).toBeNull();
  });

  it("acepta el formato real de Rassini", () => {
    expect(problemaCaptura(rassini())).toBeNull();
  });

  it("señala dónde está el error", () => {
    const c = rassini();
    c.lecturas.inicial.presion_bar = "3,51";
    expect(problemaCaptura(c)?.ruta).toBe("lecturas.inicial.presion_bar");
    const d = rassini();
    d.lecturas.posterior.runtime_dias = "7.5";
    expect(problemaCaptura(d)?.ruta).toBe("lecturas.posterior.runtime_dias");
  });

  it("no acepta reservorio en cero ni cantidades en cero", () => {
    const c = rassini();
    c.volumen_reservorio_l = "0";
    expect(problemaCaptura(c)?.ruta).toBe("volumen_reservorio_l");
    const d = rassini();
    d.actividades[MUESTRAS] = "0";
    expect(problemaCaptura(d)?.ruta).toBe(`actividades.${MUESTRAS}`);
  });

  it("no acepta ids que no sean de catálogo", () => {
    const c = rassini();
    c.fallas = ["no-es-id"];
    expect(problemaCaptura(c)).not.toBeNull();
  });

  it("arma lo que se envía a la base sin tocar los números", () => {
    const c = rassini();
    c.id_caso = "  RAS1-08 ";
    c.fallas = [FUGA, FUGA];
    const carga = aCargaUtil(c);
    expect(carga.id_caso).toBe("RAS1-08");
    expect(carga.lecturas.inicial.ack_flow_l).toBe("138.278");
    expect(carga.lecturas.inicial.flujo_l_min).toBe("0.683");
    expect(carga.actividades).toEqual([
      { id: MUESTRAS, cantidad: "1" },
      { id: ROTACION, cantidad: "" },
    ]);
    expect(carga.fallas).toEqual([FUGA]);
  });

  it("resume cuánto lleva capturado", () => {
    expect(resumenCaptura(rassini())).toEqual({
      inicial: true,
      posterior: false,
      actividades: 2,
      fallas: 0,
    });
  });
});

describe("borrador en el teléfono", () => {
  const guardado = "2026-11-12T18:00:00.000Z";

  it("ignora texto vacío, dañado o con otra forma", () => {
    expect(leerBorrador(null)).toBeNull();
    expect(leerBorrador("{no es json")).toBeNull();
    expect(leerBorrador(JSON.stringify({ captura: {} }))).toBeNull();
  });

  it("lee un borrador guardado tal cual", () => {
    const b = { captura: rassini(), pendiente: true, guardado };
    expect(leerBorrador(JSON.stringify(b))).toEqual(b);
  });

  it("completa lo que le falte a un borrador viejo", () => {
    const b = leerBorrador(
      JSON.stringify({
        captura: { id_caso: "X", lecturas: { inicial: { modelo: "L15" } } },
        pendiente: true,
        guardado,
      }),
    );
    expect(b?.captura.lecturas.inicial.modelo).toBe("L15");
    expect(b?.captura.lecturas.posterior.presion_bar).toBe("");
    expect(b?.captura.fallas).toEqual([]);
    expect(problemaCaptura(b!.captura)).toBeNull();
  });

  it("si hay cambios sin enviar en el teléfono, mandan esos", () => {
    const local = rassini();
    local.observaciones = "Capturado sin señal";
    const r = capturaInicial(capturaVacia(), {
      captura: local,
      pendiente: true,
      guardado,
    });
    expect(r.pendiente).toBe(true);
    expect(r.captura.observaciones).toBe("Capturado sin señal");
  });

  it("si el borrador ya se envió, manda lo que hay en el sistema", () => {
    const sistema = rassini();
    const r = capturaInicial(sistema, {
      captura: capturaVacia(),
      pendiente: false,
      guardado,
    });
    expect(r).toEqual({ captura: sistema, pendiente: false });
    expect(capturaInicial(sistema, null).captura).toBe(sistema);
  });
});
