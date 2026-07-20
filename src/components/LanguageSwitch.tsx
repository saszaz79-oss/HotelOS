import Link from 'next/link';
import { cn } from '@/lib/cn';
import type { Locale } from '@/i18n/config';

/**
 * `path` is everything after the locale segment (e.g. "/login") — the
 * caller already knows its own route, so this stays a simple server
 * component instead of reading the pathname on the client.
 */
export function LanguageSwitch({ locale, path }: { locale: Locale; path: string }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-ink/10 bg-surface-raised p-1 text-xs">
      <Link
        href={`/ar${path}`}
        className={cn(
          'rounded-full px-3 py-1 transition-colors',
          locale === 'ar' ? 'bg-primary text-white' : 'text-ink-muted hover:text-ink'
        )}
      >
        العربية
      </Link>
      <Link
        href={`/en${path}`}
        className={cn(
          'rounded-full px-3 py-1 transition-colors',
          locale === 'en' ? 'bg-primary text-white' : 'text-ink-muted hover:text-ink'
        )}
      >
        English
      </Link>
    </div>
  );
}
