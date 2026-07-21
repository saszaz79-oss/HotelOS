import { getDictionary, locales, defaultLocale, type Locale } from '@/i18n/config';
import { prisma } from '@/lib/prisma';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import packageJson from '../../../../../package.json';

async function checkDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

export default async function AdminSystemPage(props: { params: Promise<{ locale: string }> }) {
  const params = await props.params;
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  const dict = getDictionary(locale);

  const dbConnected = await checkDatabase();
  const aiConfigured = Boolean(process.env.ANTHROPIC_API_KEY);

  // Business-friendly status only — no raw provider/driver slugs in the main
  // list (those move to the collapsed technical-details section below).
  const rows: { label: string; value: string; ok: boolean }[] = [
    { label: dict.admin.system.database, value: dbConnected ? dict.admin.system.connected : dict.admin.system.unreachable, ok: dbConnected },
    { label: dict.admin.system.storage, value: dict.admin.system.configured, ok: true },
    { label: dict.admin.system.aiProvider, value: aiConfigured ? dict.admin.system.configured : dict.admin.system.notConfigured, ok: aiConfigured },
    { label: dict.admin.system.notifications, value: dict.admin.system.configured, ok: true },
    { label: dict.admin.system.notificationsExternal, value: dict.admin.system.notificationsExternalNotConfigured, ok: false },
  ];

  const gitCommit = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold text-ink">{dict.admin.system.title}</h1>

      <Card>
        <ul className="divide-y divide-ink/5">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center justify-between py-3 text-sm first:pt-0 last:pb-0">
              <span className="text-ink">{r.label}</span>
              <StatusBadge tone={r.ok ? 'positive' : 'critical'}>{r.value}</StatusBadge>
            </li>
          ))}
        </ul>
      </Card>

      <details className="group rounded-xl border border-ink/10 p-4">
        <summary className="cursor-pointer text-sm font-medium text-ink-muted marker:content-none">
          <span className="inline-flex items-center gap-1.5">
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 transition-transform group-open:rotate-90 rtl:group-open:-rotate-90" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
              <path d="M7 4.5 12.5 10 7 15.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {dict.admin.system.technicalDetails}
          </span>
        </summary>
        <dl className="mt-3 space-y-2 text-xs text-ink-muted">
          <div className="flex items-center justify-between gap-3">
            <dt>{dict.admin.system.version}</dt>
            <dd className="metric-value text-ink">v{packageJson.version}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt>{dict.admin.system.environment}</dt>
            <dd className="metric-value text-ink">{process.env.NODE_ENV}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt>{dict.admin.system.gitCommit}</dt>
            <dd className="metric-value truncate text-ink">{gitCommit ? gitCommit.slice(0, 12) : '—'}</dd>
          </div>
        </dl>
      </details>
    </div>
  );
}
