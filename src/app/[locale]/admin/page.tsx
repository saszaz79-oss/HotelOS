import { redirect } from 'next/navigation';
import type { Locale } from '@/i18n/config';

export default function AdminIndexPage({ params }: { params: { locale: Locale } }) {
  redirect(`/${params.locale}/admin/hotels`);
}
