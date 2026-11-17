import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { requirePermiso } from "@/lib/auth/session";
import { etiqueta, TIPOS_CARGO } from "@/lib/cargos/campos";
import { cargosFacturables, razonesParaFacturar } from "@/lib/facturacion/data";
import { formatImporte } from "@/lib/format";
import { crearFactura } from "../actions";

export const metadata: Metadata = { title: "Nueva factura" };

export default async function NuevaFacturaPage({
  searchParams,
}: PageProps<"/facturas/nueva">) {
  await requirePermiso("facturacion.editar");
  const { cuenta: cuentaParam, error } = await searchParams;

  // Paso 1: a qué cliente. Solo aparecen los que tienen algo por facturar.
  if (typeof cuentaParam !== "string") {
    const todos = await cargosFacturables();
    const porCuenta = new Map<string, { nombre: string; cargos: number }>();
    for (const c of todos) {
      const actual = porCuenta.get(c.cuenta_id);
      porCuenta.set(c.cuenta_id, {
        nombre: c.cuentas?.nombre ?? "—",
        cargos: (actual?.cargos ?? 0) + 1,
      });
    }
    const cuentas = [...porCuenta.entries()].sort((a, b) =>
      a[1].nombre.localeCompare(b[1].nombre, "es"),
    );
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader
          title="Nueva factura"
          description="Elige el cliente. Solo aparecen los que tienen cargos por facturar."
        />
        {cuentas.length === 0 ? (
          <Card className="px-4 py-6 text-center text-sm text-muted-foreground">
            No hay cargos por facturar. Genera las rentas del mes o captura un
            cargo en{" "}
            <Link
              href="/cargos"
              className="text-primary underline-offset-4 hover:underline"
            >
              Cargos por facturar
            </Link>
            .
          </Card>
        ) : (
          <Card>
            <CardContent>
              <form action="/facturas/nueva" className="flex flex-col gap-4">
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
                      {c.nombre} ({c.cargos}{" "}
                      {c.cargos === 1 ? "cargo" : "cargos"})
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
  const [cargos, razones] = await Promise.all([
    cargosFacturables(cuentaParam),
    razonesParaFacturar(cuentaParam),
  ]);
  const nombre = cargos[0]?.cuentas?.nombre;
  // Una factura lleva una sola moneda: si hay cargos en dos, son dos facturas.
  const monedas = [...new Set(cargos.map((c) => c.moneda))].sort();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Nueva factura"
        description={nombre ?? "Elige los cargos que lleva la factura."}
      />
      {typeof error === "string" ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {cargos.length === 0 ? (
        <Card className="px-4 py-6 text-center text-sm text-muted-foreground">
          Este cliente no tiene cargos por facturar.
        </Card>
      ) : razones.length === 0 ? (
        <Card className="px-4 py-6 text-center text-sm text-muted-foreground">
          Este cliente aún no tiene razones sociales. Agrega una en{" "}
          <Link
            href={`/clientes/${cuentaParam}`}
            className="text-primary underline-offset-4 hover:underline"
          >
            su ficha
          </Link>{" "}
          antes de facturarle.
        </Card>
      ) : (
        <div className="space-y-6">
          {monedas.map((moneda) => (
            <Card key={moneda}>
              <CardContent>
                <form
                  action={crearFactura.bind(null, cuentaParam)}
                  className="flex flex-col gap-4"
                >
                  {monedas.length > 1 ? (
                    <p className="font-medium">Cargos en {moneda}</p>
                  ) : null}
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Se factura a
                    <NativeSelect
                      name="razon_social"
                      required
                      className="h-10 w-full font-normal"
                      defaultValue={razones.length === 1 ? razones[0]?.id : ""}
                    >
                      <NativeSelectOption value="">
                        Elige la razón social…
                      </NativeSelectOption>
                      {razones.map((r) => (
                        <NativeSelectOption key={r.id} value={r.id}>
                          {r.razon_social} · {r.rfc}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </label>
                  <fieldset className="flex flex-col gap-2">
                    <legend className="mb-1 text-sm font-medium">
                      Cargos que lleva la factura
                    </legend>
                    {cargos
                      .filter((c) => c.moneda === moneda)
                      .map((c) => (
                        <label
                          key={c.id}
                          className="flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-sm has-checked:border-primary/50 has-checked:bg-accent/40"
                        >
                          <input
                            type="checkbox"
                            name="cargo"
                            value={c.id}
                            defaultChecked
                            className="mt-0.5 size-4 accent-primary"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block break-words">
                              {c.concepto}
                            </span>
                            <span className="block text-muted-foreground tabular-nums">
                              {etiqueta(TIPOS_CARGO, c.tipo)} · {c.cantidad}{" "}
                              {c.unidad ?? ""} ×{" "}
                              {formatImporte(c.precio_unitario ?? 0, c.moneda)}
                            </span>
                          </span>
                          <span className="font-medium tabular-nums">
                            {formatImporte(c.importe ?? 0, c.moneda)}
                          </span>
                        </label>
                      ))}
                  </fieldset>
                  <p className="text-sm text-muted-foreground">
                    Los importes son sin IVA; la factura lo agrega. Se crea como
                    borrador y la puedes corregir antes de timbrarla.
                  </p>
                  <Button type="submit" className="h-10 sm:self-end">
                    Armar factura{monedas.length > 1 ? ` en ${moneda}` : ""}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
