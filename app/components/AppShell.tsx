import Link from "next/link";
import { Wordmark } from "@/app/components/Logo";
import { RoleBadge } from "@/app/components/RoleBadge";

type NavKey = "active-case" | "cases" | "reopen";

const NAV: { key: NavKey; label: string; href: string; icon: string }[] = [
  { key: "active-case", label: "Active Case", href: "/cases/RB-2049", icon: "M12 3l8 3v5c0 4.5-3.2 8-8 10-4.8-2-8-5.5-8-10V6l8-3z" },
  { key: "cases", label: "All Cases", href: "/cases", icon: "M4 6h16M4 12h16M4 18h10" },
  { key: "reopen", label: "Reopen / Search", href: "/reopen", icon: "M11 4a7 7 0 100 14 7 7 0 000-14zm10 17l-5-5" },
];

function NavIcon({ d }: { d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

export function AppShell({ active, children }: { active: NavKey; children: React.ReactNode }) {
  return (
    <div className="min-h-screen md:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-stone-200 bg-white px-3 py-4 md:flex">
        <div className="px-2 pb-4">
          <Link href="/">
            <Wordmark size={26} />
          </Link>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map((n) => {
            const on = n.key === active;
            return (
              <Link
                key={n.key}
                href={n.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  on ? "bg-red-50 text-red-700" : "text-stone-600 hover:bg-stone-100"
                }`}
              >
                <NavIcon d={n.icon} />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-stone-200 pt-3">
          <RoleBadge />
          <div className="mt-2 px-1 text-[11px] text-stone-400">Demo workspace • sandboxed</div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-stone-200 bg-white px-4 py-3 md:hidden">
        <Link href="/">
          <Wordmark size={24} />
        </Link>
        <RoleBadge compact />
      </header>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
