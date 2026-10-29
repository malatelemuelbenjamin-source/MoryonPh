/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Marinduque-inspired palette: ocean, coastline, Moriones terracotta
        ocean: {
          50: '#eef9fb',
          100: '#d2eef3',
          200: '#a6dde8',
          300: '#6ec5d6',
          400: '#38a8c0',
          500: '#1f8aa6',
          600: '#176c8a',
          700: '#155571',
          800: '#16485d',
          900: '#143c4c',
          950: '#0a2735',
        },
        terra: {
          50: '#fbf5ef',
          100: '#f6e4d3',
          200: '#ecc6a8',
          300: '#e0a376',
          400: '#d68047',
          500: '#c7662f',
          600: '#a84e25',
          700: '#843c21',
          800: '#6b321f',
          900: '#572a1c',
        },
        sand: {
          50: '#faf8f3',
          100: '#f3eee1',
          200: '#e7dcc1',
          300: '#d8c49b',
          400: '#c7ab73',
          500: '#b8965a',
        },
        leaf: {
          400: '#5cbf7f',
          500: '#3ba366',
          600: '#2d854f',
          700: '#246a40',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 2px 12px -2px rgba(20, 60, 76, 0.08), 0 1px 3px -1px rgba(20, 60, 76, 0.06)',
        cardHover: '0 8px 24px -6px rgba(20, 60, 76, 0.18)',
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
    },
  },
  plugins: [],
}
