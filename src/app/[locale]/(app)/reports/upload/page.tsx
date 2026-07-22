import { getDictionary, locales, defaultLocale, type Locale } from '@/i18n/config';
import { getCurrentUser } from '@/server/modules/auth/session';
import { getActiveMembership } from '@/server/modules/hotels/access';
import { createOrGetOpenAnalysisSession } from '@/server/modules/analysis-sessions/commands';
import { getSessionSlots } from '@/server/modules/analysis-sessions/queries';
import { AnalysisSessionPanel } from './AnalysisSessionPanel';

/**
 * Rebuilt around the Analysis Session (EDI Phase 2) — this page represents
 * ONE in-progress analysis, not a history browser. Historical uploads live
 * exclusively in /reports/archive now; the "recent uploads" list that used
 * to sit here (mixing today's work with old reports) is gone.
 */
export default async function ReportsUploadPage(props: { params: Promise<{ locale: string }> }) {
  const params = await props.params;
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  const dict = getDictionary(locale);
  const user = await getCurrentUser();

  const membership = user && !user.isSuperAdmin ? await getActiveMembership(user.id) : null;

  if (!user || !membership) {
    return (
      <div className="max-w-lg">
        <p className="text-ink-muted">{dict.missionControl.noHotels}</p>
      </div>
    );
  }

  const session = await createOrGetOpenAnalysisSession(membership.hotelId, user.id);
  const slots = await getSessionSlots(membership.hotelId, session.id);

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-ink">{dict.reportsUpload.title}</h1>
        <p className="mt-1 text-sm text-ink-muted">{dict.reportsUpload.description}</p>
      </div>

      <AnalysisSessionPanel
        locale={locale}
        hotelId={membership.hotelId}
        sessionId={session.id}
        initialStatus={session.status}
        initialStage={session.currentStage}
        initialErrorMessage={session.errorMessage}
        initialSlots={slots}
        dict={dict.reportsUpload}
        analysisDict={dict.executiveAnalysis}
        reportTypesDict={dict.reportsCommon.reportTypes}
      />
    </div>
  );
}
