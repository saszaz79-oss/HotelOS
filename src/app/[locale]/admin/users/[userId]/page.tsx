import { getDictionary, locales, defaultLocale, type Locale } from '@/i18n/config';
import { getUser } from '@/server/modules/users/queries';
import { ResetPasswordButton } from './ResetPasswordButton';
import { setUserStatusAction, forceChangePasswordAction, changeRoleAction } from './actions';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { userStatusTone } from '@/lib/status-tone';

const ROLES = ['HOTEL_ADMIN', 'GENERAL_MANAGER', 'FRONT_OFFICE_MANAGER', 'REVENUE_MANAGER', 'ANALYST', 'READ_ONLY'];

const selectClass = 'rounded-md border border-ink/15 bg-surface-raised px-3 py-1.5 text-xs focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30';

export default async function AdminUserDetailPage(
  props: {
    params: Promise<{ locale: string; userId: string }>;
  }
) {
  const params = await props.params;
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  const dict = getDictionary(locale);
  const user = await getUser(params.userId);

  if (!user) return <p className="text-ink-muted">Not found.</p>;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-medium text-ink">{user.displayName}</h1>
        <StatusBadge tone={userStatusTone(user.status)}>{user.status}</StatusBadge>
        {user.isSuperAdmin ? <StatusBadge tone="info">{locale === 'ar' ? 'مالك المنصة' : 'Platform Owner'}</StatusBadge> : null}
        {user.mustChangePassword ? <StatusBadge tone="warning">{dict.admin.users.mustChangePassword}</StatusBadge> : null}
      </div>

      <Card>
        <ul className="divide-y divide-ink/5 text-sm">
          <li className="flex items-center justify-between py-2">
            <span className="text-ink-muted">{dict.admin.users.username}</span>
            <span className="metric-value text-ink">{user.username}</span>
          </li>
          <li className="flex items-center justify-between py-2">
            <span className="text-ink-muted">{dict.admin.users.createdAt}</span>
            <span className="text-ink">{new Date(user.createdAt).toLocaleDateString(locale)}</span>
          </li>
          <li className="flex items-center justify-between py-2">
            <span className="text-ink-muted">{dict.admin.users.lastLogin}</span>
            <span className="text-ink">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString(locale) : dict.admin.users.never}</span>
          </li>
        </ul>
      </Card>

      {!user.isSuperAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle>{dict.admin.users.hotel}</CardTitle>
          </CardHeader>
          <ul className="divide-y divide-ink/5 text-sm">
            {user.memberships.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="text-ink">{m.hotel.name}</span>
                <form action={changeRoleAction.bind(null, locale, user.id, m.id)} className="flex items-center gap-2">
                  <select name="role" defaultValue={m.role} className={selectClass}>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <Button type="submit" variant="secondary" size="sm">
                    {dict.admin.users.saveRole}
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <ResetPasswordButton
          locale={locale}
          userId={user.id}
          label={dict.admin.users.resetPassword}
          successLabel={dict.admin.users.resetSuccess}
        />
        <form action={forceChangePasswordAction.bind(null, locale, user.id)}>
          <Button type="submit" variant="secondary" size="sm" disabled={user.mustChangePassword}>
            {dict.admin.users.forceChangePassword}
          </Button>
        </form>
        <form action={setUserStatusAction.bind(null, locale, user.id, user.status === 'active' ? 'disabled' : 'active')}>
          <Button type="submit" variant={user.status === 'active' ? 'danger' : 'secondary'} size="sm">
            {user.status === 'active' ? dict.admin.users.disable : dict.admin.users.activate}
          </Button>
        </form>
      </div>
    </div>
  );
}
