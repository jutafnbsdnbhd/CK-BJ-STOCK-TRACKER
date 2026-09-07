/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        base: "#f7f5f1",
        accent: "#9c7a3c",
        "accent-dark": "#7d6130",
        ink: "#2b2622",
        muted: "#7a7168",
        line: "#e6e1d8",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
};
