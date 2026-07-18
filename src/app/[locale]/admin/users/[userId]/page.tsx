import { getDictionary, locales, defaultLocale, type Locale } from '@/i18n/config';
import { getUser } from '@/server/modules/users/queries';
import { ResetPasswordButton } from './ResetPasswordButton';
import { setUserStatusAction } from './actions';

export default async function AdminUserDetailPage({
  params,
}: {
  params: { locale: string; userId: string };
}) {
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  const dict = getDictionary(locale);
  const user = await getUser(params.userId);

  if (!user) return <p className="text-ink-muted">Not found.</p>;

  return (
    <div className="max-w-md space-y-6">
      <div>
        <h1 className="text-lg font-medium">{user.displayName}</h1>
        <p className="text-sm text-ink-muted">
          {user.username} · {user.status} {user.isSuperAdmin ? '· Platform Owner' : ''}
        </p>
      </div>

      <section>
        <h2 className="text-sm font-medium text-ink-muted">{dict.admin.users.hotel}</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {user.memberships.map((m) => (
            <li key={m.id}>
              {m.hotel.name} — {m.role}
            </li>
          ))}
        </ul>
      </section>

      <div className="flex gap-2">
        <ResetPasswordButton
          locale={locale}
          userId={user.id}
          label={dict.admin.users.resetPassword}
          successLabel={dict.admin.users.resetSuccess}
        />
        <form action={setUserStatusAction.bind(null, locale, user.id, user.status === 'active' ? 'disabled' : 'active')}>
          <button type="submit" className="rounded-md border border-ink/10 px-3 py-1.5 text-xs hover:bg-surface-raised">
            {user.status === 'active' ? dict.admin.users.disable : dict.admin.users.activate}
          </button>
        </form>
      </div>
    </div>
  );
}
