import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "var(--ink)",
        paper: "var(--paper)",
        "paper-raised": "var(--paper-raised)",
        accent: "var(--accent)",
        "accent-ink": "var(--accent-ink)",
        verify: "var(--verify)",
        line: "var(--line)",
        muted: "var(--muted)",
        text: "var(--text)",
        "text-soft": "var(--text-soft)",
        card: "var(--card)",
      },
      fontFamily: {
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "SF Mono",
          "Consolas",
          "Liberation Mono",
          "monospace",
        ],
      },
      borderRadius: {
        DEFAULT: "2px",
      },
    },
  },
  plugins: [],
};

export default config;
