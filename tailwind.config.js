/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Thammasat University palette: crimson red + golden yellow
        tu: {
          50: "#fef2f2",
          100: "#fde3e3",
          200: "#fbcaca",
          300: "#f6a3a3",
          400: "#ee6d6d",
          500: "#e14444",
          600: "#c62828",
          700: "#a51f1f",
          800: "#881e1e",
          900: "#711f1f",
          950: "#3e0b0b",
        },
        gold: {
          300: "#fde68a",
          400: "#fcd34d",
          500: "#f2c200",
          600: "#d4a600",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      keyframes: {
        "slide-in": { from: { transform: "translateX(100%)" }, to: { transform: "translateX(0)" } },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
      },
      animation: {
        "slide-in": "slide-in 0.25s ease-out",
        "fade-in": "fade-in 0.15s ease-out",
      },
    },
  },
  plugins: [],
};
