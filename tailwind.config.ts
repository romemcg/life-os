import type { Config } from "tailwindcss";
export default {
  darkMode: ["class", ".dark"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { 950: "rgb(var(--ink-950) / <alpha-value>)", 900: "rgb(var(--ink-900) / <alpha-value>)", 850: "rgb(var(--ink-850) / <alpha-value>)", 800: "rgb(var(--ink-800) / <alpha-value>)", 700: "rgb(var(--ink-700) / <alpha-value>)", 600: "rgb(var(--ink-600) / <alpha-value>)" },
        teal: { 200: "rgb(var(--teal-200) / <alpha-value>)", 300: "rgb(var(--teal-300) / <alpha-value>)", 400: "rgb(var(--teal-400) / <alpha-value>)", 500: "rgb(var(--teal-500) / <alpha-value>)", 600: "rgb(var(--teal-600) / <alpha-value>)" },
        fog: { 100: "rgb(var(--fog-100) / <alpha-value>)", 300: "rgb(var(--fog-300) / <alpha-value>)", 400: "rgb(var(--fog-400) / <alpha-value>)", 500: "rgb(var(--fog-500) / <alpha-value>)" },
        sun: "rgb(var(--sun) / <alpha-value>)",
      },
      fontFamily: { sans: ["var(--font-sans)", "system-ui", "sans-serif"], display: ["var(--font-display)", "Georgia", "serif"], mono: ["ui-monospace", "SFMono-Regular", "monospace"] },
    },
  },
  plugins: [],
} satisfies Config;
