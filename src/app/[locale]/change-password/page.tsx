import { getDictionary, locales, defaultLocale, type Locale } from '@/i18n/config';
import { getCurrentUser } from '@/server/modules/auth/session';
import { redirect } from 'next/navigation';
import { ChangePasswordForm } from './ChangePasswordForm';

export default async function ChangePasswordPage({ params }: { params: { locale: string } }) {
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  const dict = getDictionary(locale);
  const user = await getCurrentUser();

  if (!user) redirect(`/${locale}/login`);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <p className="text-sm text-ink-muted">{dict.app.name}</p>
          <h1 className="mt-1 text-xl font-medium">{dict.changePassword.title}</h1>
          {user.mustChangePassword ? (
            <p className="mt-2 text-sm text-status-warning">{dict.changePassword.temporaryNotice}</p>
          ) : null}
        </div>
        <ChangePasswordForm locale={locale} dict={dict.changePassword} />
      </div>
    </main>
  );
}
