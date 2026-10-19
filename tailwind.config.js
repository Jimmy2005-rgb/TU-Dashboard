/** @type {import('tailwindcss').Config} */
// Every colour points at a CSS variable (app/theme.css) so light and dark mode
// are a single variable swap on <html class="dark">.
const palette = {
  "slate": {
    "50": "rgb(var(--c-slate-50) / <alpha-value>)",
    "100": "rgb(var(--c-slate-100) / <alpha-value>)",
    "200": "rgb(var(--c-slate-200) / <alpha-value>)",
    "300": "rgb(var(--c-slate-300) / <alpha-value>)",
    "400": "rgb(var(--c-slate-400) / <alpha-value>)",
    "500": "rgb(var(--c-slate-500) / <alpha-value>)",
    "600": "rgb(var(--c-slate-600) / <alpha-value>)",
    "700": "rgb(var(--c-slate-700) / <alpha-value>)",
    "800": "rgb(var(--c-slate-800) / <alpha-value>)",
    "900": "rgb(var(--c-slate-900) / <alpha-value>)",
    "950": "rgb(var(--c-slate-950) / <alpha-value>)"
  },
  "tu": {
    "50": "rgb(var(--c-tu-50) / <alpha-value>)",
    "100": "rgb(var(--c-tu-100) / <alpha-value>)",
    "200": "rgb(var(--c-tu-200) / <alpha-value>)",
    "300": "rgb(var(--c-tu-300) / <alpha-value>)",
    "400": "rgb(var(--c-tu-400) / <alpha-value>)",
    "500": "rgb(var(--c-tu-500) / <alpha-value>)",
    "600": "rgb(var(--c-tu-600) / <alpha-value>)",
    "700": "rgb(var(--c-tu-700) / <alpha-value>)",
    "800": "rgb(var(--c-tu-800) / <alpha-value>)",
    "900": "rgb(var(--c-tu-900) / <alpha-value>)",
    "950": "rgb(var(--c-tu-950) / <alpha-value>)"
  },
  "gold": {
    "300": "rgb(var(--c-gold-300) / <alpha-value>)",
    "400": "rgb(var(--c-gold-400) / <alpha-value>)",
    "500": "rgb(var(--c-gold-500) / <alpha-value>)",
    "600": "rgb(var(--c-gold-600) / <alpha-value>)"
  },
  "emerald": {
    "50": "rgb(var(--c-emerald-50) / <alpha-value>)",
    "100": "rgb(var(--c-emerald-100) / <alpha-value>)",
    "200": "rgb(var(--c-emerald-200) / <alpha-value>)",
    "300": "rgb(var(--c-emerald-300) / <alpha-value>)",
    "400": "rgb(var(--c-emerald-400) / <alpha-value>)",
    "500": "rgb(var(--c-emerald-500) / <alpha-value>)",
    "600": "rgb(var(--c-emerald-600) / <alpha-value>)",
    "700": "rgb(var(--c-emerald-700) / <alpha-value>)",
    "800": "rgb(var(--c-emerald-800) / <alpha-value>)",
    "900": "rgb(var(--c-emerald-900) / <alpha-value>)",
    "950": "rgb(var(--c-emerald-950) / <alpha-value>)"
  },
  "amber": {
    "50": "rgb(var(--c-amber-50) / <alpha-value>)",
    "100": "rgb(var(--c-amber-100) / <alpha-value>)",
    "200": "rgb(var(--c-amber-200) / <alpha-value>)",
    "300": "rgb(var(--c-amber-300) / <alpha-value>)",
    "400": "rgb(var(--c-amber-400) / <alpha-value>)",
    "500": "rgb(var(--c-amber-500) / <alpha-value>)",
    "600": "rgb(var(--c-amber-600) / <alpha-value>)",
    "700": "rgb(var(--c-amber-700) / <alpha-value>)",
    "800": "rgb(var(--c-amber-800) / <alpha-value>)",
    "900": "rgb(var(--c-amber-900) / <alpha-value>)"
  },
  "red": {
    "50": "rgb(var(--c-red-50) / <alpha-value>)",
    "100": "rgb(var(--c-red-100) / <alpha-value>)",
    "200": "rgb(var(--c-red-200) / <alpha-value>)",
    "300": "rgb(var(--c-red-300) / <alpha-value>)",
    "400": "rgb(var(--c-red-400) / <alpha-value>)",
    "500": "rgb(var(--c-red-500) / <alpha-value>)",
    "600": "rgb(var(--c-red-600) / <alpha-value>)",
    "700": "rgb(var(--c-red-700) / <alpha-value>)",
    "800": "rgb(var(--c-red-800) / <alpha-value>)",
    "900": "rgb(var(--c-red-900) / <alpha-value>)"
  },
  "indigo": {
    "50": "rgb(var(--c-indigo-50) / <alpha-value>)",
    "100": "rgb(var(--c-indigo-100) / <alpha-value>)",
    "200": "rgb(var(--c-indigo-200) / <alpha-value>)",
    "300": "rgb(var(--c-indigo-300) / <alpha-value>)",
    "400": "rgb(var(--c-indigo-400) / <alpha-value>)",
    "500": "rgb(var(--c-indigo-500) / <alpha-value>)",
    "600": "rgb(var(--c-indigo-600) / <alpha-value>)",
    "700": "rgb(var(--c-indigo-700) / <alpha-value>)",
    "800": "rgb(var(--c-indigo-800) / <alpha-value>)",
    "900": "rgb(var(--c-indigo-900) / <alpha-value>)"
  },
  "blue": {
    "500": "rgb(var(--c-blue-500) / <alpha-value>)",
    "600": "rgb(var(--c-blue-600) / <alpha-value>)",
    "700": "rgb(var(--c-blue-700) / <alpha-value>)"
  },
  "orange": {
    "500": "rgb(var(--c-orange-500) / <alpha-value>)",
    "600": "rgb(var(--c-orange-600) / <alpha-value>)"
  }
};

module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ...palette,
        surface: "rgb(var(--c-surface) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgb(15 23 42 / 0.04), 0 1px 3px rgb(15 23 42 / 0.06)",
        lift: "0 4px 12px -2px rgb(15 23 42 / 0.10), 0 2px 4px -2px rgb(15 23 42 / 0.06)",
      },
      keyframes: {
        "slide-in": { from: { transform: "translateX(100%)" }, to: { transform: "translateX(0)" } },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "fade-up": { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        pop: { "0%": { transform: "scale(1)" }, "40%": { transform: "scale(1.25)" }, "100%": { transform: "scale(1)" } },
      },
      animation: {
        "slide-in": "slide-in 0.25s ease-out",
        "fade-in": "fade-in 0.15s ease-out",
        "fade-up": "fade-up 0.25s ease-out",
        pop: "pop 0.35s ease-out",
      },
    },
  },
  plugins: [],
};
