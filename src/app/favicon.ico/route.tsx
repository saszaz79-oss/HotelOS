import { ImageResponse } from 'next/og';
import { BRAND_NAVY, BRAND_GOLD } from '@/lib/brand-colors';

// Route handler, not the static-file convention — browsers hard-request
// /favicon.ico regardless of the <link rel="icon"> from icon.tsx, and with
// no file here that request fell through to the [locale] catch-all route
// (locale="favicon.ico" -> normalized away -> a stray redirect to
// /favicon.ico/login on every single page load).
export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: BRAND_NAVY,
          color: BRAND_GOLD,
          fontSize: 20,
          fontWeight: 700,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        H
      </div>
    ),
    { width: 32, height: 32 }
  );
}
