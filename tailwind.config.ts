import type { Config } from 'tailwindcss';

/**
 * Design tokens are intentionally minimal at this stage (Phase 1, M1).
 * UX_SYSTEM.md's visual language (Apple/Linear/Stripe/Tesla mission-control
 * references) will be translated into finalized tokens before Mission
 * Control screens are built (see DECISIONS.md D11 consequences) — this file
 * is the seam they land in, not the final system.
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
        accent: {
          DEFAULT: 'hsl(var(--accent))',
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
