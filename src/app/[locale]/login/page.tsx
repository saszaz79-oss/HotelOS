import { getDictionary, locales, defaultLocale, type Locale } from '@/i18n/config';
import { AuthLayout } from '@/components/AuthLayout';
import { LoginForm } from './LoginForm';

export default async function LoginPage(props: { params: Promise<{ locale: string }> }) {
  const params = await props.params;
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  const dict = getDictionary(locale);

  return (
    <AuthLayout locale={locale} languageSwitchPath="/login" dict={dict.app} footer={dict.login.secureFooter}>
      <h1 className="text-2xl font-semibold text-ink">{dict.login.title}</h1>
      <p className="mt-1.5 text-sm text-ink-muted">{dict.login.subtitle}</p>
      <div className="mt-8">
        <LoginForm locale={locale} dict={dict.login} />
      </div>
    </AuthLayout>
  );
}
