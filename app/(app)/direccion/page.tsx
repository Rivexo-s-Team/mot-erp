import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { BarrasMensuales } from "@/components/direccion/barras-mensuales";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermiso } from "@/lib/auth/session";
import {
  ingresosPorMes,
  porFacturar,
  rentasVigentes,
} from "@/lib/direccion/data";
import {
  finDeMes,
  nombreMesLargo,
  seriesPorMoneda,
  ultimosMeses,
} from "@/lib/direccion/tablero";
import {
  antiguedadDeSaldos,
  totalesPorMoneda,
} from "@/lib/facturacion/cobranza";
import { facturasPorCobrar } from "@/lib/facturacion/data";
import { formatImporte, hoyEnMexico } from "@/lib/format";

export const metadata: Metadata = { title: "Dirección" };

const MESES = 12;

export default async function DireccionPage() {
  await requirePermiso("direccion.ver");
  const hoy = hoyEnMexico();
  const meses = ultimosMeses(hoy, MESES);
  const mesActual = meses.at(-1)!;
  const mesAnterior = meses.at(-2)!;
  const [ingresos, rentas, pendientes, porCobrar] = await Promise.all([
    ingresosPorMes(meses[0]!, finDeMes(mesActual)),
    rentasVigentes(),
    porFacturar(),
    facturasPorCobrar(),
  ]);
  const series = seriesPorMoneda(ingresos, meses);
  const cartera = totalesPorMoneda(
    antiguedadDeSaldos(
      porCobrar.map((f) => ({ ...f, saldo: f.saldos.saldo })),
      hoy,
    ),
  );
  // Las monedas con algo que mostrar. Nunca se suman entre sí.
  const monedas = [
    ...new Set([
      ...series.map((s) => s.moneda),
      ...rentas.map((r) => r.moneda),
      ...pendientes.map((p) => p.moneda),
      ...cartera.map((c) => c.moneda),
    ]),
  ].sort();

  return (
    <>
      <PageHeader
        title="Dirección"
        description="Ingresos y cobranza con lo que ya está capturado. Cada moneda va por separado; nada se convierte."
      />

      {monedas.length === 0 ? (
        <Card className="px-4 py-10 text-center text-sm text-muted-foreground">
          Aún no hay contratos vigentes, cargos ni facturas que mostrar.
        </Card>
      ) : null}

      <div className="space-y-10">
        {monedas.map((moneda) => {
          const serie = series.find((s) => s.moneda === moneda);
          const actual = serie?.meses.at(-1);
          const anterior = serie?.meses.at(-2);
          const renta = rentas.find((r) => r.moneda === moneda);
          const pendiente = pendientes.find((p) => p.moneda === moneda);
          const saldo = cartera.find((c) => c.moneda === moneda);
          const importe = (n: number | undefined) =>
            formatImporte(n ?? 0, moneda);
          return (
            <section key={moneda} aria-label={`Cifras en ${moneda}`}>
              <h2 className="mb-3 text-lg font-semibold tracking-tight">
                {moneda === "USD"
                  ? "Dólares (USD)"
                  : moneda === "MXN"
                    ? "Pesos (MXN)"
                    : moneda}
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <Cifra
                  titulo={`Facturado en ${nombreMesLargo(mesActual)}`}
                  valor={importe(actual?.facturado)}
                  nota={`Sin IVA · ${actual?.facturas ?? 0} ${actual?.facturas === 1 ? "factura" : "facturas"}. ${nombreMesLargo(mesAnterior)}: ${importe(anterior?.facturado)}`}
                  href="/facturas"
                />
                <Cifra
                  titulo={`Cobrado en ${nombreMesLargo(mesActual)}`}
                  valor={importe(actual?.cobrado)}
                  nota={`${nombreMesLargo(mesAnterior)}: ${importe(anterior?.cobrado)}`}
                  href="/pagos"
                />
                <Cifra
                  titulo="Renta mensual vigente"
                  valor={importe(renta?.renta_mensual)}
                  nota={
                    renta
                      ? `Sin IVA · ${renta.rentas} ${renta.rentas === 1 ? "renta" : "rentas"} en ${renta.contratos} ${renta.contratos === 1 ? "contrato" : "contratos"}`
                      : "Sin contratos de renta vigentes"
                  }
                  href="/contratos"
                />
                <Cifra
                  titulo="Por cobrar"
                  valor={importe(saldo?.total)}
                  nota={
                    saldo && saldo.vencido > 0 ? (
                      <span className="text-destructive">
                        Vencido: {importe(saldo.vencido)}
                      </span>
                    ) : (
                      "Nada vencido"
                    )
                  }
                  href="/cobranza"
                />
                <Cifra
                  titulo="Por facturar"
                  valor={importe(pendiente?.importe)}
                  nota={
                    pendiente
                      ? `Sin IVA · ${pendiente.cargos} ${pendiente.cargos === 1 ? "cargo" : "cargos"}${pendiente.por_completar > 0 ? ` · ${pendiente.por_completar} por completar` : ""}`
                      : "Sin cargos pendientes"
                  }
                  href="/cargos"
                />
              </ul>

              {serie ? (
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle>
                      Facturado y cobrado por mes
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        últimos {MESES} meses · {moneda}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <BarrasMensuales meses={serie.meses} moneda={moneda} />
                    <p className="mt-3 text-sm text-muted-foreground">
                      Las dos series llevan IVA para poder compararlas. Lo
                      cobrado es el dinero que entró en el mes, de la factura
                      que sea.
                    </p>
                  </CardContent>
                </Card>
              ) : null}
            </section>
          );
        })}
      </div>
    </>
  );
}

/** Una cifra del tablero, con su nota y el enlace a la pantalla de donde sale. */
function Cifra({
  titulo,
  valor,
  nota,
  href,
}: {
  titulo: string;
  valor: string;
  nota: ReactNode;
  href: string;
}) {
  return (
    <li>
      <Link href={href} className="block h-full">
        <Card className="h-full gap-1 px-4 py-3 transition-colors hover:border-primary/40 hover:bg-accent/40">
          <p className="text-sm text-muted-foreground">{titulo}</p>
          <p className="text-xl font-semibold tabular-nums">{valor}</p>
          <p className="text-sm text-muted-foreground">{nota}</p>
        </Card>
      </Link>
    </li>
  );
}
