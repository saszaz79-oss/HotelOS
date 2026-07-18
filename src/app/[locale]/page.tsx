import { redirect } from 'next/navigation';
import type { Locale } from '@/i18n/config';

export default async function LocaleIndexPage(props: { params: Promise<{ locale: Locale }> }) {
  const params = await props.params;
  redirect(`/${params.locale}/mission-control`);
}
