import { ImageResponse } from 'next/og';
import { BRAND_NAVY, BRAND_GOLD } from '@/lib/brand-colors';

// Stable URL for public/manifest.json's icons array — icon.tsx's own
// output is served at a Next-managed /icon path unsuitable for a static
// manifest reference, so PWA install icons get their own route handler.
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
          fontSize: 116,
          fontWeight: 700,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        H
      </div>
    ),
    { width: 192, height: 192 }
  );
}
