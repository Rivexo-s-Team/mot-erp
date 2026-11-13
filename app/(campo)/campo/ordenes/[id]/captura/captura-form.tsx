"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { FirmaPad } from "@/components/firma-pad";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  CAMPOS_LECTURA,
  capturaInicial,
  claveBorrador,
  leerBorrador,
  problemaCaptura,
  type Borrador,
  type Captura,
  type Momento,
  type RolFirma,
} from "@/lib/ordenes/captura";
import { guardarCaptura } from "@/app/(app)/ordenes/actions";

type Props = {
  ordenId: string;
  /** Lo que ya está guardado en el sistema (o la propuesta inicial). */
  delSistema: Captura;
  actividades: { id: string; nombre: string; llevaCantidad: boolean }[];
  fallas: { id: string; nombre: string }[];
  partes: { id: string; nombre: string; tipo: string }[];
  /** En una visita firma también el responsable del cliente. */
  esVisita: boolean;
  /** Hoy en México (aaaa-mm-dd): la fecha que se anota al firmar. */
  hoy: string;
  volverHref: string;
};

/** Dónde está lo capturado en este momento. */
type Estado =
  | { tipo: "sistema" }
  | { tipo: "telefono" }
  | { tipo: "enviando" }
  | { tipo: "sin_senal" }
  | { tipo: "error"; mensaje: string };

const TEXTO_ESTADO: Record<Exclude<Estado["tipo"], "error">, string> = {
  sistema: "Guardado en el sistema.",
  telefono: "Guardado en este teléfono. Enviando…",
  enviando: "Enviando al sistema…",
  sin_senal: "Sin señal. Está guardado en este teléfono y se enviará solo.",
};

const sinSuscripcion = () => () => {};

/**
 * Captura de la visita en el celular. Cada cambio se guarda al momento en el
 * teléfono y se envía al sistema unos segundos después; si no hay señal, se
 * reintenta solo al recuperarla.
 */
export function CapturaForm(props: Props) {
  // Next conserva el estado de las páginas visitadas: se reinicia en cada entrada.
  const { bfcacheId } = useRouter();
  // El borrador vive en el teléfono: el formulario se pinta ya en el navegador.
  const enNavegador = useSyncExternalStore(
    sinSuscripcion,
    () => true,
    () => false,
  );
  if (!enNavegador) return null;
  return <Formulario key={bfcacheId} {...props} />;
}

function leerLocal(ordenId: string): Borrador | null {
  try {
    return leerBorrador(window.localStorage.getItem(claveBorrador(ordenId)));
  } catch {
    return null;
  }
}

function escribirLocal(ordenId: string, captura: Captura, pendiente: boolean) {
  try {
    const borrador: Borrador = {
      captura,
      pendiente,
      guardado: new Date().toISOString(),
    };
    window.localStorage.setItem(
      claveBorrador(ordenId),
      JSON.stringify(borrador),
    );
  } catch {
    // Sin almacenamiento (modo privado): la captura sigue en pantalla.
  }
}

