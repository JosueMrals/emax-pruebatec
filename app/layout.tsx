import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { CompanySwitcher } from "@/components/company-switcher";
import { NavLinkList, NavLinks } from "@/components/nav-links";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EnerFactura",
  description: "Facturación y contabilidad para autónomos y pymes",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="border-b">
          <div className="mx-auto grid w-full max-w-6xl gap-2 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link href="/" className="text-lg font-semibold tracking-tight">
                EnerFactura
              </Link>
              <Suspense fallback={null}>
                <CompanySwitcher />
              </Suspense>
            </div>
            <nav aria-label="Principal">
              <Suspense fallback={<NavLinkList pathname={null} />}>
                <NavLinks />
              </Suspense>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
