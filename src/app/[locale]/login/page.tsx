import { getDictionary, locales, defaultLocale, type Locale } from '@/i18n/config';
import { LampScene } from './LampScene';
import { LoginForm } from './LoginForm';

export default async function LoginPage(props: { params: Promise<{ locale: string }> }) {
  const params = await props.params;
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  const dict = getDictionary(locale);

  return (
    <LampScene
      locale={locale}
      languageSwitchPath="/login"
      wordmark={dict.app.name}
      tagline={dict.app.tagline}
      footer={dict.login.footer}
    >
      <h1 className="mt-2 text-2xl font-semibold text-white">{dict.login.title}</h1>
      <p className="mt-1.5 text-sm text-white/60">{dict.login.subtitle}</p>
      <div className="mt-8">
        <LoginForm locale={locale} dict={dict.login} />
      </div>
    </LampScene>
  );
}
