/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          base:    "#0B0E14",
          panel:   "#141922",
          elevated:"#1B2230",
          border:  "#262E3D",
        },
        fg: {
          primary:   "#E6EAF2",
          secondary: "#9BA3B4",
          tertiary:  "#636B7A",
        },
        accent: {
          DEFAULT: "#10B981",
          dim:     "#064E3B",
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
        panel: "0 6px 40px rgba(0,0,0,0.4)",
      },
    },
  },
  plugins: [],
};
