import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        ink: 'var(--ink)',
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: '#FFFFFF',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: '#FFFFFF',
        },
        accent: 'var(--accent)',
        surface: {
          DEFAULT: 'var(--surface)',
          border: 'var(--surface-border)',
        },
        danger: 'var(--danger)',
        warning: 'var(--warning)',
        border: 'var(--surface-border)',
        input: 'var(--surface-border)',
        ring: 'var(--primary)',
      },
      borderRadius: {
        card: '12px',
        control: '8px',
      },
      fontFamily: {
        serif: ['var(--font-fraunces)', 'Georgia', 'serif'],
        sans: ['var(--font-inter)', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        sm: ['14px', { lineHeight: '1.5' }],
        base: ['16px', { lineHeight: '1.5' }],
        lg: ['20px', { lineHeight: '1.5' }],
        '2xl': ['28px', { lineHeight: '1.3' }],
        '3xl': ['36px', { lineHeight: '1.2' }],
      },
      spacing: {
        // 8-pt spacing grid reference aliases
        'grid-1': '8px',
        'grid-2': '16px',
        'grid-3': '24px',
        'grid-4': '32px',
        'grid-5': '40px',
        'grid-6': '48px',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
