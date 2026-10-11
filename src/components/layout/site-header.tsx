import Link from "next/link";
import { CreditBadge } from "./credit-badge";

const NAV_LINKS = [
  { href: "/p/demo", label: "Studio" },
  { href: "/library", label: "Library" },
  { href: "/pricing", label: "Pricing" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-screen-2xl items-center gap-3 px-4 sm:gap-8 sm:px-6">
        <Link href="/" className="shrink-0 text-base font-semibold tracking-tight text-text">
          Afterglow
        </Link>
        <nav className="flex min-w-0 items-center sm:gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-pill px-2 py-1.5 text-sm sm:px-3 text-text-muted transition-colors hover:bg-panel hover:text-text"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <CreditBadge />
      </div>
    </header>
  );
}
