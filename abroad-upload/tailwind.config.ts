import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1B1D3A",
        muted: "#6B6D80",
        canvas: "#F8F7F4",
        line: "#E7E6EE",
        primary: { DEFAULT: "#2B2F7E", dark: "#22256A", light: "#4A3FA0" },
        lavender: { DEFAULT: "#E5E5FA", soft: "#F1F1FC" },
        sand: "#F3F1EC",
        cat: {
          class: "#2B2F7E",
          exam: "#E0242E",
          assignment: "#E08A2E",
          admin: "#1F8FCF",
          travel: "#1A9E6E",
          social: "#B357C4",
        },
        success: "#4CB582",
        star: "#E08A2E",
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: { "4xl": "2rem" },
      boxShadow: { card: "0 1px 2px rgba(27,29,58,0.04), 0 4px 16px rgba(27,29,58,0.04)" },
    },
  },
  plugins: [],
} satisfies Config;
