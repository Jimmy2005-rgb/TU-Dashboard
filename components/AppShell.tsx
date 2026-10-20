"use client";

import clsx from "clsx";
import { BookOpen, BrainCircuit, CalendarClock, GraduationCap, LayoutDashboard, LogOut, Settings2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCourseColors } from "./CourseColors";
import DisplaySettings from "./DisplaySettings";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/schedule", label: "Timetable", icon: CalendarClock },
  { href: "/practice", label: "Quiz Vault", icon: BrainCircuit },
  { href: "/courses", label: "Courses", icon: BookOpen },
];

function Brand({ small = false }: { small?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={clsx(
          "flex items-center justify-center rounded-xl bg-gradient-to-br from-tu-500 to-tu-700 text-gold-400 shadow-sm",
          small ? "h-8 w-8" : "h-9 w-9",
        )}
      >
        <GraduationCap className={small ? "h-4 w-4" : "h-5 w-5"} />
      </div>
      <div className="leading-tight">
        <p className="text-sm font-bold tracking-tight text-slate-900">TU BBA Hub</p>
        {!small && <p className="text-[11px] text-slate-500">Academic &amp; Quiz Vault</p>}
      </div>
    </div>
  );
}

export default function AppShell({ children, authEnabled }: { children: React.ReactNode; authEnabled: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const colors = useCourseColors();
  const courseCodes = Object.keys(colors).sort();

  if (pathname === "/login") return <>{children}</>;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-surface lg:flex">
        <div className="px-5 pb-4 pt-5">
          <Brand />
        </div>

        <nav className="space-y-0.5 px-3">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/courses" && pathname.startsWith(href)) || (href === "/courses" && pathname === "/courses");
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                  active ? "bg-slate-900 text-slate-50 shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        {courseCodes.length > 0 && (
          <div className="mt-6 min-h-0 flex-1 overflow-y-auto px-3">
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">My courses</p>
            <ul className="space-y-0.5">
              {courseCodes.map((code) => {
                const href = `/courses/${code}`;
                const active = pathname === href;
                return (
                  <li key={code}>
                    <Link
                      href={href}
                      className={clsx(
                        `course-${colors[code]} flex items-center gap-2.5 rounded-lg px-3 py-1.5 font-mono text-xs font-semibold transition`,
                        active ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                      )}
                    >
                      <span className="course-dot" />
                      {code}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="mt-auto space-y-2 border-t border-slate-200 p-3">
          <DisplaySettings />
          {authEnabled && (
            <button onClick={logout} className="btn-ghost w-full justify-start rounded-xl px-3 py-2 text-xs">
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          )}
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-slate-200 bg-surface/90 px-4 py-2 backdrop-blur lg:hidden">
        <Brand small />
        <div className="flex items-center gap-1">
          <nav className="flex gap-1">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                aria-label={label}
                className={clsx("rounded-xl p-2", pathname.startsWith(href) ? "bg-slate-900 text-slate-50" : "text-slate-500 hover:bg-slate-100")}
              >
                <Icon className="h-5 w-5" />
              </Link>
            ))}
          </nav>
          <details className="relative">
            <summary className="flex cursor-pointer list-none items-center rounded-xl p-2 text-slate-500 hover:bg-slate-100" aria-label="Display settings">
              <Settings2 className="h-5 w-5" />
            </summary>
            <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-slate-200 bg-surface p-3 shadow-lift">
              <DisplaySettings />
              {authEnabled && (
                <button onClick={logout} className="btn-ghost mt-2 w-full justify-start rounded-xl px-3 py-2 text-xs">
                  <LogOut className="h-3.5 w-3.5" /> Sign out
                </button>
              )}
            </div>
          </details>
        </div>
      </header>

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</main>
    </div>
  );
}
