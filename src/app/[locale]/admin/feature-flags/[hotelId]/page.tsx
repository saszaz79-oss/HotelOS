import { getDictionary, locales, defaultLocale, type Locale } from '@/i18n/config';
import { getAllModuleStates } from '@/server/modules/feature-flags';
import { prisma } from '@/lib/prisma';
import { toggleModuleAction } from './actions';
import { TableShell, tableHeadRowClass, tableHeadCellClass, tableRowClass, tableCellClass } from '@/components/ui/TableShell';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';

export default async function AdminHotelFeatureFlagsPage(
  props: {
    params: Promise<{ locale: string; hotelId: string }>;
  }
) {
  const params = await props.params;
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  const dict = getDictionary(locale);
  // Independent lookups (different tables, no shared dependency) — batched
  // rather than sequential (Zero-Lag Sprint).
  const [hotel, states] = await Promise.all([
    prisma.hotel.findUnique({ where: { id: params.hotelId }, select: { name: true } }),
    getAllModuleStates(params.hotelId),
  ]);

  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-xl font-semibold text-ink">
        {dict.admin.featureFlags.title} — {hotel?.name}
      </h1>
      <TableShell>
        <table className="w-full text-sm">
          <thead>
            <tr className={tableHeadRowClass}>
              <th className={tableHeadCellClass} colSpan={2}>{dict.admin.featureFlags.title}</th>
              <th className={tableHeadCellClass} />
            </tr>
          </thead>
          <tbody>
            {states.map((s) => (
              <tr key={s.key} className={tableRowClass}>
                <td className={`${tableCellClass} font-mono text-xs text-ink`}>{s.key}</td>
                <td className={tableCellClass}>
                  <StatusBadge tone={s.enabled ? 'positive' : 'neutral'}>
                    {s.enabled ? dict.admin.featureFlags.enabled : dict.admin.featureFlags.disabled}
                  </StatusBadge>
                </td>
                <td className={`${tableCellClass} text-end`}>
                  <form action={toggleModuleAction.bind(null, locale, params.hotelId, s.key, s.enabled)}>
                    <Button type="submit" variant="secondary" size="sm">
                      {dict.admin.featureFlags.toggle}
                    </Button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>
    </div>
  );
}
