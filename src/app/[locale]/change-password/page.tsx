import { getDictionary, locales, defaultLocale, type Locale } from '@/i18n/config';
import { getCurrentUser } from '@/server/modules/auth/session';
import { redirect } from 'next/navigation';
import { AuthLayout } from '@/components/AuthLayout';
import { ChangePasswordForm } from './ChangePasswordForm';

export default async function ChangePasswordPage(props: { params: Promise<{ locale: string }> }) {
  const params = await props.params;
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  const dict = getDictionary(locale);
  const user = await getCurrentUser();

  if (!user) redirect(`/${locale}/login`);

  return (
    <AuthLayout locale={locale} languageSwitchPath="/change-password" dict={dict.app}>
      <h1 className="text-2xl font-semibold text-ink">{dict.changePassword.title}</h1>
      {user.mustChangePassword ? (
        <p className="mt-1.5 rounded-md bg-status-warning/10 px-3 py-2 text-sm text-status-warning">
          {dict.changePassword.temporaryNotice}
        </p>
      ) : (
        <p className="mt-1.5 text-sm text-ink-muted">{dict.changePassword.subtitle}</p>
      )}
      <div className="mt-8">
        <ChangePasswordForm locale={locale} dict={dict.changePassword} />
      </div>
    </AuthLayout>
  );
}
