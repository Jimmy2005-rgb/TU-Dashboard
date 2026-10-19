"use client";

import clsx from "clsx";
import { Leaf, Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

function read(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode: setting just won't persist */
  }
}

function applyTheme(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

/** Theme (light / dark / follow Mac) and Calm mode switches, saved on this device. */
export default function DisplaySettings({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>("system");
  const [calm, setCalm] = useState(false);

  useEffect(() => {
    setTheme(read("tu-theme", "system") as Theme);
    setCalm(read("tu-calm", "0") === "1");
  }, []);

  // Follow the Mac's appearance live while in "system" mode.
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  function chooseTheme(t: Theme) {
    setTheme(t);
    write("tu-theme", t);
    applyTheme(t);
  }

  function toggleCalm() {
    const next = !calm;
    setCalm(next);
    write("tu-calm", next ? "1" : "0");
    document.documentElement.classList.toggle("calm", next);
  }

  const options: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "Auto", icon: Monitor },
  ];

  return (
    <div className={clsx("space-y-2", compact && "flex items-center gap-2 space-y-0")}>
      <div className="flex rounded-xl bg-slate-100 p-1" role="radiogroup" aria-label="Theme">
        {options.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            role="radio"
            aria-checked={theme === value}
            onClick={() => chooseTheme(value)}
            title={value === "system" ? "Follow your Mac's appearance" : `${label} mode`}
            className={clsx(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition",
              theme === value ? "bg-surface text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {!compact && label}
          </button>
        ))}
      </div>
      <button
        role="switch"
        aria-checked={calm}
        onClick={toggleCalm}
        title="Calm mode hides extra details and turns off animations"
        className={clsx(
          "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs font-medium transition",
          calm ? "bg-emerald-50 text-emerald-800" : "text-slate-600 hover:bg-slate-100",
          compact && "w-auto",
        )}
      >
        <span className="flex items-center gap-2">
          <Leaf className="h-3.5 w-3.5" /> {!compact && "Calm mode"}
        </span>
        {!compact && (
          <span className={clsx("relative h-4 w-7 rounded-full transition", calm ? "bg-emerald-500" : "bg-slate-300")}>
            <span className={clsx("absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all", calm ? "left-3.5" : "left-0.5")} />
          </span>
        )}
      </button>
    </div>
  );
}
