/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "#0F0F0F",
                surface: "#1A1A1A",
                primary: "#FF0000", // YouTube Red
                darkRed: "#8B0000",
            },
            backdropBlur: {
                xs: '2px',
            }
        },
    },
    plugins: [],
}
