"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/facturas", label: "Facturas" },
  { href: "/gastos", label: "Gastos" },
  { href: "/impuestos", label: "Impuestos" },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <ul className="flex gap-1 overflow-x-auto">
      {links.map(({ href, label }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
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
