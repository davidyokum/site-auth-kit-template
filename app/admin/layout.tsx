/**
 * The admin area: owners and admins (`people.manage`). The layout checks live, and every page and
 * action under it checks again for itself (03 §2: "the /admin layout, the proxy, or hidden
 * navigation isn't enough"). Admin pages are never cached (the root layout renders per request and
 * the proxy sends `Cache-Control: private, no-store`).
 */
import Link from 'next/link';
import type { ReactNode } from 'react';
import { pages } from '@/lib/auth';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await pages.requireCan('people.manage', { live: true });
  return (
    <div className="stack">
      <nav aria-label="Admin" className="site-nav">
        <strong>Admin</strong>
        <Link href="/admin">Overview</Link>
        <Link href="/admin/people">People</Link>
        {user.capabilities.has('audit.read') && <Link href="/admin/activity">Activity</Link>}
      </nav>
      {children}
    </div>
  );
}
