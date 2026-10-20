"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/presupuestos", label: "Presupuestos" },
  { href: "/facturas", label: "Facturas" },
  { href: "/gastos", label: "Gastos" },
  { href: "/banco", label: "Banco" },
  { href: "/contactos", label: "Contactos" },
  { href: "/impuestos", label: "Impuestos" },
  { href: "/configuracion", label: "Configuración" },
];

// Reading the pathname is URL data on dynamic routes, so the layout renders this inside <Suspense>
// with NavLinkList as the fallback (same links, no active highlight).
export function NavLinks() {
  return <NavLinkList pathname={usePathname()} />;
}

export function NavLinkList({ pathname }: { pathname: string | null }) {
  return (
    <ul className="flex gap-1 overflow-x-auto">
      {links.map(({ href, label }) => {
        const active = pathname !== null && (href === "/" ? pathname === "/" : pathname.startsWith(href));
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={`block whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
