"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/p/demo", match: "/p/", label: "Studio" },
  { href: "/library", match: "/library", label: "Library" },
  { href: "/elements", match: "/elements", label: "Elements" },
  { href: "/pricing", match: "/pricing", label: "Pricing" },
  { href: "/about", match: "/about", label: "About" },
];

function useActive() {
  const pathname = usePathname();
  return (match: string) => pathname.startsWith(match);
}

/** Inline links from 640px up. */
export function NavLinks() {
  const isActive = useActive();
  return (
    <nav aria-label="Main" className="hidden min-w-0 items-center gap-1 sm:flex">
      {NAV_LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={isActive(link.match) ? "page" : undefined}
          className={cn(
            "rounded-pill px-3 py-1.5 text-sm transition-colors hover:bg-panel hover:text-text",
            isActive(link.match) ? "text-text" : "text-text-muted",
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

/** Below 640px the links move into a menu next to the balance. */
export function MobileNav() {
  const isActive = useActive();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Open menu"
        className="flex size-9 shrink-0 items-center justify-center rounded-pill border border-line text-text sm:hidden"
      >
        <Menu className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        {NAV_LINKS.map((link) => (
          <DropdownMenuItem key={link.href} asChild>
            <Link href={link.href} aria-current={isActive(link.match) ? "page" : undefined} className="text-sm">
              {link.label}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem asChild>
          <Link href="/account" aria-current={isActive("/account") ? "page" : undefined} className="text-sm">
            Account
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
