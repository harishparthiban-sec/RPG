import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Emberfall (default theme) ──
        // Dark slate dungeon background + ember/amber accents.
        night: {
          950: "#0a0e14",
          900: "#0f141c",
          850: "#141b26",
          800: "#1a2332",
          700: "#243147",
          600: "#334561",
        },
        ember: {
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
        },
        parchment: {
          DEFAULT: "#e8e0d0",
          dim: "#a89f8d",
        },
        hp: "#ef4444", // used for danger / delete
        mana: "#38bdf8",
        xp: "#22d3ee",
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      boxShadow: {
        glow: "0 0 18px rgba(245, 158, 11, 0.35)",
        card: "0 4px 24px rgba(0,0,0,0.45)",
      },
      keyframes: {
        "pop-in": {
          "0%": { opacity: "0", transform: "scale(0.92)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "float-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "pop-in": "pop-in 0.18s ease-out",
        "float-up": "float-up 0.25s ease-out",
        shimmer: "shimmer 1.6s linear infinite",
      },
    },
  },
  plugins: [],
};
export default config;
