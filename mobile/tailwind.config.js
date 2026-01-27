/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all of your component files.
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        "primary": "#13ec5b",
        "background-light": "#f6f8f6",
        "background-dark": "#102216",
        "surface-dark": "#15291c",
        "border-light": "#dbe6df",
        "border-dark": "#2a3a2f",
        "text-main": "#111813",
        "text-secondary": "#61896f"
      },
      fontFamily: {
        "display": ["Manrope"],
        "sans": ["Manrope"]
      },
    },
  },
  plugins: [],
}
