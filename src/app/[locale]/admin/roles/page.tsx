import { getDictionary, locales, defaultLocale, type Locale } from '@/i18n/config';

const ROLES = [
  { role: 'SUPER_ADMIN (Platform Owner)', scope: 'All hotels', permissions: 'Full platform administration: create/suspend/archive hotels, manage all users, view/compare any hotels, full audit log, Support Access. Not a per-hotel membership — a User.isSuperAdmin flag.' },
  { role: 'HOTEL_ADMIN', scope: 'Assigned hotel(s)', permissions: 'Manage users within assigned hotel(s); manage hotel profile; upload/review reports; full Mission Control, Timeline, AI access within assigned hotel(s).' },
  { role: 'GENERAL_MANAGER', scope: 'Assigned hotel(s)', permissions: 'Full read + AI + comparison access; upload reports; cannot manage users.' },
  { role: 'FRONT_OFFICE_MANAGER', scope: 'Assigned hotel(s)', permissions: 'Mission Control, today\'s operational metrics, upload reports; limited AI scope.' },
  { role: 'REVENUE_MANAGER', scope: 'Assigned hotel(s)', permissions: 'Full metrics, comparisons, AI; upload reports; no user management.' },
  { role: 'ANALYST', scope: 'Assigned hotel(s)', permissions: 'Read + AI; upload reports; no user management, no hotel profile edit.' },
  { role: 'READ_ONLY', scope: 'Assigned hotel(s)', permissions: 'View Mission Control, Timeline; no upload, no write actions.' },
];

export default function AdminRolesPage({ params }: { params: { locale: string } }) {
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  const dict = getDictionary(locale);

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-lg font-medium">{dict.admin.roles.title}</h1>
      <p className="text-sm text-ink-muted">{dict.admin.roles.note}</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ink/10 text-start text-ink-muted">
            <th className="py-2 text-start">Role</th>
            <th className="py-2 text-start">Scope</th>
            <th className="py-2 text-start">Permissions</th>
          </tr>
        </thead>
        <tbody>
          {ROLES.map((r) => (
            <tr key={r.role} className="border-b border-ink/5 align-top">
              <td className="py-2 font-medium">{r.role}</td>
              <td className="py-2 text-ink-muted">{r.scope}</td>
              <td className="py-2">{r.permissions}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
