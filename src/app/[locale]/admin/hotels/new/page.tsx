import { getDictionary, locales, defaultLocale, type Locale } from '@/i18n/config';
import { NewHotelForm } from './NewHotelForm';

export default async function NewHotelPage(props: { params: Promise<{ locale: string }> }) {
  const params = await props.params;
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  const dict = getDictionary(locale);

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-ink">{dict.admin.hotels.create}</h1>
      <NewHotelForm locale={locale} dict={dict.admin.hotels} />
    </div>
  );
}
