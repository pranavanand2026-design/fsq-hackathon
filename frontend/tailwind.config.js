/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          base:    "#F3F7FF",
          panel:   "#FFFFFF",
          elevated:"#EBF1FB",
          border:  "#D8E2F0",
        },
        fg: {
          primary:   "#111827",
          secondary: "#64748B",
          tertiary:  "#94A3B8",
        },
        brand: {
          50:  "#EEF4FF",
          100: "#DBEAFE",
          300: "#1174FB",
          400: "#0065F0",
          500: "#0049AD",
          600: "#003A8A",
          700: "#002D6B",
        },
        accent: {
          DEFAULT: "#F5A623",
          dim:     "rgba(245, 166, 35, 0.12)",
        },
        score: {
          high:   "#3BB273",
          mid:    "#F5A623",
          low:    "#E85D5D",
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
        display: [
          "Space Grotesk",
          "Inter",
          "ui-sans-serif",
          "sans-serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      fontFeatureSettings: {
        tabular: '"tnum"',
      },
      boxShadow: {
        panel: "0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -2px rgba(0,0,0,0.04)",
        card:  "0 2px 8px rgba(0,0,0,0.06)",
      },
    },
  },
  plugins: [],
};
