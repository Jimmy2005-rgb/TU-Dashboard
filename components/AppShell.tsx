"use client";

import { BookOpen, BrainCircuit, GraduationCap, LayoutDashboard, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/practice", label: "Quiz Vault", icon: BrainCircuit },
  { href: "/courses", label: "Courses", icon: BookOpen },
];

export default function AppShell({ children, authEnabled }: { children: React.ReactNode; authEnabled: boolean }) {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === "/login") return <>{children}</>;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-tu-600 text-gold-500">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold text-slate-900">TU BBA Hub</p>
            <p className="text-xs text-slate-500">Academic & Quiz Vault</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                  active ? "bg-tu-50 text-tu-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        {authEnabled && (
          <button onClick={logout} className="btn-ghost m-3 justify-start">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        )}
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-2 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-tu-600 text-gold-500">
            <GraduationCap className="h-4 w-4" />
          </div>
          <span className="text-sm font-bold">TU BBA Hub</span>
        </div>
        <nav className="flex gap-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-label={label}
              className={clsx(
                "rounded-lg p-2",
                pathname.startsWith(href) ? "bg-tu-50 text-tu-700" : "text-slate-500 hover:bg-slate-100",
              )}
            >
              <Icon className="h-5 w-5" />
            </Link>
          ))}
        </nav>
      </header>

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
