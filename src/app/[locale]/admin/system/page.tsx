import { getDictionary, locales, defaultLocale, type Locale } from '@/i18n/config';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import packageJson from '../../../../../package.json';

async function checkDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

export default async function AdminSystemPage({ params }: { params: { locale: string } }) {
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  const dict = getDictionary(locale);

  const dbConnected = await checkDatabase();
  const aiConfigured = Boolean(process.env.ANTHROPIC_API_KEY);

  const rows: { label: string; value: string; ok: boolean }[] = [
    { label: dict.admin.system.database, value: dbConnected ? dict.admin.system.connected : dict.admin.system.unreachable, ok: dbConnected },
    { label: dict.admin.system.storage, value: env.STORAGE_DRIVER, ok: true },
    { label: dict.admin.system.aiProvider, value: `${env.AI_PROVIDER} — ${aiConfigured ? dict.admin.system.configured : dict.admin.system.notConfigured}`, ok: aiConfigured },
    { label: dict.admin.system.notifications, value: `${env.NOTIFICATION_DRIVER} (mock — Roadmap v0.2 for real delivery)`, ok: true },
  ];

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-lg font-medium">{dict.admin.system.title}</h1>

      <table className="w-full text-sm">
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-ink/5">
              <td className="py-2 text-ink-muted">{r.label}</td>
              <td className={'py-2 ' + (r.ok ? 'text-status-positive' : 'text-status-critical')}>{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div>
        <h2 className="text-sm font-medium text-ink-muted">{dict.admin.system.version}</h2>
        <p className="metric-value mt-1">
          v{packageJson.version} — {dict.admin.system.environment}: {process.env.NODE_ENV}
        </p>
        <p className="mt-1 text-xs text-ink-muted">
          Git commit: {process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? 'unknown (no CI environment variable set)'}
        </p>
      </div>
    </div>
  );
}
