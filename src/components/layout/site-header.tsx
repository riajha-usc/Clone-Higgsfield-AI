import Link from "next/link";
import { CreditBadge } from "./credit-badge";
import { MobileNav, NavLinks } from "./nav-links";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-screen-2xl items-center gap-3 px-4 sm:gap-8 sm:px-6">
        <Link href="/" className="shrink-0 rounded-md text-base font-semibold tracking-tight text-text">
          Afterglow
        </Link>
        <NavLinks />
        <CreditBadge />
        <MobileNav />
      </div>
    </header>
  );
}
