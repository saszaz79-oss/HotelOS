import Link from 'next/link';
import { getDictionary, locales, defaultLocale, type Locale } from '@/i18n/config';
import { getCurrentUser } from '@/server/modules/auth/session';
import { prisma } from '@/lib/prisma';
import { getActiveMembership } from '@/server/modules/hotels/access';
import { listTimelineEvents } from '@/server/modules/timeline';

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
  const docs = docIds.length
    ? await prisma.reportDocument.findMany({
        where: { id: { in: docIds } },
        select: { id: true, reportUploadId: true, reportUpload: { select: { originalFilename: true } } },
      })
    : [];
  const docMap = new Map(docs.map((d) => [d.id, d]));

  // Related Recommendation (Validation Phase §6).
  const recIds = events.filter((e) => e.eventType === 'recommendation_issued' && e.sourceRef).map((e) => e.sourceRef!);
  const recs = recIds.length
    ? await prisma.recommendation.findMany({ where: { id: { in: recIds } }, select: { id: true, category: true, priority: true } })
    : [];
  const recMap = new Map(recs.map((r) => [r.id, r]));

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-medium">{dict.timeline.title}</h1>
      <p className="text-sm text-ink-muted">{membership.hotel.name}</p>

      {events.length === 0 ? (
        <p className="text-sm text-ink-muted">{dict.timeline.empty}</p>
      ) : (
        <ol className="space-y-3 border-s border-ink/10 ps-4">
          {events.map((e) => {
            const relatedDoc = e.sourceRef ? docMap.get(e.sourceRef) : undefined;
            const relatedRec = e.sourceRef ? recMap.get(e.sourceRef) : undefined;
            return (
              <li key={e.id} className="text-sm">
                <div className="font-medium">{dict.timeline.events[e.eventType]}</div>
                <div className="text-xs text-ink-muted">
                  {new Date(e.createdAt).toLocaleString(locale)}
                  {e.actor ? ` · ${e.actor.displayName}` : ' · system'}
                </div>
                {relatedDoc ? (
                  <Link
                    href={`/${locale}/reports/${relatedDoc.reportUploadId}`}
                    className="text-xs text-accent hover:underline"
                  >
                    {relatedDoc.reportUpload.originalFilename}
                  </Link>
                ) : e.eventType === 'report_uploaded' && e.sourceRef ? (
                  <Link href={`/${locale}/reports/${e.sourceRef}`} className="text-xs text-accent hover:underline">
                    View report
                  </Link>
                ) : null}
                {relatedRec ? (
                  <div className="text-xs text-ink-muted">
                    {relatedRec.category} · priority {relatedRec.priority}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
