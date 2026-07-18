import { NextRequest, NextResponse } from 'next/server';
import { locales, defaultLocale } from '@/i18n/config';

const PUBLIC_FILE = /\.(.*)$/;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  const hasLocale = locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
  );

  if (!hasLocale) {
    const cookieLocale = request.cookies.get('hotelos_locale')?.value;
    const locale = locales.includes(cookieLocale as (typeof locales)[number])
      ? cookieLocale
      : defaultLocale;
    return NextResponse.redirect(new URL(`/${locale}${pathname}`, request.url));
  }

  // Session presence check only — full role/hotel authorization is re-checked
  // server-side at the data-access layer (Architecture §5: defense in depth,
  // middleware is a UX convenience, never the security boundary).
  const isAuthRoute = pathname.match(/^\/(ar|en)\/login/);
  const sessionCookie = request.cookies.get('hotelos_session')?.value;

  if (!isAuthRoute && !sessionCookie) {
    const locale = pathname.split('/')[1];
    return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|api|.*\\..*).*)'],
};
