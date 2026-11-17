import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { requirePermiso } from "@/lib/auth/session";
import { fechaVencimiento } from "@/lib/facturacion/credito";
import { facturasPorCobrar } from "@/lib/facturacion/data";
import { folioFactura } from "@/lib/facturacion/facturas";
import {
  CAMPO_APLICAR,
  FORMAS_DE_PAGO_RECIBIDO,
} from "@/lib/facturacion/pagos";
import { formatDia, formatImporte, hoyEnMexico } from "@/lib/format";
import { registrarPago } from "../actions";

export const metadata: Metadata = { title: "Registrar pago" };

const etiquetaCampo = "flex flex-col gap-1.5 text-sm font-medium";

export default async function NuevoPagoPage({
  searchParams,
}: PageProps<"/pagos/nuevo">) {
  await requirePermiso("facturacion.editar");
  const { cuenta: cuentaParam, error } = await searchParams;

  // Paso 1: de qué cliente. Solo aparecen los que deben alguna factura.
  if (typeof cuentaParam !== "string") {
    const todas = await facturasPorCobrar();
    const porCuenta = new Map<string, { nombre: string; facturas: number }>();
    for (const f of todas) {
      const actual = porCuenta.get(f.cuenta_id);
      porCuenta.set(f.cuenta_id, {
        nombre: f.cuentas?.nombre ?? "—",
        facturas: (actual?.facturas ?? 0) + 1,
      });
    }
    const cuentas = [...porCuenta.entries()].sort((a, b) =>
      a[1].nombre.localeCompare(b[1].nombre, "es"),
    );
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader
          title="Registrar pago"
          description="Elige el cliente que pagó. Solo aparecen los que tienen facturas por cobrar."
        />
        {cuentas.length === 0 ? (
          <Card className="px-4 py-6 text-center text-sm text-muted-foreground">
            No hay facturas emitidas por cobrar.
          </Card>
        ) : (
          <Card>
            <CardContent>
              <form action="/pagos/nuevo" className="flex flex-col gap-4">
                <NativeSelect
                  name="cuenta"
                  aria-label="Cliente"
                  required
                  className="h-10 w-full"
                >
                  <NativeSelectOption value="">
                    Elige un cliente…
                  </NativeSelectOption>
                  {cuentas.map(([id, c]) => (
                    <NativeSelectOption key={id} value={id}>
                      {c.nombre} ({c.facturas}{" "}
                      {c.facturas === 1 ? "factura" : "facturas"} por cobrar)
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <Button type="submit" className="h-10 sm:self-end">
                  Continuar
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  if (!z.uuid().safeParse(cuentaParam).success) notFound();
  const facturas = await facturasPorCobrar(cuentaParam);
  const hoy = hoyEnMexico();
  // Un pago es de una razón social y una moneda: un formulario por cada combinación.
  const grupos = new Map<string, typeof facturas>();
  for (const f of facturas) {
    const clave = `${f.razon_social_id}|${f.moneda}`;
    grupos.set(clave, [...(grupos.get(clave) ?? []), f]);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Registrar pago"
        description={facturas[0]?.cuentas?.nombre ?? "Facturas por cobrar"}
      />
      {typeof error === "string" ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {facturas.length === 0 ? (
        <Card className="px-4 py-6 text-center text-sm text-muted-foreground">
          Este cliente no tiene facturas por cobrar.
        </Card>
      ) : (
        <div className="space-y-6">
          {[...grupos.entries()].map(([clave, lista]) => {
            const primera = lista[0];
            if (!primera) return null;
            const moneda = primera.moneda;
            return (
              <Card key={clave}>
                <CardContent>
                  <form
                    action={registrarPago.bind(null, cuentaParam)}
                    className="flex flex-col gap-4"
                  >
                    <input
                      type="hidden"
                      name="razon_social"
                      value={primera.razon_social_id}
                    />
                    <input type="hidden" name="moneda" value={moneda} />
                    <p className="font-medium">
                      {primera.razones_sociales?.razon_social}
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        · pago en {moneda}
                      </span>
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className={etiquetaCampo}>
                        Fecha del pago
                        <Input
                          type="date"
                          name="fecha"
                          defaultValue={hoy}
                          required
                          className="h-10 font-normal"
                        />
                      </label>
                      <label className={etiquetaCampo}>
                        Monto recibido ({moneda})
                        <Input
                          name="monto"
                          inputMode="decimal"
                          required
                          autoComplete="off"
                          className="h-10 font-normal"
                        />
                      </label>
                      <label className={etiquetaCampo}>
                        Forma de pago
                        <NativeSelect
                          name="forma_pago"
                          required
                          defaultValue="03"
                          className="h-10 w-full font-normal"
                        >
                          {FORMAS_DE_PAGO_RECIBIDO.map((f) => (
                            <NativeSelectOption key={f.value} value={f.value}>
                              {f.label}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                      </label>
                      <label className={etiquetaCampo}>
                        <span>
                          Referencia{" "}
                          <span className="font-normal text-muted-foreground">
                            (opcional)
                          </span>
                        </span>
                        <Input
                          name="referencia"
                          autoComplete="off"
                          className="h-10 font-normal"
                        />
                      </label>
                      {moneda !== "MXN" ? (
                        <label className={`${etiquetaCampo} sm:col-span-2`}>
                          <span>
                            Tipo de cambio del pago{" "}
                            <span className="font-normal text-muted-foreground">
                              (opcional)
                            </span>
                          </span>
                          <Input
                            name="tipo_cambio"
                            inputMode="decimal"
                            autoComplete="off"
                            className="h-10 font-normal sm:max-w-48"
                          />
                          <span className="font-normal text-muted-foreground">
                            Si pagó en pesos, anota aquí el tipo de cambio y
                            registra el monto en {moneda}.
                          </span>
                        </label>
                      ) : null}
                    </div>

                    <fieldset className="flex flex-col gap-2">
                      <legend className="mb-1 text-sm font-medium">
                        A qué facturas se aplica
                      </legend>
                      {lista.map((f) => (
                        <label
                          key={f.id}
                          className="grid gap-x-3 gap-y-1 rounded-lg border px-3 py-2.5 text-sm sm:grid-cols-[1fr_9rem] sm:items-center"
                        >
                          <span className="min-w-0">
                            <span className="block font-medium">
                              Factura {folioFactura(f)}
                            </span>
                            <span className="block text-muted-foreground tabular-nums">
                              {formatDia(f.fecha)} · vence{" "}
                              {formatDia(
                                fechaVencimiento(f.fecha, f.dias_credito),
                              )}{" "}
                              · saldo {formatImporte(f.saldos.saldo, moneda)}
                            </span>
                          </span>
                          <Input
                            name={`${CAMPO_APLICAR}${f.id}`}
                            inputMode="decimal"
                            autoComplete="off"
                            placeholder="Monto a aplicar"
                            aria-label={`Monto a aplicar a la factura ${folioFactura(f)}`}
                            className="h-10"
                          />
                        </label>
                      ))}
                    </fieldset>
                    <p className="text-sm text-muted-foreground">
                      Deja vacía la factura a la que no se aplique nada. Si el
                      pago es mayor que lo aplicado, el resto queda por aplicar.
                    </p>
                    <Button type="submit" className="h-10 sm:self-end">
                      Registrar pago
                    </Button>
                  </form>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
