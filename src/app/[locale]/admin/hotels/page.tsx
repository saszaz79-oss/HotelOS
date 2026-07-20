import Link from 'next/link';
import { getDictionary, locales, defaultLocale, type Locale } from '@/i18n/config';
import { listHotels } from '@/server/modules/hotels/queries';
import type { HotelStatus } from '@prisma/client';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { TableShell, tableHeadRowClass, tableHeadCellClass, tableRowClass, tableCellClass } from '@/components/ui/TableShell';
import { hotelStatusTone } from '@/lib/status-tone';

const filterFieldClass =
  'rounded-lg border border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg))] px-3 py-2 text-sm backdrop-blur-xl transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30';

const STATUS_VALUES: HotelStatus[] = ['active', 'suspended', 'archived'];

export default async function AdminHotelsPage(
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
  const statusFilter = STATUS_VALUES.includes(searchParams.status as HotelStatus)
    ? (searchParams.status as HotelStatus)
    : undefined;

  const hotels = await listHotels({ search, status: statusFilter });

  const filterOptions: { value: string; label: string }[] = [
    { value: '', label: dict.admin.hotels.filterAll },
    { value: 'active', label: dict.admin.hotels.filterActive },
    { value: 'suspended', label: dict.admin.hotels.filterSuspended },
    { value: 'archived', label: dict.admin.hotels.filterArchived },
  ];

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-ink">{dict.admin.hotels.title}</h1>
        <Link href={`/${locale}/admin/hotels/new`}>
          <Button size="sm">{dict.admin.hotels.create}</Button>
        </Link>
      </div>

      {/* Plain GET form — works with JS disabled, no client state needed;
          search/filter are just query params the server reads directly. */}
      <form className="flex flex-wrap gap-2" action={`/${locale}/admin/hotels`}>
        <input
          type="text"
          name="q"
          defaultValue={search}
          placeholder={dict.admin.hotels.searchPlaceholder}
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
          {dict.admin.hotels.searchPlaceholder.split(' ')[0]}
        </Button>
      </form>

      {hotels.length === 0 ? (
        <EmptyState title={dict.admin.hotels.noResults} />
      ) : (
        <>
          {/* Desktop table */}
          <TableShell className="hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className={tableHeadRowClass}>
                  <th className={tableHeadCellClass}>{dict.admin.hotels.name}</th>
                  <th className={tableHeadCellClass}>{dict.admin.hotels.country}</th>
                  <th className={tableHeadCellClass}>{dict.admin.hotels.subscriptionPlan}</th>
                  <th className={tableHeadCellClass}>{dict.admin.hotels.status}</th>
                  <th className={tableHeadCellClass}>{dict.admin.hotels.members}</th>
                  <th className={tableHeadCellClass}>{dict.admin.hotels.reportsCount}</th>
                </tr>
              </thead>
              <tbody>
                {hotels.map((h) => (
                  <tr key={h.id} className={tableRowClass}>
                    <td className={tableCellClass}>
                      <Link href={`/${locale}/admin/hotels/${h.id}`} className="font-medium text-ink hover:text-accent hover:underline">
                        {h.name}
                      </Link>
                    </td>
                    <td className={`${tableCellClass} text-ink-muted`}>
                      {h.city}, {h.country}
                    </td>
                    <td className={`${tableCellClass} text-ink-muted`}>{h.subscription?.plan ?? '—'}</td>
                    <td className={tableCellClass}>
                      <StatusBadge tone={hotelStatusTone(h.status)}>{h.status}</StatusBadge>
                    </td>
                    <td className={`metric-value ${tableCellClass}`}>{h._count.memberships}</td>
                    <td className={`metric-value ${tableCellClass}`}>{h._count.reportUploads}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {hotels.map((h) => (
              <Card key={h.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/${locale}/admin/hotels/${h.id}`} className="font-medium text-ink hover:text-accent hover:underline">
                    {h.name}
                  </Link>
                  <StatusBadge tone={hotelStatusTone(h.status)}>{h.status}</StatusBadge>
                </div>
                <p className="mt-1 text-xs text-ink-muted">
                  {h.city}, {h.country} · {h.subscription?.plan ?? '—'}
                </p>
                <div className="mt-3 flex gap-4 text-xs text-ink-muted">
                  <span>
                    {dict.admin.hotels.members}: <span className="metric-value text-ink">{h._count.memberships}</span>
                  </span>
                  <span>
                    {dict.admin.hotels.reportsCount}: <span className="metric-value text-ink">{h._count.reportUploads}</span>
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
