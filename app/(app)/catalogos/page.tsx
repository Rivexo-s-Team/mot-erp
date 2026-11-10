import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requirePermiso } from "@/lib/auth/session";
import { CATALOGOS } from "@/lib/catalogos/config";

export const metadata: Metadata = { title: "Catálogos" };

export default async function CatalogosPage() {
  await requirePermiso("catalogos.ver");

  return (
    <>
      <PageHeader
        title="Catálogos"
        description="Listas base que usan los demás módulos del sistema."
      />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CATALOGOS.map((c) => (
          <li key={c.slug}>
            <Link href={`/catalogos/${c.slug}`} className="block h-full">
              <Card className="h-full transition-colors hover:border-primary/40 hover:bg-accent/40">
                <CardHeader>
                  <CardTitle>{c.titulo}</CardTitle>
                  <CardDescription>{c.descripcion}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
