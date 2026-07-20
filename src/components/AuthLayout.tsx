import { LanguageSwitch } from '@/components/LanguageSwitch';
import type { Locale } from '@/i18n/config';
import type { ReactNode } from 'react';

interface AuthLayoutDict {
  name: string;
  tagline: string;
  brandStatement: string;
}

/**
 * Shared split-screen shell for every authentication screen (login,
 * password change, and any future auth-adjacent screen) — one visual
 * language instead of each page rebuilding its own layout. Form panel is
 * first in DOM so it lands at the reading-start edge in both directions
 * (right in RTL, left in LTR) with no conditional layout logic; the brand
 * panel takes the opposite side automatically.
 */
export function AuthLayout({
  locale,
  languageSwitchPath,
  dict,
  footer,
  children,
}: {
  locale: Locale;
  languageSwitchPath: string;
  dict: AuthLayoutDict;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-col md:flex-row">
      <div className="flex flex-1 flex-col justify-between px-6 py-8 sm:px-12 md:w-[42%] md:px-16 md:py-12">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold tracking-wide text-ink md:hidden">{dict.name}</span>
          <div className="hidden md:block" />
          <LanguageSwitch locale={locale} path={languageSwitchPath} />
        </div>

        <div className="mx-auto w-full max-w-sm">{children}</div>

        <p className="text-center text-xs text-ink-muted/80 md:text-start">{footer}</p>
      </div>

      <div className="relative hidden overflow-hidden bg-primary md:flex md:w-[58%] md:flex-col md:items-center md:justify-center md:px-16">
        <BrandPattern />
        <div className="relative z-10 max-w-md text-center">
          <p className="text-3xl font-semibold tracking-tight text-white">{dict.name}</p>
          <p className="mt-3 text-lg text-white/80">{dict.tagline}</p>
          <p className="mt-6 text-sm leading-relaxed text-white/60">{dict.brandStatement}</p>
        </div>
      </div>
    </main>
  );
}

/** Subtle architectural arch motif at low opacity — see AuthLayout's own doc comment for why (calm hospitality atmosphere, not a SaaS gradient). */
function BrandPattern() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.07]"
      viewBox="0 0 800 800"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <path
          key={i}
          d={`M ${i * 140 - 100} 800 L ${i * 140 - 100} 420 A 100 100 0 0 1 ${i * 140 + 100} 420 L ${i * 140 + 100} 800`}
          fill="none"
          stroke="hsl(var(--accent))"
          strokeWidth="1.5"
        />
      ))}
    </svg>
  );
}
