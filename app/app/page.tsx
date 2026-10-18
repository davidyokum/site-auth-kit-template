/**
 * The members' home. Every signed-in person can open it; what they can reach from here is decided
 * on each project (resource roles), never by being a member.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { pages } from '@/lib/auth';

export const metadata: Metadata = { title: 'Home' };

export default async function MembersHome() {
  const user = await pages.requireUser();
  return (
    <div className="stack">
      <h1>Welcome</h1>
      <p className="muted">Signed in as {user.profile?.email ?? 'you'}.</p>
      <section className="card">
        <h2>
          <Link href="/app/projects">Projects</Link>
        </h2>
        <p className="muted">
          The projects you have a role on: Manager (edit it and choose who has access), Contributor (edit it), or Reader (see it).
          Site admins see every project.
        </p>
      </section>
    </div>
  );
}
