import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: "class",
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
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
                "display": ["Manrope", "sans-serif"],
                "sans": ["Manrope", "sans-serif"]
            },
        },
    },
    plugins: [],
};
export default config;
