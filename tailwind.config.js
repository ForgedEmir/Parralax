/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "Segoe UI", "Arial", "sans-serif"],
        mono: ["IBM Plex Mono", "Cascadia Code", "Consolas", "monospace"],
      },
      colors: {
        ink: "#141712",
        paper: "#f3f3ed",
        acid: "#d7f64a",
        signal: "#ef5a47",
        cyan: "#4ecdc4",
      },
    },
  },
  plugins: [],
};
