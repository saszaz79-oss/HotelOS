/**
 * Locale metadata only — deliberately has zero dependency on the dictionary
 * JSON files (see config.ts). middleware.ts runs on every single request
 * and only ever needs `locales`/`defaultLocale`, so importing this instead
 * of config.ts keeps the ~37KB combined ar.json/en.json out of the
 * middleware bundle entirely (Perf sprint round 2 — build output showed
 * Middleware at 34.3kB with no other plausible source for that weight).
 */
export const locales = ['ar', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'ar';

export function dirFor(locale: Locale): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}
