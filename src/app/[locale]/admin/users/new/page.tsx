import { getDictionary, locales, defaultLocale, type Locale } from '@/i18n/config';
import { listHotels } from '@/server/modules/hotels/queries';
import { NewUserForm } from './NewUserForm';

export default async function NewUserPage(props: { params: Promise<{ locale: string }> }) {
  const params = await props.params;
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  const dict = getDictionary(locale);
  const hotels = await listHotels();

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-medium">{dict.admin.users.create}</h1>
      <NewUserForm dict={dict.admin.users} hotels={hotels.map((h) => ({ id: h.id, name: h.name }))} />
    </div>
  );
}
