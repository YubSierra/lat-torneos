/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        lat: {
          dark:   '#1B3A1B',
          green:  '#2D6A2D',
          light:  '#4CAF50',
          accent: '#8BC34A',
          bg:     '#F4F7F4',
        }
      }
    },
  },
  plugins: [],
}