function Formulario({
  ordenId,
  delSistema,
  actividades,
  fallas,
  partes,
  esVisita,
  hoy,
  volverHref,
}: Props) {
  const uid = useId();
  const [inicio] = useState(() =>
    capturaInicial(delSistema, leerLocal(ordenId)),
  );
  const [captura, setCaptura] = useState<Captura>(inicio.captura);
  // Parte elegida en la lista para agregarla a la orden.
  const [porAgregar, setPorAgregar] = useState("");
  const [estado, setEstado] = useState<Estado>(
    inicio.pendiente ? { tipo: "telefono" } : { tipo: "sistema" },
  );
  // Cuenta los cambios, para saber si lo enviado sigue siendo lo último.
  const version = useRef(0);
  const ultima = useRef(inicio.captura);
  const enviando = useRef(false);

  const enviar = useCallback(async () => {
    if (enviando.current) return;
    const problema = problemaCaptura(ultima.current);
    if (problema) {
      setEstado({
        tipo: "error",
        mensaje: `${problema.mensaje} Corrígelo para poder enviarlo.`,
      });
      return;
    }
    enviando.current = true;
    const enviada = version.current;
    const datos = ultima.current;
    setEstado({ tipo: "enviando" });
    try {
      const r = await guardarCaptura(ordenId, datos);
      if (!r.ok) {
        setEstado({ tipo: "error", mensaje: r.error });
      } else if (enviada === version.current) {
        escribirLocal(ordenId, datos, false);
        setEstado({ tipo: "sistema" });
      } else {
        // Hubo cambios mientras se enviaba: sigue pendiente.
        setEstado({ tipo: "telefono" });
      }
    } catch {
      setEstado({ tipo: "sin_senal" });
    } finally {
      enviando.current = false;
    }
  }, [ordenId]);

  const cambiar = (siguiente: Captura) => {
    version.current += 1;
    ultima.current = siguiente;
    setCaptura(siguiente);
    escribirLocal(ordenId, siguiente, true);
    setEstado({ tipo: "telefono" });
  };

  // Envío automático: unos segundos después del último cambio, al volver la
  // señal (o cada 15 segundos sin ella) y al abrir la pantalla con algo pendiente.
  useEffect(() => {
    if (estado.tipo !== "telefono" && estado.tipo !== "sin_senal") return;
    // Sin señal se reintenta cada 15 segundos, además de al volver la conexión.
    const espera = estado.tipo === "telefono" ? 2500 : 15000;
    const t = window.setTimeout(() => void enviar(), espera);
    return () => window.clearTimeout(t);
  }, [estado, captura, enviar]);

  useEffect(() => {
    const alVolverSenal = () => {
      if (leerLocal(ordenId)?.pendiente) void enviar();
    };
    window.addEventListener("online", alVolverSenal);
    return () => window.removeEventListener("online", alVolverSenal);
  }, [ordenId, enviar]);

  const ponerLectura = (momento: Momento, nombre: string, valor: string) =>
    cambiar({
      ...captura,
      lecturas: {
        ...captura.lecturas,
        [momento]: { ...captura.lecturas[momento], [nombre]: valor },
      },
    });

  const marcarActividad = (id: string, marcada: boolean) => {
    const siguientes = { ...captura.actividades };
    if (marcada) siguientes[id] = "";
    else delete siguientes[id];
    cambiar({ ...captura, actividades: siguientes });
  };

  const marcarFalla = (id: string, marcada: boolean) =>
    cambiar({
      ...captura,
      fallas: marcada
        ? [...captura.fallas, id]
        : captura.fallas.filter((f) => f !== id),
    });

  const ponerFirma = (
    rol: RolFirma,
    cambios: Partial<Captura["firmas"][RolFirma]>,
  ) =>
    cambiar({
      ...captura,
      firmas: {
        ...captura.firmas,
        [rol]: { ...captura.firmas[rol], ...cambios },
      },
    });

  const firma = (rol: RolFirma, titulo: string, ayuda: string) => {
    const f = captura.firmas[rol];
    const errorNombre = error(`firmas.${rol}.nombre`);
    return (
      <Card>
        <CardHeader>
          <CardTitle>{titulo}</CardTitle>
          <p className="text-sm text-muted-foreground">{ayuda}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label
              htmlFor={id(`firma-${rol}-nombre`)}
              className="mb-1 block text-sm font-medium"
            >
              Nombre
            </label>
            <Input
              id={id(`firma-${rol}-nombre`)}
              name={`firmas.${rol}.nombre`}
              className="h-12 text-base"
              autoComplete="off"
              value={f.nombre}
              aria-invalid={Boolean(errorNombre)}
              onChange={(e) => ponerFirma(rol, { nombre: e.target.value })}
            />
            {errorNombre ? (
              <p className="mt-1 text-sm text-destructive">{errorNombre}</p>
            ) : null}
          </div>
          <div>
            <label
              htmlFor={id(`firma-${rol}-cargo`)}
              className="mb-1 block text-sm font-medium"
            >
              Cargo
            </label>
            <Input
              id={id(`firma-${rol}-cargo`)}
              name={`firmas.${rol}.cargo`}
              className="h-12 text-base"
              autoComplete="off"
              value={f.cargo}
              onChange={(e) => ponerFirma(rol, { cargo: e.target.value })}
            />
          </div>
          <FirmaPad
            etiqueta={titulo}
            trazos={f.trazos}
            onChange={(trazos) =>
              // La fecha de la firma es el día en que se dibuja.
              ponerFirma(rol, {
                trazos,
                fecha: trazos.length === 0 ? "" : f.fecha || hoy,
              })
            }
          />
        </CardContent>
      </Card>
    );
  };

  const problema = problemaCaptura(captura);
  const error = (ruta: string) =>
    problema?.ruta === ruta ? problema.mensaje : null;
  const id = (nombre: string) => `${uid}-${nombre}`;

  const lectura = (momento: Momento, titulo: string, ayuda: string) => (
    <Card>
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
        <p className="text-sm text-muted-foreground">{ayuda}</p>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-x-3 gap-y-4">
        {CAMPOS_LECTURA.map((c) => {
          const ruta = `lecturas.${momento}.${c.name}`;
          const mensaje = error(ruta);
          return (
            <div
              key={c.name}
              className={c.tipo === "texto" ? "col-span-2 sm:col-span-1" : ""}
            >
              <label
                htmlFor={id(ruta)}
                className="mb-1 block text-sm font-medium"
              >
                {c.label}
                {c.unidad ? (
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    ({c.unidad})
                  </span>
                ) : null}
              </label>
              <Input
                id={id(ruta)}
                name={ruta}
                className="h-12 text-base"
                autoComplete="off"
                inputMode={
                  c.tipo === "numero"
                    ? "decimal"
                    : c.tipo === "entero"
                      ? "numeric"
                      : "text"
                }
                value={captura.lecturas[momento][c.name] ?? ""}
                aria-invalid={Boolean(mensaje)}
                onChange={(e) => ponerLectura(momento, c.name, e.target.value)}
              />
              {mensaje ? (
                <p className="mt-1 text-sm text-destructive">{mensaje}</p>
              ) : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );

  const casilla =
    "flex min-h-12 items-center gap-3 rounded-lg border bg-background px-3 py-2 text-base has-checked:border-primary has-checked:bg-accent/60";

  return (
    <form
      className="space-y-4 pb-28"
      onSubmit={(e) => {
        e.preventDefault();
        void enviar();
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Datos del equipo</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-3 gap-y-4">
          <div className="col-span-2">
            <label
              htmlFor={id("id_caso")}
              className="mb-1 block text-sm font-medium"
            >
              ID de caso
            </label>
            <Input
              id={id("id_caso")}
              name="id_caso"
              className="h-12 text-base"
              autoComplete="off"
              value={captura.id_caso}
              aria-invalid={Boolean(error("id_caso"))}
              onChange={(e) => cambiar({ ...captura, id_caso: e.target.value })}
            />
          </div>
          {(
            [
              ["volumen_reservorio_l", "Reservorio", "litros"],
              ["temperatura_aceite_c", "Temperatura del aceite", "°C"],
            ] as const
          ).map(([nombre, etiqueta, unidad]) => (
            <div key={nombre}>
              <label
                htmlFor={id(nombre)}
                className="mb-1 block text-sm font-medium"
              >
                {etiqueta}
                <span className="font-normal text-muted-foreground">
                  {" "}
                  ({unidad})
                </span>
              </label>
              <Input
                id={id(nombre)}
                name={nombre}
                className="h-12 text-base"
                autoComplete="off"
                inputMode="decimal"
                value={captura[nombre]}
                aria-invalid={Boolean(error(nombre))}
                onChange={(e) =>
                  cambiar({ ...captura, [nombre]: e.target.value })
                }
              />
              {error(nombre) ? (
                <p className="mt-1 text-sm text-destructive">{error(nombre)}</p>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>

      {lectura(
        "inicial",
        "Lectura inicial",
        "Lo que muestra la pantalla del Robox al llegar.",
      )}

      <Card>
        <CardHeader>
          <CardTitle>Servicio realizado</CardTitle>
          <p className="text-sm text-muted-foreground">
            Marca todo lo que se hizo en la visita.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {actividades.map((a) => {
            const marcada = a.id in captura.actividades;
            const ruta = `actividades.${a.id}`;
            return (
              <div key={a.id}>
                <label className={casilla}>
                  <input
                    type="checkbox"
                    name={`actividad-${a.id}`}
                    className="size-5 accent-primary"
                    checked={marcada}
                    onChange={(e) => marcarActividad(a.id, e.target.checked)}
                  />
                  <span className="flex-1">{a.nombre}</span>
                  {marcada && a.llevaCantidad ? (
                    <Input
                      name={`cantidad-${a.id}`}
                      aria-label={`Cantidad de ${a.nombre}`}
                      placeholder="Cant."
                      className="h-10 w-20 text-base"
                      autoComplete="off"
                      inputMode="numeric"
                      value={captura.actividades[a.id] ?? ""}
                      aria-invalid={Boolean(error(ruta))}
                      onChange={(e) =>
                        cambiar({
                          ...captura,
                          actividades: {
                            ...captura.actividades,
                            [a.id]: e.target.value,
                          },
                        })
                      }
                    />
                  ) : null}
                </label>
                {error(ruta) ? (
                  <p className="mt-1 text-sm text-destructive">{error(ruta)}</p>
                ) : null}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fallas o problemas</CardTitle>
          <p className="text-sm text-muted-foreground">
            Déjalo sin marcar si no hubo ninguna.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {fallas.map((f) => (
            <label key={f.id} className={casilla}>
              <input
                type="checkbox"
                name={`falla-${f.id}`}
                className="size-5 accent-primary"
                checked={captura.fallas.includes(f.id)}
                onChange={(e) => marcarFalla(f.id, e.target.checked)}
              />
              <span className="flex-1">{f.nombre}</span>
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Partes y accesorios</CardTitle>
          <p className="text-sm text-muted-foreground">
            Lo que se cambió o se instaló. Sale del inventario al cerrar la
            orden.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {partes
            .filter((p) => p.id in captura.partes)
            .map((p) => {
              const ruta = `partes.${p.id}`;
              return (
                <div key={p.id}>
                  <div className="flex items-center gap-2">
                    <span className="flex-1 text-base">{p.nombre}</span>
                    <Input
                      name={`parte-${p.id}`}
                      aria-label={`Cantidad de ${p.nombre}`}
                      className="h-11 w-20 text-base"
                      autoComplete="off"
                      inputMode="decimal"
                      value={captura.partes[p.id] ?? ""}
                      aria-invalid={Boolean(error(ruta))}
                      onChange={(e) =>
                        cambiar({
                          ...captura,
                          partes: { ...captura.partes, [p.id]: e.target.value },
                        })
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Quitar ${p.nombre}`}
                      onClick={() => {
                        const siguientes = { ...captura.partes };
                        delete siguientes[p.id];
                        cambiar({ ...captura, partes: siguientes });
                      }}
                    >
                      Quitar
                    </Button>
                  </div>
                  {error(ruta) ? (
                    <p className="mt-1 text-sm text-destructive">
                      {error(ruta)}
                    </p>
                  ) : null}
                </div>
              );
            })}
          <div className="flex gap-2">
            <select
              name="parte_por_agregar"
              aria-label="Parte o accesorio por agregar"
              className="h-11 min-w-0 flex-1 rounded-lg border border-input bg-background px-2 text-base"
              value={porAgregar}
              onChange={(e) => setPorAgregar(e.target.value)}
            >
              <option value="">Elige una parte o accesorio…</option>
              {(["parte", "accesorio"] as const).map((tipo) => (
                <optgroup
                  key={tipo}
                  label={tipo === "parte" ? "Partes" : "Accesorios"}
                >
                  {partes
                    .filter((p) => p.tipo === tipo && !(p.id in captura.partes))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              disabled={!porAgregar}
              onClick={() => {
                cambiar({
                  ...captura,
                  partes: { ...captura.partes, [porAgregar]: "1" },
                });
                setPorAgregar("");
              }}
            >
              Agregar
            </Button>
          </div>
        </CardContent>
      </Card>

      {lectura(
        "posterior",
        "Lectura posterior",
        "Lo que muestra la pantalla al terminar. Déjala vacía si no cambió nada.",
      )}

      <Card>
        <CardHeader>
          <CardTitle>Otros / Notas</CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            id={id("observaciones")}
            name="observaciones"
            aria-label="Otros o notas"
            rows={4}
            className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            value={captura.observaciones}
            onChange={(e) =>
              cambiar({ ...captura, observaciones: e.target.value })
            }
          />
          {error("observaciones") ? (
            <p className="mt-1 text-sm text-destructive">
              {error("observaciones")}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {firma(
        "tecnico",
        "Firma del técnico",
        "Quien hizo el servicio por parte de MOT.",
      )}
      {esVisita
        ? firma(
            "cliente",
            "Firma del responsable del cliente",
            "Quien recibe o acepta el servicio.",
          )
        : null}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-xl flex-col gap-2">
          <p
            role="status"
            data-estado={estado.tipo}
            className={`text-sm ${estado.tipo === "error" ? "text-destructive" : estado.tipo === "sin_senal" ? "font-medium" : "text-muted-foreground"}`}
          >
            {estado.tipo === "error"
              ? estado.mensaje
              : TEXTO_ESTADO[estado.tipo]}
          </p>
          <div className="flex gap-2">
            <Link
              href={volverHref}
              className={buttonVariants({
                variant: "outline",
                className: "h-11 flex-1",
              })}
            >
              Volver a la orden
            </Link>
            <Button
              type="submit"
              className="h-11 flex-1"
              disabled={estado.tipo === "enviando" || estado.tipo === "sistema"}
            >
              {estado.tipo === "sistema" ? "Guardado" : "Guardar ahora"}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
