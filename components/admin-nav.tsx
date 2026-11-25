'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface AdminNavProps {
  readonly roleLabel: string;
  readonly canAudit: boolean;
  readonly canSettings: boolean;
}

/**
 * Flush warm-amber Admin Mode ribbon rendered directly below the host site masthead.
 * Keeps the user's mental model anchored to the host site while clearly signaling live
 * administration scope (`• ADMIN MODE`).
 */
export function AdminNav({ roleLabel, canAudit, canSettings }: AdminNavProps) {
  const pathname = usePathname();
  const isPeople = pathname === '/admin' || pathname.startsWith('/admin/people');
  const isActivity = pathname.startsWith('/admin/activity');
  const isSettings = pathname.startsWith('/admin/settings');

  return (
    <div className="admin-mode-bar" role="navigation" aria-label="Admin Mode">
      <div className="admin-mode-inner">
        <span className="admin-mode-badge">
          <span className="admin-mode-dot" aria-hidden="true" />
          ADMIN MODE
        </span>
        <div className="admin-mode-tabs">
          <Link href="/admin/people" className={`admin-mode-tab${isPeople ? ' is-active' : ''}`} aria-current={isPeople ? 'page' : undefined}>
            People
          </Link>
          {canAudit && (
            <Link href="/admin/activity" className={`admin-mode-tab${isActivity ? ' is-active' : ''}`} aria-current={isActivity ? 'page' : undefined}>
              Activity
            </Link>
          )}
          {canSettings && (
            <Link href="/admin/settings" className={`admin-mode-tab${isSettings ? ' is-active' : ''}`} aria-current={isSettings ? 'page' : undefined}>
              Settings &amp; Emails
            </Link>
          )}
        </div>
        <div className="admin-mode-right">
          <span className="admin-mode-role">{roleLabel}</span>
          <Link href="/app" className="admin-mode-exit">
            Exit admin →
          </Link>
        </div>
      </div>
    </div>
  );
}
