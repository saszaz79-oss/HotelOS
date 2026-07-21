import { getDictionary, locales, defaultLocale, type Locale } from '@/i18n/config';
import { TableShell, tableHeadRowClass, tableHeadCellClass, tableRowClass, tableCellClass } from '@/components/ui/TableShell';

const ROLES = [
  { role: 'SUPER_ADMIN (Platform Owner)', scope: 'All hotels', permissions: 'Full platform administration: create/suspend/archive hotels, manage all users, view/compare any hotels, full audit log, Support Access. Not a per-hotel membership — a User.isSuperAdmin flag.' },
  { role: 'HOTEL_ADMIN', scope: 'Assigned hotel(s)', permissions: 'Manage users within assigned hotel(s); manage hotel profile; upload/review reports; full Mission Control, Timeline, AI access within assigned hotel(s).' },
  { role: 'GENERAL_MANAGER', scope: 'Assigned hotel(s)', permissions: 'Full read + AI + comparison access; upload reports; cannot manage users.' },
  { role: 'FRONT_OFFICE_MANAGER', scope: 'Assigned hotel(s)', permissions: 'Mission Control, today\'s operational metrics, upload reports; limited AI scope.' },
  { role: 'REVENUE_MANAGER', scope: 'Assigned hotel(s)', permissions: 'Full metrics, comparisons, AI; upload reports; no user management.' },
  { role: 'ANALYST', scope: 'Assigned hotel(s)', permissions: 'Read + AI; upload reports; no user management, no hotel profile edit.' },
  { role: 'READ_ONLY', scope: 'Assigned hotel(s)', permissions: 'View Mission Control, Timeline; no upload, no write actions.' },
];

export default async function AdminRolesPage(props: { params: Promise<{ locale: string }> }) {
  const params = await props.params;
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  const dict = getDictionary(locale);

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-ink">{dict.admin.roles.title}</h1>
        <p className="mt-1 text-sm text-ink-muted">{dict.admin.roles.note}</p>
      </div>
      <TableShell>
        <table className="w-full text-sm">
          <thead>
            <tr className={tableHeadRowClass}>
              <th className={tableHeadCellClass}>{dict.admin.roles.columnRole}</th>
              <th className={tableHeadCellClass}>{dict.admin.roles.columnScope}</th>
              <th className={tableHeadCellClass}>{dict.admin.roles.columnPermissions}</th>
            </tr>
          </thead>
          <tbody>
            {ROLES.map((r) => (
              <tr key={r.role} className={tableRowClass}>
                <td className={`${tableCellClass} align-top font-medium text-ink`}>{r.role}</td>
                <td className={`${tableCellClass} align-top text-ink-muted`}>{r.scope}</td>
                <td className={`${tableCellClass} align-top text-ink-muted`}>{r.permissions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>
    </div>
  );
}
