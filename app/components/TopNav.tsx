"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/discover", label: "Discover" },
  { href: "/research", label: "Research" },
  { href: "/poc", label: "PoC" },
];

export default function TopNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 top-0 z-50 h-14 border-b border-slate-200 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
        <span className="text-base font-semibold tracking-tight text-slate-900">Validly</span>
        <div className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-3 py-1.5 font-mono text-[0.72rem] uppercase tracking-[0.18em] transition ${
                  isActive
                    ? "border border-orange-200 bg-orange-50 text-orange-700"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
