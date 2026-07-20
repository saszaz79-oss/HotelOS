import type { Metadata } from 'next';
import { Inter, Cairo } from 'next/font/google';
import { locales, defaultLocale, dirFor, type Locale } from '@/i18n/config';
import '../globals.css';

/**
 * Enterprise design system, Phase 1 (v2): the CSS custom properties in
 * globals.css referenced 'Inter'/'IBM Plex Sans Arabic' by name since the
 * project's earliest commit, but nothing ever actually loaded them — every
 * screen has been rendering in the browser's system-ui fallback the whole
 * time. next/font self-hosts both (no external request at runtime, no
 * layout shift) and exposes them as the same --font-sans/--font-arabic
 * variables globals.css already consumes, so no other file needs to change.
 */
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-arabic',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'HotelOS',
  description: 'The Intelligent Operating System for Hotels',
  manifest: '/manifest.json',
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout(
  props: {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
  }
) {
  const params = await props.params;

  const {
    children
  } = props;

  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  const dir = dirFor(locale);

  return (
    <html lang={locale} dir={dir} className={`${inter.variable} ${cairo.variable}`}>
      <body>
        {/* Runs before first paint to apply any explicitly-stored theme choice, avoiding a flash of the wrong theme. No-op (falls through to the CSS prefers-color-scheme default) when the visitor has never toggled. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('hotelos-theme');if(t==='dark'||t==='light'){document.documentElement.classList.add(t);}}catch(e){}",
          }}
        />
        {children}
      </body>
    </html>
  );
}
