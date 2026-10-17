import type { Metadata } from 'next';
import Link from 'next/link';
import { pages } from '@/lib/auth';

export const metadata: Metadata = { title: 'Admin' };

export default async function AdminHome() {
  const user = await pages.requireCan('people.manage', { live: true });
  const role = user.groups.includes('superadmin') ? 'an owner' : 'an admin';
  return (
    <div className="stack">
      <h1>Admin</h1>
      <p>
        You&apos;re {role}. Your role was just re-read from the user pool, so a change to it takes effect here at once.
      </p>
      <div className="grid-2">
        <section className="card">
          <h2>
            <Link href="/admin/people">People</Link>
          </h2>
          <p className="muted">
            Invite, resend, change role, disable, re-enable, sign out everywhere, and (owners only) delete. You grant and act
            only below your own role, nobody changes their own, and the last owner can&apos;t be removed.
          </p>
        </section>
        <section className="card">
          <h2>
            <Link href="/admin/activity">Activity</Link>
          </h2>
          <p className="muted">Every people and content change: who, to whom, what, before and after, why, and when. Nobody can edit it.</p>
        </section>
      </div>
    </div>
  );
}
