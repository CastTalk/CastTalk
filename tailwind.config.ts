import type { Config } from 'tailwindcss';

const config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: '',
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: '#004bff',
          foreground: '#ffffff',
        },
        secondary: {
          DEFAULT: '#110b21',
          foreground: '#ffffff',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: '#f4f4f7',
          foreground: '#64748b',
        },
        accent: {
          DEFAULT: '#f4f4f7',
          foreground: '#110b21',
        },
        popover: {
          DEFAULT: '#ffffff',
          foreground: '#110b21',
        },
        card: {
          DEFAULT: '#ffffff',
          foreground: '#110b21',
        },
        blue: {
          1: '#004bff',
        },
        dark: {
          1: '#110b21',
          2: '#1a142e',
          3: '#25203d',
        }
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        geist: ['var(--font-geist-sans)', 'sans-serif'],
        charlie: ['Charlie Sans', 'sans-serif'],
        sans: ['var(--font-geist-sans)', 'sans-serif'],
        heading: ['Charlie Sans', 'sans-serif'],
      },
      letterSpacing: {
        tightest: '-.06em',
        tighter: '-.04em',
        tight: '-.02em',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        ripple: {
          '0%, 100%': {
            transform: 'translate(-50%, -50%) scale(1)',
            opacity: '0.5',
          },
          '50%': {
            transform: 'translate(-50%, -50%) scale(1.3)',
            opacity: '0.3',
          },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        ripple: 'ripple 3s ease-in-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;

export default config;
