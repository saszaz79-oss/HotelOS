import type { Metadata } from 'next';
import { locales, defaultLocale, dirFor, type Locale } from '@/i18n/config';
import '../globals.css';

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
    <html lang={locale} dir={dir}>
      <body>{children}</body>
    </html>
  );
}
