/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/popup/index.html",
    "./src/sidepanel/index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0284c7',
          600: '#0369a1',
          700: '#075985',
          800: '#0c4a6e',
          900: '#082f49',
          bbGold: '#F5A623',
          bbDark: '#12161A',
        },
        urgency: {
          overdue: '#EF4444',
          today: '#F43F5E',
          soon: '#F59E0B',
          later: '#10B981',
        }
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.25)',
        'glow-brand': '0 0 16px -2px rgba(2, 132, 199, 0.4)',
        'glow-overdue': '0 0 14px -2px rgba(239, 68, 68, 0.4)',
      }
    },
  },
  plugins: [],
}
