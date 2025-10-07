/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'neon-green': '#00ff88',
        'deep-purple': '#8a2be2',
        'dark-purple': '#1a0a2e',
        'dark-blue': '#0f3460',
        'purple': {
          400: '#a855f7',
          500: '#8b5cf6',
          600: '#7c3aed',
          900: '#581c87',
        },
        'green': {
          400: '#4ade80',
          500: '#22c55e',
          900: '#14532d',
        },
      },
      backgroundImage: {
        'gradient-main': 'linear-gradient(135deg, #0a0a0a 0%, #1a0a1a 25%, #0a1a0a 75%, #000000 100%)',
        'gradient-card': 'linear-gradient(135deg, rgba(26, 10, 46, 0.9) 0%, rgba(15, 52, 96, 0.9) 100%)',
        'gradient-button': 'linear-gradient(135deg, #8a2be2 0%, #00ff88 100%)',
        'gradient-text': 'linear-gradient(135deg, #00ff88 0%, #8a2be2 100%)',
      },
      backdropBlur: {
        'xs': '2px',
      }
    },
  },
  plugins: [],
}