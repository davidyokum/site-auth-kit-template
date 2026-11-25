'use client';

import type { UsageLedgerSnapshot } from 'auth-kit/admin';
import { type ReactNode, useState } from 'react';

export interface ActivityWorkspaceProps {
  readonly auditNode: ReactNode;
  readonly usage: UsageLedgerSnapshot;
}

export function ActivityWorkspace({ auditNode, usage }: ActivityWorkspaceProps) {
  const [tab, setTab] = useState<'audit' | 'usage'>('audit');
  const accounts = Object.values(usage.accounts).sort((a, b) =>
    b.lastSeenAt.localeCompare(a.lastSeenAt),
  );
  const totalVisits30d = Object.values(usage.dailyCounts).reduce((sum, n) => sum + n, 0);

  return (
    <div className="admin-surface">
      <div className="admin-kpi-strip" role="region" aria-label="Activity summary">
        <span className="admin-kpi-item">
          <span className="admin-kpi-label">ACTIVE ACCOUNTS (30D)</span> <strong>{accounts.length}</strong>
        </span>
        <span className="admin-kpi-item">
          <span className="admin-kpi-label">RECORDED VISITS (30D)</span> <strong>{totalVisits30d}</strong>
        </span>
      </div>

      <div className="admin-subnav-row">
        <div className="admin-subtabs" role="tablist" aria-label="Activity views">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'audit'}
            className={`admin-subtab${tab === 'audit' ? ' is-active' : ''}`}
            onClick={() => setTab('audit')}
          >
            Audit Log
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'usage'}
            className={`admin-subtab${tab === 'usage' ? ' is-active' : ''}`}
            onClick={() => setTab('usage')}
          >
            Usage &amp; Sign-ins
          </button>
        </div>
      </div>

      <div hidden={tab !== 'audit'}>{auditNode}</div>

      {tab === 'usage' && (
        <div className="table-wrap">
          <table className="admin-dense-table">
            <thead>
              <tr>
                <th>ACCOUNT</th>
                <th>LAST SEEN</th>
                <th>LAST PAGE</th>
                <th>VISITS (30D)</th>
              </tr>
            </thead>
            <tbody>
              {accounts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="admin-muted-note">
                    No signed-in activity recorded yet.
                  </td>
                </tr>
              ) : (
                accounts.map((row) => (
                  <tr key={row.sub}>
                    <td>{row.email ?? 'Signed-in account'}</td>
                    <td className="admin-num">{row.lastSeenAt.slice(0, 16).replace('T', ' ')} UTC</td>
                    <td><code>{row.lastPath}</code></td>
                    <td className="admin-num">{row.visits30d}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
