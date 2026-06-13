/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17120f",
        cream: "#fff9ed",
        corn: "#ffc83d",
        tomato: "#ed5038",
      },
      fontFamily: {
        display: ["Arial Black", "Arial", "sans-serif"],
        body: ["Inter", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};
