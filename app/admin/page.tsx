import { highestAdminRole, roleLabel } from 'auth-kit/admin';
import type { Metadata } from 'next';
import Link from 'next/link';
import { pages } from '@/lib/auth';

export const metadata: Metadata = { title: 'Admin' };

export default async function AdminHome() {
  const user = await pages.requireCan('people.read', { live: true });
  const role = roleLabel(highestAdminRole(user.groups));
  const manages = user.capabilities.has('people.manage');
  return (
    <div className="stack">
      <h1>Admin</h1>
      <p>
        Your role: <strong>{role}</strong>. It was just re-read from the user pool, so a change to it takes effect here at once.
      </p>
      <div className="grid-2">
        <section className="card">
          <h2>
            <Link href="/admin/people">People</Link>
          </h2>
          <p className="muted">
            {manages
              ? 'Invite, resend, change role, disable, re-enable, sign out everywhere, and (the owner and Super admins) delete. You grant and act only below your own role, nobody changes their own, and only the owner grants Super admin or transfers ownership.'
              : 'Everyone who can sign in, and their roles. Your role can see this list but not change it.'}
          </p>
        </section>
        <section className="card">
          <h2>
            <Link href="/admin/activity">Activity</Link>
          </h2>
          <p className="muted">Every people and content change: who, to whom, what, before and after, why, and when. Nobody can edit it.</p>
        </section>
        {user.capabilities.has('settings.security') && (
          <section className="card">
            <h2>
              <Link href="/admin/settings">Settings</Link>
            </h2>
            <p className="muted">
              Sign-in help: the address the sign-in card and every email send people to. Change it without a deploy; the owner and every Super admin are told.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
