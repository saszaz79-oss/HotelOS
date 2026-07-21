import Link from 'next/link';
import { getDictionary, locales, defaultLocale, type Locale } from '@/i18n/config';
import { getCurrentUser } from '@/server/modules/auth/session';
import { prisma } from '@/lib/prisma';
import { getActiveMembership } from '@/server/modules/hotels/access';
import { listTimelineEvents } from '@/server/modules/timeline';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { STATUS_DOT_CLASSES } from '@/components/ui/StatusBadge';
import { timelineEventTone } from '@/lib/status-tone';

const REPORT_DOCUMENT_EVENT_TYPES = new Set(['report_extracted', 'report_finalized', 'alert_raised', 'ai_summary_generated', 'metric_corrected']);

export default async function TimelinePage(props: { params: Promise<{ locale: string }> }) {
  const params = await props.params;
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  const dict = getDictionary(locale);
  const user = await getCurrentUser();

  const membership = user && !user.isSuperAdmin ? await getActiveMembership(user.id) : null;

  if (!membership) {
    return <p className="text-ink-muted">{dict.missionControl.noHotels}</p>;
  }

  const events = await listTimelineEvents(membership.hotelId, 50);

  // Related Report (Validation Phase §6): resolve reportDocumentId sourceRefs
  // back to their parent ReportUpload so the timeline can link to the
  // hotel-user-facing review screen, not the internal Validation Workspace.
  const docIds = events.filter((e) => e.sourceRef && REPORT_DOCUMENT_EVENT_TYPES.has(e.eventType)).map((e) => e.sourceRef!);
  // Related Recommendation (Validation Phase §6).
  const recIds = events.filter((e) => e.eventType === 'recommendation_issued' && e.sourceRef).map((e) => e.sourceRef!);

  // Both lookups derive only from `events` (already resolved) and are
  // independent of each other — parallelized rather than sequential awaits
  // (Perf sprint round 2).
  const [docs, recs] = await Promise.all([
    docIds.length
      ? prisma.reportDocument.findMany({
          where: { id: { in: docIds } },
          select: { id: true, reportUploadId: true, reportUpload: { select: { originalFilename: true } } },
        })
      : Promise.resolve([]),
    recIds.length
      ? prisma.recommendation.findMany({ where: { id: { in: recIds } }, select: { id: true, category: true, priority: true } })
      : Promise.resolve([]),
  ]);
  const docMap = new Map(docs.map((d) => [d.id, d]));
  const recMap = new Map(recs.map((r) => [r.id, r]));

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">{dict.timeline.title}</h1>
        <p className="mt-1 text-sm text-ink-muted">{membership.hotel.name}</p>
      </div>

      {events.length === 0 ? (
        <EmptyState title={dict.timeline.empty} />
      ) : (
        <Card>
          <ol className="space-y-5">
            {events.map((e, i) => {
              const relatedDoc = e.sourceRef ? docMap.get(e.sourceRef) : undefined;
              const relatedRec = e.sourceRef ? recMap.get(e.sourceRef) : undefined;
              const tone = timelineEventTone(e.eventType);
              return (
                <li key={e.id} className="relative flex gap-3 text-sm">
                  <div className="flex flex-col items-center">
                    <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-[hsl(var(--glass-bg))] ${STATUS_DOT_CLASSES[tone]}`} aria-hidden="true" />
                    {i < events.length - 1 ? <span className="mt-1 w-px flex-1 bg-[hsl(var(--glass-border))]" aria-hidden="true" /> : null}
                  </div>
                  <div className="min-w-0 flex-1 pb-1">
                    <div className="font-medium text-ink">{dict.timeline.events[e.eventType]}</div>
                    <div className="mt-0.5 text-xs text-ink-muted">
                      {new Date(e.createdAt).toLocaleString(locale)}
                      {e.actor ? ` · ${e.actor.displayName}` : ` · ${locale === 'ar' ? 'النظام' : 'system'}`}
                    </div>
                    {relatedDoc ? (
                      <Link
                        href={`/${locale}/reports/${relatedDoc.reportUploadId}`}
                        className="mt-1 inline-block truncate text-xs text-accent hover:underline"
                      >
                        {relatedDoc.reportUpload.originalFilename}
                      </Link>
                    ) : e.eventType === 'report_uploaded' && e.sourceRef ? (
                      <Link href={`/${locale}/reports/${e.sourceRef}`} className="mt-1 inline-block text-xs text-accent hover:underline">
                        {dict.reportsUpload.viewReport}
                      </Link>
                    ) : null}
                    {relatedRec ? (
                      <div className="mt-1 text-xs text-ink-muted">
                        {dict.missionControl.categories[relatedRec.category]} · {relatedRec.priority}
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>
      )}
    </div>
  );
}
