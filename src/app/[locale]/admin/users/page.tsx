import Link from 'next/link';
import { getDictionary, locales, defaultLocale, type Locale } from '@/i18n/config';
import { listUsers } from '@/server/modules/users/queries';
import type { UserStatus } from '@prisma/client';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { userStatusTone } from '@/lib/status-tone';

const STATUS_VALUES: UserStatus[] = ['active', 'disabled'];

function roleSummary(u: { isSuperAdmin: boolean; memberships: { role: string; hotel: { name: string } }[] }): string {
  if (u.isSuperAdmin) return 'SUPER_ADMIN';
  return u.memberships.map((m) => m.role).join(', ') || '—';
}

function hotelSummary(u: { isSuperAdmin: boolean; memberships: { hotel: { name: string } }[] }, allHotelsLabel: string): string {
  if (u.isSuperAdmin) return allHotelsLabel;
  return u.memberships.map((m) => m.hotel.name).join(', ') || '—';
}

export default async function AdminUsersPage(
  props: {
    params: Promise<{ locale: string }>;
    searchParams: Promise<{ q?: string; status?: string }>;
  }
) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  const dict = getDictionary(locale);

  const search = searchParams.q?.trim() || undefined;
  const statusFilter = STATUS_VALUES.includes(searchParams.status as UserStatus)
    ? (searchParams.status as UserStatus)
    : undefined;

  const users = await listUsers({ search, status: statusFilter });
  const allHotelsLabel = locale === 'ar' ? 'كل الفنادق (مالك المنصة)' : 'All hotels (Platform Owner)';

  const filterOptions: { value: string; label: string }[] = [
    { value: '', label: dict.admin.users.filterAll },
    { value: 'active', label: dict.admin.users.filterActive },
    { value: 'disabled', label: dict.admin.users.filterDisabled },
  ];

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-medium text-ink">{dict.admin.users.title}</h1>
        <Link href={`/${locale}/admin/users/new`} className="rounded-md bg-accent px-4 py-2 text-sm text-white hover:bg-accent-hover">
          {dict.admin.users.create}
        </Link>
      </div>

      <form className="flex flex-wrap gap-2" action={`/${locale}/admin/users`}>
        <input
          type="text"
          name="q"
          defaultValue={search}
          placeholder={dict.admin.users.searchPlaceholder}
          className="min-w-[220px] flex-1 rounded-md border border-ink/15 bg-surface-raised px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        <select
          name="status"
          defaultValue={statusFilter ?? ''}
          className="rounded-md border border-ink/15 bg-surface-raised px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        >
          {filterOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-md border border-ink/15 bg-surface-raised px-4 py-2 text-sm text-ink hover:bg-surface">
          {dict.admin.users.searchPlaceholder.split(' ')[0]}
        </button>
      </form>

      {users.length === 0 ? (
        <EmptyState title={dict.admin.users.noResults} />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-lg border border-ink/10 md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink/10 bg-surface-raised text-start text-ink-muted">
                  <th className="px-4 py-2.5 text-start">{dict.admin.users.username}</th>
                  <th className="px-4 py-2.5 text-start">{dict.admin.users.displayName}</th>
                  <th className="px-4 py-2.5 text-start">{dict.admin.users.hotel}</th>
                  <th className="px-4 py-2.5 text-start">{dict.admin.users.role}</th>
                  <th className="px-4 py-2.5 text-start">{dict.admin.users.status}</th>
                  <th className="px-4 py-2.5 text-start">{dict.admin.users.lastLogin}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-ink/5 last:border-0">
                    <td className="px-4 py-2.5">
                      <Link href={`/${locale}/admin/users/${u.id}`} className="text-ink hover:text-accent hover:underline">
                        {u.username}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-ink-muted">{u.displayName}</td>
                    <td className="px-4 py-2.5 text-ink-muted">{hotelSummary(u, allHotelsLabel)}</td>
                    <td className="px-4 py-2.5 text-ink-muted">{roleSummary(u)}</td>
                    <td className="px-4 py-2.5">
                      <StatusBadge tone={userStatusTone(u.status)}>{u.status}</StatusBadge>
                    </td>
                    <td className="px-4 py-2.5 text-ink-muted">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString(locale) : dict.admin.users.never}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {users.map((u) => (
              <Card key={u.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/${locale}/admin/users/${u.id}`} className="font-medium text-ink hover:text-accent hover:underline">
                    {u.displayName}
                  </Link>
                  <StatusBadge tone={userStatusTone(u.status)}>{u.status}</StatusBadge>
                </div>
                <p className="mt-1 text-xs text-ink-muted">
                  {u.username} · {roleSummary(u)}
                </p>
                <p className="mt-1 text-xs text-ink-muted">{hotelSummary(u, allHotelsLabel)}</p>
                <p className="mt-2 text-xs text-ink-muted">
                  {dict.admin.users.lastLogin}: {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString(locale) : dict.admin.users.never}
                </p>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
