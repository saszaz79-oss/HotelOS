import { ImageResponse } from 'next/og';
import { BRAND_NAVY, BRAND_GOLD } from '@/lib/brand-colors';

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
          fontSize: 310,
          fontWeight: 700,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        H
      </div>
    ),
    { width: 512, height: 512 }
  );
}
