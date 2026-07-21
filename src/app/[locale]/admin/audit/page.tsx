import { getDictionary, locales, defaultLocale, type Locale } from '@/i18n/config';
import { prisma } from '@/lib/prisma';
import { TableShell, tableHeadRowClass, tableHeadCellClass, tableRowClass, tableCellClass } from '@/components/ui/TableShell';
import { EmptyState } from '@/components/ui/EmptyState';

export default async function AdminAuditPage(props: { params: Promise<{ locale: string }> }) {
  const params = await props.params;
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  const dict = getDictionary(locale);

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { user: { select: { displayName: true, username: true } }, hotel: { select: { name: true } } },
  });

  return (
    <div className="max-w-4xl space-y-4">
      <h1 className="text-xl font-semibold text-ink">{dict.admin.audit.title}</h1>
      {logs.length === 0 ? (
        <EmptyState title={dict.reportsArchive.noResults} />
      ) : (
        <TableShell>
          <table className="w-full text-sm">
            <thead>
              <tr className={tableHeadRowClass}>
                <th className={tableHeadCellClass}>{dict.admin.audit.action}</th>
                <th className={tableHeadCellClass}>{dict.admin.audit.user}</th>
                <th className={tableHeadCellClass}>{dict.admin.audit.hotel}</th>
                <th className={tableHeadCellClass}>{dict.admin.audit.timestamp}</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className={tableRowClass}>
                  <td className={`${tableCellClass} font-mono text-xs text-ink`}>{l.action}</td>
                  <td className={`${tableCellClass} text-ink`}>{l.user.displayName}</td>
                  <td className={`${tableCellClass} text-ink-muted`}>{l.hotel?.name ?? '—'}</td>
                  <td className={`${tableCellClass} text-ink-muted`}>{new Date(l.createdAt).toLocaleString(locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      )}
    </div>
  );
}
