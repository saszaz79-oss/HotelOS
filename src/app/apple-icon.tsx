import { ImageResponse } from 'next/og';
import { BRAND_NAVY, BRAND_GOLD } from '@/lib/brand-colors';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
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
          fontSize: 104,
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
