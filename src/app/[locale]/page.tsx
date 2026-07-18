import { redirect } from 'next/navigation';
import type { Locale } from '@/i18n/config';

export default function LocaleIndexPage({ params }: { params: { locale: Locale } }) {
  redirect(`/${params.locale}/mission-control`);
}
