import Image from "next/image";
import globo from "@/public/marca/globo-mot.png";
import logo from "@/public/marca/logo-mot.png";
import { cn } from "@/lib/utils";

type LogoProps = {
  /** "completo": logotipo con el nombre. "icono": solo el globo. */
  variant?: "completo" | "icono";
  className?: string;
  priority?: boolean;
};

// El logotipo tiene letras negras: úsalo solo sobre fondos claros.
export function Logo({ variant = "completo", className, priority }: LogoProps) {
  if (variant === "icono") {
    return (
      <Image
        src={globo}
        alt="MOT"
        priority={priority}
        className={cn("size-8", className)}
      />
    );
  }
  return (
    <Image
      src={logo}
      alt="MOT · Molecular Oil Technology"
      priority={priority}
      className={cn("h-10 w-auto", className)}
    />
  );
}
