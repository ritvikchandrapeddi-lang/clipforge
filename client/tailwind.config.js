/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: '#0B0F17',
          secondary: '#111827',
          tertiary: '#1A2234',
          card: '#131B2E',
          cardHover: '#1B253D',
        },
        electric: {
          50: '#EBF5FF',
          100: '#D6EBFF',
          400: '#38BDF8',
          500: '#0066FF',
          600: '#0052CC',
          glow: '#00D2FF',
        },
        accent: {
          cyan: '#06B6D4',
          purple: '#8B5CF6',
          emerald: '#10B981',
          amber: '#F59E0B',
          rose: '#EF4444',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'glow-sm': '0 0 15px rgba(0, 102, 255, 0.25)',
        'glow-md': '0 0 25px rgba(0, 102, 255, 0.35)',
        'glow-cyan': '0 0 20px rgba(6, 182, 212, 0.3)',
      }
    },
  },
  plugins: [],
}

