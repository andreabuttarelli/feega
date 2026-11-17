import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';

const config: Config = {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        brand: { 50: '#eff6ff', 500: '#3b82f6', 900: '#1e3a8a', DEFAULT: '#3b82f6' },
        ink: '#111827',
        surface: 'hsl(var(--background))'
      },
      spacing: { gutter: '1.5rem', 18: '4.5rem' },
      borderRadius: { card: '0.75rem', pill: '9999px' },
      fontFamily: { sans: ['Inter', ...defaultTheme.fontFamily.sans], display: ['Fraunces', 'serif'] },
      fontSize: { hero: ['3rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '700' }], small: ['0.8125rem', '1.25rem'] },
      boxShadow: { card: '0 1px 3px rgb(0 0 0 / 0.12)', pop: '0 8px 24px rgb(0 0 0 / 0.18)' },
      screens: { tablet: '768px', desktop: '1280px' }
    }
  }
};

export default config;
