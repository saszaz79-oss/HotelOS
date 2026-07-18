import Link from 'next/link';
import { getDictionary, locales, defaultLocale, type Locale } from '@/i18n/config';
import { listUsers } from '@/server/modules/users/queries';

export default async function AdminUsersPage({ params }: { params: { locale: string } }) {
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  const dict = getDictionary(locale);
  const users = await listUsers();

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium">{dict.admin.users.title}</h1>
        <Link href={`/${locale}/admin/users/new`} className="rounded-md bg-accent px-4 py-2 text-sm text-white">
          {dict.admin.users.create}
        </Link>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ink/10 text-start text-ink-muted">
            <th className="py-2 text-start">{dict.admin.users.username}</th>
            <th className="py-2 text-start">{dict.admin.users.displayName}</th>
            <th className="py-2 text-start">{dict.admin.users.hotel}</th>
            <th className="py-2 text-start">{dict.admin.users.role}</th>
            <th className="py-2 text-start">Status</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-ink/5">
              <td className="py-2">
                <Link href={`/${locale}/admin/users/${u.id}`} className="text-accent hover:underline">
                  {u.username}
                </Link>
              </td>
              <td className="py-2">{u.displayName}</td>
              <td className="py-2">
                {u.isSuperAdmin ? 'All hotels (Platform Owner)' : u.memberships.map((m) => m.hotel.name).join(', ') || '—'}
              </td>
              <td className="py-2">{u.isSuperAdmin ? 'SUPER_ADMIN' : u.memberships.map((m) => m.role).join(', ') || '—'}</td>
              <td className="py-2">{u.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
