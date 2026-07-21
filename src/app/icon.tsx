import { ImageResponse } from 'next/og';
import { BRAND_NAVY, BRAND_GOLD } from '@/lib/brand-colors';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
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
          borderRadius: 7,
          color: BRAND_GOLD,
          fontSize: 20,
          fontWeight: 700,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        H
      </div>
    ),
    { ...size }
  );
}
