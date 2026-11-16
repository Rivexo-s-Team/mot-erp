import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { ConfigForm } from "@/components/forms/config-form";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { requirePermiso, tienePermiso } from "@/lib/auth/session";
import { camposCargo, conceptoMalUso } from "@/lib/cargos/campos";
import {
  obtenerCargo,
  ordenPermiteCargoAlCliente,
  partesDeOrden,
} from "@/lib/cargos/data";
import { valoresIniciales } from "@/lib/forms/campos";
import { obtenerOrden } from "@/lib/ordenes/data";
import { listarCuentasParaElegir } from "@/lib/pipeline/data";
import { guardarCargo } from "../actions";

const esId = (v: unknown): v is string => z.uuid().safeParse(v).success;

export default async function CargoPage({
  params,
  searchParams,
}: PageProps<"/cargos/[registro]">) {
  const sesion = await requirePermiso("cargos.editar");
  if (!tienePermiso(sesion, "precios.ver")) redirect("/");
  const { registro } = await params;
  const { cuenta: cuentaParam, orden: ordenParam } = await searchParams;
  const esNuevo = registro === "nuevo";

  // Edición -------------------------------------------------------------------
  if (!esNuevo) {
    const cargo = esId(registro) ? await obtenerCargo(registro) : null;
    if (!cargo) notFound();
    if (cargo.estado === "facturado") redirect("/cargos");
    const campos = camposCargo(true, cargo.tipo);
    return (
      <div className="mx-auto max-w-xl">
        <title>Editar cargo · Sistema MOT</title>
        <PageHeader
          title="Editar cargo"
          description={cargo.cuentas?.nombre ?? ""}
        />
        {cargo.orden_id && cargo.ordenes_servicio ? (
          <p className="mb-4 text-sm text-muted-foreground">
            De la orden de servicio{" "}
            <Link
              href={`/ordenes/${cargo.orden_id}`}
              className="text-primary underline-offset-4 hover:underline"
            >
              {cargo.ordenes_servicio.folio}
            </Link>
            .
          </p>
        ) : null}
        <Card>
          <CardContent>
            <ConfigForm
              campos={campos}
              valores={valoresIniciales(campos, {
                tipo: cargo.tipo,
                concepto: cargo.concepto,
                cantidad: cargo.cantidad,
                unidad: cargo.unidad,
                precio_unitario: cargo.precio_unitario,
                moneda: cargo.moneda,
                estado: cargo.estado,
                notas: cargo.notas,
              })}
              esEdicion
              guardar={guardarCargo.bind(null, cargo.cuenta_id, null, cargo.id)}
              cancelarHref="/cargos"
              textoGuardar="Guardar cambios"
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Alta desde una orden: el cliente y el concepto ya se conocen ------------------
  const orden =
    typeof ordenParam === "string" && esId(ordenParam)
      ? await obtenerOrden(ordenParam)
      : null;
  if (ordenParam !== undefined && (!orden || !orden.cuenta_id)) notFound();
  const cuentas = await listarCuentasParaElegir();
  const cuentaId = orden?.cuenta_id ?? cuentaParam;

  if (typeof cuentaId !== "string") {
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader
          title="Nuevo cargo"
          description="Elige a qué cliente se le cobra."
        />
        <Card>
          <CardContent>
            <form action="/cargos/nuevo" className="flex flex-col gap-4">
              <NativeSelect
                name="cuenta"
                aria-label="Cliente"
                required
                className="h-10 w-full"
              >
                <NativeSelectOption value="">
                  Elige un cliente…
                </NativeSelectOption>
                {cuentas.map((c) => (
                  <NativeSelectOption key={c.id} value={c.id}>
                    {c.nombre}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <Button type="submit" className="h-10 sm:self-end">
                Continuar
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const cuenta = esId(cuentaId)
    ? cuentas.find((c) => c.id === cuentaId)
    : undefined;
  if (!cuenta) notFound();

  const campos = camposCargo(false);
  const valores = valoresIniciales(campos);
  if (orden && (await ordenPermiteCargoAlCliente(orden.id))) {
    valores.tipo = "partes_mal_uso";
    valores.concepto = conceptoMalUso(
      orden.folio,
      await partesDeOrden(orden.id),
    );
    valores.unidad = "servicio";
  }

  return (
    <div className="mx-auto max-w-xl">
      <title>Nuevo cargo · Sistema MOT</title>
      <PageHeader
        title="Nuevo cargo"
        description={
          orden ? `${cuenta.nombre} · orden ${orden.folio}` : cuenta.nombre
        }
      />
      <Card>
        <CardContent>
          <ConfigForm
            campos={campos}
            valores={valores}
            esEdicion={false}
            guardar={guardarCargo.bind(
              null,
              cuenta.id,
              orden?.id ?? null,
              null,
            )}
            cancelarHref={orden ? `/ordenes/${orden.id}` : "/cargos"}
            textoGuardar="Registrar cargo"
          />
        </CardContent>
      </Card>
    </div>
  );
}
