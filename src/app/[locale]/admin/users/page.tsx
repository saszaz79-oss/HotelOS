import Link from 'next/link';
import { getDictionary, locales, defaultLocale, type Locale } from '@/i18n/config';
import { listUsers } from '@/server/modules/users/queries';
import type { UserStatus } from '@prisma/client';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { TableShell, tableHeadRowClass, tableHeadCellClass, tableRowClass, tableCellClass } from '@/components/ui/TableShell';
import { userStatusTone } from '@/lib/status-tone';

const filterFieldClass =
  'rounded-lg border border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg))] px-3 py-2 text-sm backdrop-blur-xl transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30';

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
        <h1 className="text-lg font-semibold text-ink">{dict.admin.users.title}</h1>
        <Link href={`/${locale}/admin/users/new`}>
          <Button size="sm">{dict.admin.users.create}</Button>
        </Link>
      </div>

      <form className="flex flex-wrap gap-2" action={`/${locale}/admin/users`}>
        <input
          type="text"
          name="q"
          defaultValue={search}
          placeholder={dict.admin.users.searchPlaceholder}
          className={`min-w-[220px] flex-1 ${filterFieldClass}`}
        />
        <select name="status" defaultValue={statusFilter ?? ''} className={filterFieldClass}>
          {filterOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <Button type="submit" variant="secondary" size="sm">
          {dict.admin.users.searchPlaceholder.split(' ')[0]}
        </Button>
      </form>

      {users.length === 0 ? (
        <EmptyState title={dict.admin.users.noResults} />
      ) : (
        <>
          <TableShell className="hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className={tableHeadRowClass}>
                  <th className={tableHeadCellClass}>{dict.admin.users.username}</th>
                  <th className={tableHeadCellClass}>{dict.admin.users.displayName}</th>
                  <th className={tableHeadCellClass}>{dict.admin.users.hotel}</th>
                  <th className={tableHeadCellClass}>{dict.admin.users.role}</th>
                  <th className={tableHeadCellClass}>{dict.admin.users.status}</th>
                  <th className={tableHeadCellClass}>{dict.admin.users.lastLogin}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className={tableRowClass}>
                    <td className={tableCellClass}>
                      <Link href={`/${locale}/admin/users/${u.id}`} className="font-medium text-ink hover:text-accent hover:underline">
                        {u.username}
                      </Link>
                    </td>
                    <td className={`${tableCellClass} text-ink-muted`}>{u.displayName}</td>
                    <td className={`${tableCellClass} text-ink-muted`}>{hotelSummary(u, allHotelsLabel)}</td>
                    <td className={`${tableCellClass} text-ink-muted`}>{roleSummary(u)}</td>
                    <td className={tableCellClass}>
                      <StatusBadge tone={userStatusTone(u.status)}>{u.status}</StatusBadge>
                    </td>
                    <td className={`${tableCellClass} text-ink-muted`}>
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString(locale) : dict.admin.users.never}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>

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
