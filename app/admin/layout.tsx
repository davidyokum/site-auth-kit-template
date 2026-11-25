/**
 * The admin area: every site-wide admin role (`people.read`), Admin – view only included; what each
 * may change is decided by the capability each action needs. The layout checks live, and every page and
 * action under it checks again for itself (03 §2: "the /admin layout, the proxy, or hidden
 * navigation isn't enough"). Admin pages are never cached (the root layout renders per request and
 * the proxy sends `Cache-Control: private, no-store`).
 */
import { highestAdminRole } from 'auth-kit/admin';
import type { ReactNode } from 'react';
import { AdminNav } from '@/components/admin-nav';
import { pages } from '@/lib/auth';
import { displayRoleLabel } from '@/lib/role-catalog';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await pages.requireCan('people.read', { live: true });
  const roleLabel = displayRoleLabel(highestAdminRole(user.groups));
  return (
    <div className="admin-shell">
      <AdminNav
        roleLabel={roleLabel}
        canAudit={user.capabilities.has('audit.read')}
        canSettings={user.capabilities.has('settings.security')}
      />
      {children}
    </div>
  );
}
