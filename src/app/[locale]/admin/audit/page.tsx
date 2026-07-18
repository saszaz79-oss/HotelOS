import { getDictionary, locales, defaultLocale, type Locale } from '@/i18n/config';
import { prisma } from '@/lib/prisma';

export default async function AdminAuditPage({ params }: { params: { locale: string } }) {
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  const dict = getDictionary(locale);

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { user: { select: { displayName: true, username: true } }, hotel: { select: { name: true } } },
  });

  return (
    <div className="max-w-4xl space-y-4">
      <h1 className="text-lg font-medium">{dict.admin.audit.title}</h1>
      {logs.length === 0 ? (
        <p className="text-sm text-ink-muted">No audit entries yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-start text-ink-muted">
              <th className="py-2 text-start">{dict.admin.audit.action}</th>
              <th className="py-2 text-start">{dict.admin.audit.user}</th>
              <th className="py-2 text-start">{dict.admin.audit.hotel}</th>
              <th className="py-2 text-start">{dict.admin.audit.timestamp}</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-b border-ink/5">
                <td className="py-2 font-mono text-xs">{l.action}</td>
                <td className="py-2">{l.user.displayName}</td>
                <td className="py-2">{l.hotel?.name ?? '—'}</td>
                <td className="py-2 text-ink-muted">{new Date(l.createdAt).toLocaleString(locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
