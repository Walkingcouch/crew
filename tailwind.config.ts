import type { Config } from "tailwindcss";

// Crew design tokens. Per-role accent colours are used via role/[colour]
// utility classes (e.g. text-role-pro, bg-role-manager) rather than a
// separate Tailwind theme per surface, so the same component library
// works across all six role surfaces.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        crew: {
          green: "#1a4d33",
          "green-light": "#4db37c",
          amber: "#c47b0a",
          red: "#b91c1c",
          ink: "#231f1a",
        },
        role: {
          customer: "#1a4d33",
          pro: "#1e5aa8",
          manager: "#5b2d8e",
          field: "#c47b0a",
          supervisor: "#0e7d6b",
          command: "#231f1a",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Inter",
          "sans-serif",
        ],
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};

export default config;
