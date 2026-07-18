import { getDictionary, locales, defaultLocale, type Locale } from '@/i18n/config';
import { getAllModuleStates } from '@/server/modules/feature-flags';
import { prisma } from '@/lib/prisma';
import { toggleModuleAction } from './actions';

export default async function AdminHotelFeatureFlagsPage({
  params,
}: {
  params: { locale: string; hotelId: string };
}) {
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  const dict = getDictionary(locale);
  const hotel = await prisma.hotel.findUnique({ where: { id: params.hotelId }, select: { name: true } });
  const states = await getAllModuleStates(params.hotelId);

  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-lg font-medium">
        {dict.admin.featureFlags.title} — {hotel?.name}
      </h1>
      <table className="w-full text-sm">
        <tbody>
          {states.map((s) => (
            <tr key={s.key} className="border-b border-ink/5">
              <td className="py-2">{s.key}</td>
              <td className="py-2">{s.enabled ? dict.admin.featureFlags.enabled : dict.admin.featureFlags.disabled}</td>
              <td className="py-2">
                <form action={toggleModuleAction.bind(null, locale, params.hotelId, s.key, s.enabled)}>
                  <button type="submit" className="rounded-md border border-ink/10 px-3 py-1 text-xs hover:bg-surface-raised">
                    {dict.admin.featureFlags.toggle}
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
