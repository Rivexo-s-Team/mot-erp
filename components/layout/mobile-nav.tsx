"use client";

import { Menu } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { GrupoMenu } from "@/lib/navegacion";
import { NavLinks } from "./nav-links";

type MobileNavProps = {
  menu: GrupoMenu[];
  logo: ReactNode;
  /** Bloque del usuario; al tocarlo también se cierra el menú. */
  children: ReactNode;
};

/** Botón de menú y panel lateral para celular y tableta. */
export function MobileNav({ menu, logo, children }: MobileNavProps) {
  const [abierto, setAbierto] = useState(false);
  const cerrar = () => setAbierto(false);

  return (
    <Sheet open={abierto} onOpenChange={setAbierto}>
      <SheetTrigger
        render={
          <Button variant="outline" size="icon-lg" aria-label="Abrir menú">
            <Menu />
          </Button>
        }
      />
      <SheetContent side="left" className="w-72 gap-0 p-0">
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle className="sr-only">Menú</SheetTitle>
          <div className="flex">{logo}</div>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-3">
          <NavLinks menu={menu} onNavigate={cerrar} />
          <div className="mt-auto" onClick={cerrar}>
            {children}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
