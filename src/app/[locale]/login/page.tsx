import { getDictionary, locales, defaultLocale, type Locale } from '@/i18n/config';
import { LoginForm } from './LoginForm';

export default async function LoginPage(props: { params: Promise<{ locale: string }> }) {
  const params = await props.params;
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  const dict = getDictionary(locale);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <p className="text-sm text-ink-muted">{dict.app.name}</p>
          <h1 className="mt-1 text-xl font-medium">{dict.login.title}</h1>
        </div>
        <LoginForm locale={locale} dict={dict.login} />
      </div>
    </main>
  );
}
