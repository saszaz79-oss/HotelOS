import type { Config } from 'tailwindcss';

/**
 * Enterprise design system (HotelOS Enterprise v2, Phase 1). Values live in
 * src/app/globals.css as HSL CSS custom properties — this file only maps
 * them to Tailwind utility names, so every existing bg-surface/text-ink/
 * bg-accent/text-status-* class across the app picks up the new palette
 * automatically. `primary` (deep navy) is new, for large brand surfaces
 * built from Phase 2 onward; `accent` (muted gold) keeps its existing role
 * as the interactive/CTA color already used throughout the MVP.
 */
const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: 'hsl(var(--surface))',
          raised: 'hsl(var(--surface-raised))',
        },
        ink: {
          DEFAULT: 'hsl(var(--ink))',
          muted: 'hsl(var(--ink-muted))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          hover: 'hsl(var(--primary-hover))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          hover: 'hsl(var(--accent-hover))',
        },
        status: {
          positive: 'hsl(var(--status-positive))',
          warning: 'hsl(var(--status-warning))',
          critical: 'hsl(var(--status-critical))',
          info: 'hsl(var(--status-info))',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'sans-serif'],
        arabic: ['var(--font-arabic)', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
