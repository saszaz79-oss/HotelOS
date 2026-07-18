import { getDictionary, locales, defaultLocale, type Locale } from '@/i18n/config';
import { getCurrentUser } from '@/server/modules/auth/session';
import { withSuperAdminScope } from '@/server/modules/hotels/access';
import { prisma } from '@/lib/prisma';
import { listReportUploads } from '@/server/modules/reports/queries';
import { getLatestInsight } from '@/server/modules/insights/queries';
import { listTimelineEvents } from '@/server/modules/timeline';

export default async function AdminSupportHotelPage({
  params,
}: {
  params: { locale: string; hotelId: string };
}) {
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  const dict = getDictionary(locale);
  const user = await getCurrentUser();
  if (!user || !user.isSuperAdmin) throw new Error('FORBIDDEN');

  const hotel = await prisma.hotel.findUnique({ where: { id: params.hotelId }, select: { name: true } });

  // Every support access is audited (Architecture §4 Super Admin path) —
  // this is the "Support Access" requirement's actual enforcement point,
  // not just a UI section.
  const { uploads, insight, events } = await withSuperAdminScope(user, params.hotelId, 'support_access', async () => {
    const [uploads, insight, events] = await Promise.all([
      listReportUploads(params.hotelId, 10),
      getLatestInsight(params.hotelId),
      listTimelineEvents(params.hotelId, 20),
    ]);
    return { uploads, insight, events };
  });

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-lg font-medium">
        {dict.admin.support.title} — {hotel?.name}
      </h1>

      <section>
        <h2 className="text-sm font-medium text-ink-muted">Health Score</h2>
        <p className="metric-value mt-1 text-xl">{insight?.healthScore ?? 'Not computed yet'}</p>
      </section>

      <section>
        <h2 className="text-sm font-medium text-ink-muted">Recent Uploads</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {uploads.map((u) => (
            <li key={u.id}>
              {u.originalFilename} — {u.status} ({new Date(u.createdAt).toLocaleDateString(locale)})
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-medium text-ink-muted">Recent Timeline</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {events.map((e) => (
            <li key={e.id}>
              {e.eventType} — {new Date(e.createdAt).toLocaleString(locale)}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
