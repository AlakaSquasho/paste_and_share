/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: '#171717',
        coal: '#404040',
        accent: '#D4AF37',
        sand: '#F7F4EE',
        night: '#0B0B0B',
      },
      fontFamily: {
        sans: ['"Fira Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"Fira Code"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        soft: '0 12px 40px -20px rgba(23, 23, 23, 0.35)',
      },
    },
  },
  plugins: [],
}
