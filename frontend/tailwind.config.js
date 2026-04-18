/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          base:    "#F3F4F6",
          panel:   "#FFFFFF",
          elevated:"#F9FAFB",
          border:  "#E5E7EB",
        },
        fg: {
          primary:   "#111827",
          secondary: "#4B5563",
          tertiary:  "#9CA3AF",
        },
        accent: {
          DEFAULT: "#10B981",
          dim:     "rgba(16, 185, 129, 0.15)",
        },
        score: {
          high:   "#10B981",
          mid:    "#F59E0B",
          low:    "#EF4444",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      fontFeatureSettings: {
        tabular: '"tnum"',
      },
      boxShadow: {
        panel: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
      },
    },
  },
  plugins: [],
};
