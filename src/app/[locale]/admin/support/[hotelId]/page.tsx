import { redirect } from 'next/navigation';
import { getDictionary, locales, defaultLocale, type Locale } from '@/i18n/config';
import { getCurrentUser } from '@/server/modules/auth/session';
import { withSuperAdminScope } from '@/server/modules/hotels/access';
import { prisma } from '@/lib/prisma';
import { listReportUploads } from '@/server/modules/reports/queries';
import { getLatestInsight } from '@/server/modules/insights/queries';
import { listTimelineEvents } from '@/server/modules/timeline';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { reportStatusTone } from '@/lib/status-tone';

export default async function AdminSupportHotelPage(
  props: {
    params: Promise<{ locale: string; hotelId: string }>;
  }
) {
  const params = await props.params;
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  const dict = getDictionary(locale);
  const user = await getCurrentUser();
  // Session can expire between navigating here and this render (same crash
  // class as digest 881976446) — redirect instead of an uncaught throw.
  if (!user || !user.isSuperAdmin) {
    redirect(`/${locale}/login`);
  }

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
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold text-ink">
        {dict.admin.support.title} — {hotel?.name}
      </h1>

      <Card className="p-4">
        <p className="text-xs text-ink-muted">Health Score</p>
        <p className="metric-value mt-1 text-2xl font-semibold text-ink">{insight?.healthScore ?? '—'}</p>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Uploads</CardTitle>
        </CardHeader>
        {uploads.length === 0 ? (
          <EmptyState title={dict.reportsUpload.noUploads} />
        ) : (
          <ul className="divide-y divide-ink/5 text-sm">
            {uploads.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="truncate text-ink">{u.originalFilename}</span>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-ink-muted">{new Date(u.createdAt).toLocaleDateString(locale)}</span>
                  <StatusBadge tone={reportStatusTone(u.status)}>{u.status}</StatusBadge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Timeline</CardTitle>
        </CardHeader>
        {events.length === 0 ? (
          <EmptyState title={locale === 'ar' ? 'لا توجد أحداث بعد.' : 'No timeline events yet.'} />
        ) : (
          <ul className="divide-y divide-ink/5 text-sm">
            {events.map((e) => (
              <li key={e.id} className="flex items-center justify-between py-2.5">
                <span className="font-mono text-xs text-ink">{e.eventType}</span>
                <span className="text-xs text-ink-muted">{new Date(e.createdAt).toLocaleString(locale)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
