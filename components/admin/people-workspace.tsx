'use client';

import {
  type ActionResult,
  type CustomRoleDefinition,
  type DirectoryProfileMap,
  type FormAction,
  type PeopleList,
  type PersonRow,
  type RolePolicySnapshot,
  type StoredRolePolicy,
  type UsageLedgerSnapshot,
  highestAdminRole,
  inviteStatus,
} from 'auth-kit/admin';
import { ActionResultMessage, InviteForm, type Viewer } from 'auth-kit/admin/ui';
import type { SignInSettings } from 'auth-kit/client';
import { type ReactNode, useActionState, useMemo, useState } from 'react';
import { STARTER_ROLE_CATALOG, displayRoleLabel } from '@/lib/role-catalog';

export interface PeopleWorkspaceProps {
  readonly people: PeopleList;
  readonly viewer: Viewer;
  readonly appRoles: readonly string[];
  readonly inviteDomains: readonly string[];
  readonly stepUpHref: string;
  readonly profiles: DirectoryProfileMap;
  readonly usage: UsageLedgerSnapshot;
  readonly rolePolicy: RolePolicySnapshot;
  readonly canManagePeople: boolean;
  readonly canEditPolicy: boolean;
  readonly requestsTab?: {
    readonly countLabel: string;
    readonly node: ReactNode;
  };
  readonly resourceAccess: ReactNode;
  readonly signIn?: SignInSettings;
  readonly actions: {
    readonly invite: FormAction;
    readonly inviteMany?: FormAction;
    readonly resend: FormAction;
    readonly changeRole: FormAction;
    readonly transferOwnership: FormAction;
    readonly disable: FormAction;
    readonly enable: FormAction;
    readonly signOutEverywhere: FormAction;
    readonly deleteUser: FormAction;
    readonly savePersonProfile: FormAction;
    readonly saveRolePolicy: FormAction;
  };
}

type SortField = 'email' | 'firstName' | 'lastName' | 'title' | 'role' | 'status' | 'lastSeen';

function statusMeta(person: PersonRow): { label: string; tone: 'ok' | 'info' | 'warn' | 'danger' } {
  const st = inviteStatus({
    createdAt: new Date(person.createdAt),
    emailVerified: person.emailVerified,
    enabled: person.enabled,
    status: person.status,
  });
  switch (st) {
    case 'accepted':
      return { label: 'Active', tone: 'ok' };
    case 'pending':
      return { label: 'Invited', tone: 'info' };
    case 'expiring-soon':
      return { label: 'Expiring soon', tone: 'warn' };
    case 'expired':
      return { label: 'Invite expired', tone: 'danger' };
    case 'disabled':
      return { label: 'Disabled', tone: 'danger' };
  }
}

function primaryRoleId(person: PersonRow, customIds: ReadonlySet<string>): string {
  const admin = highestAdminRole(person.groups);
  if (admin) return admin;
  const custom = person.groups.find((g) => customIds.has(g));
  return custom ?? 'member';
}

function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toISOString().slice(0, 10);
}

const LEGACY_SET = new Set(['admin-content-people', 'admin-content', 'admin-view']);

export function PeopleWorkspace(props: PeopleWorkspaceProps) {
  const rows = useMemo(() => (props.people.state === 'ok' ? props.people.people : []), [props.people]);
  const [subTab, setSubTab] = useState<'directory' | 'matrix' | 'requests'>('directory');
  const [showInvite, setShowInvite] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('email');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selectedSub, setSelectedSub] = useState<string | null>(null);

  // Staged Role Builder state
  const [draftPolicy, setDraftPolicy] = useState<StoredRolePolicy>(props.rolePolicy.policy);
  const [policyReason, setPolicyReason] = useState('');
  const [showLegacy, setShowLegacy] = useState<boolean>(
    props.rolePolicy.policy.showLegacyAdminTiers === true ||
      rows.some((p) => p.groups.some((g) => LEGACY_SET.has(g))),
  );
  const [addingCustom, setAddingCustom] = useState(false);
  const [newRoleId, setNewRoleId] = useState('');
  const [newRoleLabel, setNewRoleLabel] = useState('');
  const [newRoleSummary, setNewRoleSummary] = useState('');

  const [profileState, profileAction] = useActionState<ActionResult | null, FormData>(props.actions.savePersonProfile, null);
  const [roleState, roleAction] = useActionState<ActionResult | null, FormData>(props.actions.changeRole, null);
  const [policyState, policyAction] = useActionState<ActionResult | null, FormData>(props.actions.saveRolePolicy, null);
  const [resendState, resendAction] = useActionState<ActionResult | null, FormData>(props.actions.resend, null);
  const [disableState, disableAction] = useActionState<ActionResult | null, FormData>(props.actions.disable, null);
  const [enableState, enableAction] = useActionState<ActionResult | null, FormData>(props.actions.enable, null);
  const [signOutState, signOutAction] = useActionState<ActionResult | null, FormData>(props.actions.signOutEverywhere, null);
  const [deleteState, deleteAction] = useActionState<ActionResult | null, FormData>(props.actions.deleteUser, null);
  const [transferState, transferAction] = useActionState<ActionResult | null, FormData>(props.actions.transferOwnership, null);

  const customIds = useMemo(
    () => new Set(draftPolicy.customRoles.map((r) => r.id)),
    [draftPolicy.customRoles],
  );
  const customLabels = useMemo(
    () => new Map(draftPolicy.customRoles.map((r) => [r.id, r.label])),
    [draftPolicy.customRoles],
  );

  const counts = useMemo(() => {
    let active = 0;
    let pending = 0;
    let disabled = 0;
    let admins = 0;
    for (const p of rows) {
      const st = statusMeta(p).label;
      if (st === 'Active') active += 1;
      else if (st === 'Invited' || st === 'Expiring soon') pending += 1;
      else disabled += 1;
      if (highestAdminRole(p.groups)) admins += 1;
    }
    return { total: rows.length, active, pending, disabled, admins };
  }, [rows]);

  const membersByRole = useMemo(() => {
    const map = new Map<string, { email: string; name: string }[]>();
    for (const p of rows) {
      const rid = primaryRoleId(p, customIds);
      const prof = props.profiles[p.sub];
      const fullName = [prof?.firstName, prof?.lastName].filter(Boolean).join(' ') || p.name || '';
      const bucket = map.get(rid) ?? [];
      bucket.push({ email: p.email ?? '—', name: fullName });
      map.set(rid, bucket);
    }
    return map;
  }, [rows, customIds, props.profiles]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = rows.filter((p) => {
      if (!q) return true;
      const prof = props.profiles[p.sub];
      const hay = [
        p.email ?? '',
        prof?.firstName ?? '',
        prof?.lastName ?? '',
        prof?.title ?? '',
        displayRoleLabel(primaryRoleId(p, customIds), customLabels),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });

    return [...list].sort((a, b) => {
      const profA = props.profiles[a.sub];
      const profB = props.profiles[b.sub];
      const val = (p: PersonRow, prof: DirectoryProfileMap[string] | undefined): string => {
        switch (sortBy) {
          case 'email':
            return (p.email ?? '').toLowerCase();
          case 'firstName':
            return (prof?.firstName ?? '').toLowerCase();
          case 'lastName':
            return (prof?.lastName ?? '').toLowerCase();
          case 'title':
            return (prof?.title ?? '').toLowerCase();
          case 'role':
            return displayRoleLabel(primaryRoleId(p, customIds), customLabels).toLowerCase();
          case 'status':
            return statusMeta(p).label.toLowerCase();
          case 'lastSeen':
            return props.usage.accounts[p.sub]?.lastSeenAt ?? '';
        }
      };
      const cmp = val(a, profA).localeCompare(val(b, profB));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rows, search, sortBy, sortDir, props.profiles, props.usage.accounts, customIds, customLabels]);

  const selectedPerson = useMemo(
    () => rows.find((p) => p.sub === selectedSub) ?? null,
    [rows, selectedSub],
  );

  const toggleSort = (col: SortField) => {
    if (sortBy === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(col);
      setSortDir('asc');
    }
  };

  const tabCaps = STARTER_ROLE_CATALOG.capabilities.filter((c) => c.group === 'tabs');
  const actionCaps = STARTER_ROLE_CATALOG.capabilities.filter((c) => c.group === 'actions');
  const adminCaps = STARTER_ROLE_CATALOG.capabilities.filter((c) => c.group === 'admin');

  const matrixRoles = useMemo(() => {
    const builtIns = STARTER_ROLE_CATALOG.builtInRoles.filter(
      (r) => r.kind !== 'legacy' || showLegacy,
    );
    const customs = draftPolicy.customRoles.map((r) => ({
      id: r.id,
      label: r.label,
      summary: r.summary,
      kind: 'custom' as const,
      locked: false,
      defaultCapabilities: r.capabilities,
    }));
    return [...builtIns, ...customs];
  }, [draftPolicy.customRoles, showLegacy]);

  const effectiveCapsForRole = (roleId: string): ReadonlySet<string> => {
    const builtIn = STARTER_ROLE_CATALOG.builtInRoles.find((r) => r.id === roleId);
    if (builtIn) {
      if (builtIn.locked) return new Set(builtIn.defaultCapabilities);
      return new Set(draftPolicy.overrides[roleId] ?? builtIn.defaultCapabilities);
    }
    const custom = draftPolicy.customRoles.find((r) => r.id === roleId);
    return new Set(custom?.capabilities ?? []);
  };

  const toggleCapability = (roleId: string, capId: string) => {
    const builtIn = STARTER_ROLE_CATALOG.builtInRoles.find((r) => r.id === roleId);
    const current = new Set(effectiveCapsForRole(roleId));
    if (current.has(capId)) current.delete(capId);
    else current.add(capId);
    const nextList = [...current].sort();

    if (builtIn && !builtIn.locked) {
      setDraftPolicy((cur) => ({
        ...cur,
        overrides: { ...cur.overrides, [roleId]: nextList },
      }));
      return;
    }

    setDraftPolicy((cur) => ({
      ...cur,
      customRoles: cur.customRoles.map((r) =>
        r.id === roleId ? { ...r, capabilities: nextList } : r,
      ),
    }));
  };

  const handleAddCustomRole = () => {
    const id = newRoleId.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-');
    const label = newRoleLabel.trim();
    if (!id || !label) return;
    const next: CustomRoleDefinition = {
      id,
      label,
      summary: newRoleSummary.trim() || 'Custom operational role.',
      capabilities: ['tab.home'],
      createdAt: new Date().toISOString(),
    };
    setDraftPolicy((cur) => ({ ...cur, customRoles: [...cur.customRoles, next] }));
    setNewRoleId('');
    setNewRoleLabel('');
    setNewRoleSummary('');
    setAddingCustom(false);
  };

  const policyDirty =
    JSON.stringify(draftPolicy) !== JSON.stringify(props.rolePolicy.policy);

  if (props.people.state === 'unavailable') {
    return (
      <div className="stack">
        <h1>People</h1>
        <p className="notice notice-error" role="alert">
          — Couldn&apos;t load People: {props.people.reason}
        </p>
      </div>
    );
  }

  return (
    <div className="admin-surface">
      {/* Flat single-row KPI readout strip */}
      <div className="admin-kpi-strip" role="region" aria-label="Directory summary">
        <span className="admin-kpi-item">
          <span className="admin-kpi-label">TOTAL</span> <strong>{counts.total}</strong>
        </span>
        <span className="admin-kpi-item">
          <span className="admin-kpi-label">ACTIVE</span> <strong>{counts.active}</strong>
        </span>
        <span className="admin-kpi-item">
          <span className="admin-kpi-label">PENDING INVITES</span> <strong>{counts.pending}</strong>
        </span>
        <span className="admin-kpi-item">
          <span className="admin-kpi-label">DISABLED</span> <strong>{counts.disabled}</strong>
        </span>
        <span className="admin-kpi-item">
          <span className="admin-kpi-label">SITE ADMINS</span> <strong>{counts.admins}</strong>
        </span>
      </div>

      {/* Sub-navigation + Invite action */}
      <div className="admin-subnav-row">
        <div className="admin-subtabs" role="tablist" aria-label="People views">
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'directory'}
            className={`admin-subtab${subTab === 'directory' ? ' is-active' : ''}`}
            onClick={() => setSubTab('directory')}
          >
            Directory
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'matrix'}
            className={`admin-subtab${subTab === 'matrix' ? ' is-active' : ''}`}
            onClick={() => setSubTab('matrix')}
          >
            Role Matrix
          </button>
          {props.requestsTab && (
            <button
              type="button"
              role="tab"
              aria-selected={subTab === 'requests'}
              className={`admin-subtab${subTab === 'requests' ? ' is-active' : ''}`}
              onClick={() => setSubTab('requests')}
            >
              Pending requests ({props.requestsTab.countLabel})
            </button>
          )}
        </div>
        {props.canManagePeople && (
          <button
            type="button"
            className="admin-primary-btn"
            onClick={() => setShowInvite((v) => !v)}
          >
            {showInvite ? 'Close invite form' : '+ Invite people'}
          </button>
        )}
      </div>

      {showInvite && props.canManagePeople && (
        <div className="admin-inline-drawer">
          <InviteForm
            action={props.actions.invite}
            {...(props.actions.inviteMany && { inviteMany: props.actions.inviteMany })}
            {...(props.signIn && { signIn: props.signIn })}
            viewer={props.viewer}
            appRoles={props.appRoles}
            inviteDomains={props.inviteDomains}
            stepUpHref={props.stepUpHref}
            resourceAccessHref="/app/projects"
            resourceAccess={props.resourceAccess}
          />
        </div>
      )}

      {subTab === 'directory' && (
        <div className={`admin-split${selectedPerson ? ' has-panel' : ''}`}>
          <div className="admin-table-region">
            <div className="admin-toolbar">
              <input
                type="search"
                className="admin-sharp-input"
                aria-label="Search people"
                placeholder="Filter by email, name, title, or role..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <span className="admin-muted-note">
                Showing {filteredRows.length} of {rows.length} people
              </span>
            </div>

            <div className="table-wrap">
              <table className="admin-dense-table">
                <thead>
                  <tr>
                    <th>
                      <button type="button" className="admin-th-btn" onClick={() => toggleSort('email')}>
                        EMAIL {sortBy === 'email' ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                      </button>
                    </th>
                    <th>
                      <button type="button" className="admin-th-btn" onClick={() => toggleSort('firstName')}>
                        FIRST {sortBy === 'firstName' ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                      </button>
                    </th>
                    <th>
                      <button type="button" className="admin-th-btn" onClick={() => toggleSort('lastName')}>
                        LAST {sortBy === 'lastName' ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                      </button>
                    </th>
                    <th>
                      <button type="button" className="admin-th-btn" onClick={() => toggleSort('title')}>
                        TITLE {sortBy === 'title' ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                      </button>
                    </th>
                    <th className="admin-hover-host">
                      <button type="button" className="admin-th-btn" onClick={() => toggleSort('role')}>
                        ROLE {sortBy === 'role' ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                      </button>
                      <div className="admin-hovercard" role="tooltip">
                        <div className="admin-hovercard-title">Site roles</div>
                        <p className="admin-hovercard-copy">
                          Owner and Admin run the site. Viewer and custom roles control which workspace tabs and actions are available.
                        </p>
                      </div>
                    </th>
                    <th className="admin-hover-host">
                      <button type="button" className="admin-th-btn" onClick={() => toggleSort('status')}>
                        STATUS {sortBy === 'status' ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                      </button>
                      <div className="admin-hovercard" role="tooltip">
                        <div className="admin-hovercard-title">Account status guide</div>
                        <ul className="admin-status-guide">
                          <li><span className="admin-status-word is-ok">Active</span> — Verified and able to sign in.</li>
                          <li><span className="admin-status-word is-info">Invited</span> — Invite sent; waiting for first sign-in.</li>
                          <li><span className="admin-status-word is-warn">Expiring soon</span> — Unused invite nearing 7-day expiry.</li>
                          <li><span className="admin-status-word is-danger">Invite expired</span> — Unused past 7 days; invite again.</li>
                          <li><span className="admin-status-word is-danger">Disabled</span> — Sign-in blocked and admin roles removed.</li>
                        </ul>
                      </div>
                    </th>
                    <th>
                      <button type="button" className="admin-th-btn" onClick={() => toggleSort('lastSeen')}>
                        LAST SIGN-IN {sortBy === 'lastSeen' ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((p) => {
                    const prof = props.profiles[p.sub];
                    const st = statusMeta(p);
                    const rid = primaryRoleId(p, customIds);
                    const label = displayRoleLabel(rid, customLabels);
                    const held = effectiveCapsForRole(rid);
                    const lastSeen = props.usage.accounts[p.sub]?.lastSeenAt;
                    const isSelected = p.sub === selectedSub;
                    return (
                      <tr key={p.sub} className={isSelected ? 'is-selected' : undefined}>
                        <td>
                          <button
                            type="button"
                            className="admin-row-link"
                            onClick={() => setSelectedSub(isSelected ? null : p.sub)}
                          >
                            {p.email ?? '—'}
                          </button>
                        </td>
                        <td>{prof?.firstName || '—'}</td>
                        <td>{prof?.lastName || '—'}</td>
                        <td>{prof?.title || '—'}</td>
                        <td className="admin-hover-host">
                          <span className="admin-role-pill">{label}</span>
                          <div className="admin-hovercard" role="tooltip">
                            <div className="admin-hovercard-title">{label} ← Held</div>
                            <ul className="admin-mini-caps">
                              {STARTER_ROLE_CATALOG.capabilities.map((cap) => (
                                <li key={cap.id}>
                                  <span>{held.has(cap.id) ? '✓' : '—'}</span> {cap.label}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </td>
                        <td>
                          <span className={`admin-status-word is-${st.tone}`}>{st.label}</span>
                        </td>
                        <td className="admin-num">{formatDateShort(lastSeen)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {selectedPerson && (
            <aside className="admin-side-panel" aria-label="Account details">
              <div className="admin-panel-head">
                <div>
                  <div className="admin-panel-title">{selectedPerson.email ?? 'Account'}</div>
                  <div className="admin-muted-note">
                    {displayRoleLabel(primaryRoleId(selectedPerson, customIds), customLabels)} ·{' '}
                    {statusMeta(selectedPerson).label}
                  </div>
                </div>
                <button
                  type="button"
                  className="admin-ghost-btn"
                  onClick={() => setSelectedSub(null)}
                >
                  Close
                </button>
              </div>

              {props.canManagePeople && (
                <>
                  <form action={profileAction} className="admin-panel-section">
                    <input type="hidden" name="sub" value={selectedPerson.sub} />
                    <input type="hidden" name="email" value={selectedPerson.email ?? ''} />
                    <div className="admin-section-label">Directory profile</div>
                    <label className="admin-field-label">
                      First name
                      <input
                        name="firstName"
                        className="admin-sharp-input"
                        defaultValue={props.profiles[selectedPerson.sub]?.firstName ?? ''}
                      />
                    </label>
                    <label className="admin-field-label">
                      Last name
                      <input
                        name="lastName"
                        className="admin-sharp-input"
                        defaultValue={props.profiles[selectedPerson.sub]?.lastName ?? ''}
                      />
                    </label>
                    <label className="admin-field-label">
                      Title
                      <input
                        name="title"
                        className="admin-sharp-input"
                        defaultValue={props.profiles[selectedPerson.sub]?.title ?? ''}
                      />
                    </label>
                    <button type="submit" className="admin-primary-btn">
                      Save profile
                    </button>
                    <ActionResultMessage result={profileState} stepUpHref={props.stepUpHref} />
                  </form>

                  <form action={roleAction} className="admin-panel-section">
                    <input type="hidden" name="sub" value={selectedPerson.sub} />
                    <div className="admin-panel-row-head">
                      <span className="admin-section-label">Change role</span>
                      <span className="admin-hover-host">
                        <span className="admin-inline-hint">Role Matrix preview</span>
                        <span className="admin-hovercard admin-hovercard-right" role="tooltip">
                          <span className="admin-hovercard-title">Role levels</span>
                          {matrixRoles.map((r) => (
                            <span key={r.id} className="admin-hover-row">
                              <strong>{r.label}</strong>: {r.summary}
                            </span>
                          ))}
                        </span>
                      </span>
                    </div>
                    <select
                      name="toRole"
                      className="admin-sharp-input"
                      defaultValue={primaryRoleId(selectedPerson, customIds)}
                    >
                      <option value="superadmin">Admin</option>
                      {showLegacy && (
                        <>
                          <option value="admin-content-people">Admin – content &amp; people</option>
                          <option value="admin-content">Admin – content only</option>
                          <option value="admin-view">Admin – view only</option>
                        </>
                      )}
                      {props.appRoles.map((r) => (
                        <option key={r} value={r}>
                          {displayRoleLabel(r, customLabels)}
                        </option>
                      ))}
                      <option value="member">Viewer</option>
                    </select>
                    <label className="admin-field-label">
                      Reason (audited)
                      <input name="reason" className="admin-sharp-input" placeholder="Short reason for audit log..." />
                    </label>
                    <button type="submit" className="admin-secondary-btn">
                      Update role
                    </button>
                    <ActionResultMessage result={roleState} stepUpHref={props.stepUpHref} />
                  </form>

                  <div className="admin-panel-section">
                    <div className="admin-section-label">Account actions</div>
                    <div className="admin-action-stack">
                      <form action={resendAction}>
                        <input type="hidden" name="sub" value={selectedPerson.sub} />
                        <button type="submit" className="admin-secondary-btn">Resend invite</button>
                      </form>
                      {selectedPerson.enabled ? (
                        <form action={disableAction}>
                          <input type="hidden" name="sub" value={selectedPerson.sub} />
                          <button type="submit" className="admin-secondary-btn">Disable account</button>
                        </form>
                      ) : (
                        <form action={enableAction}>
                          <input type="hidden" name="sub" value={selectedPerson.sub} />
                          <button type="submit" className="admin-secondary-btn">Re-enable account</button>
                        </form>
                      )}
                      <form action={signOutAction}>
                        <input type="hidden" name="sub" value={selectedPerson.sub} />
                        <button type="submit" className="admin-secondary-btn">Sign out everywhere</button>
                      </form>
                      <form action={transferAction} className="admin-inline-subform">
                        <input type="hidden" name="sub" value={selectedPerson.sub} />
                        <input name="confirmEmail" className="admin-sharp-input" placeholder="Type their email to transfer ownership" />
                        <input name="reason" className="admin-sharp-input" placeholder="Reason for ownership transfer" />
                        <button type="submit" className="admin-secondary-btn">Transfer ownership</button>
                      </form>
                      <form action={deleteAction}>
                        <input type="hidden" name="sub" value={selectedPerson.sub} />
                        <button type="submit" className="admin-danger-btn">Delete disabled account</button>
                      </form>
                    </div>
                    <ActionResultMessage result={resendState ?? disableState ?? enableState ?? signOutState ?? transferState ?? deleteState} stepUpHref={props.stepUpHref} />
                  </div>
                </>
              )}
            </aside>
          )}
        </div>
      )}

      {subTab === 'matrix' && (
        <div className="admin-matrix-wrap">
          <div className="admin-toolbar">
            <label className="admin-checkbox-label">
              <input
                type="checkbox"
                checked={showLegacy}
                onChange={(e) => setShowLegacy(e.target.checked)}
              />
              Show legacy admin tiers
            </label>
            {props.canEditPolicy && (
              <button
                type="button"
                className="admin-secondary-btn"
                onClick={() => setAddingCustom((v) => !v)}
              >
                {addingCustom ? 'Cancel custom role' : '+ New custom role'}
              </button>
            )}
          </div>

          {addingCustom && (
            <div className="admin-inline-drawer">
              <div className="admin-custom-role-form">
                <input
                  className="admin-sharp-input"
                  placeholder="Role ID (e.g. reviewer)"
                  value={newRoleId}
                  onChange={(e) => setNewRoleId(e.target.value)}
                />
                <input
                  className="admin-sharp-input"
                  placeholder="Display name (e.g. Reviewer)"
                  value={newRoleLabel}
                  onChange={(e) => setNewRoleLabel(e.target.value)}
                />
                <input
                  className="admin-sharp-input"
                  placeholder="One-line description"
                  value={newRoleSummary}
                  onChange={(e) => setNewRoleSummary(e.target.value)}
                />
                <button type="button" className="admin-primary-btn" onClick={handleAddCustomRole}>
                  Stage custom role
                </button>
              </div>
            </div>
          )}

          <div className="table-wrap">
            <table className="admin-matrix-table">
              <thead>
                <tr className="admin-matrix-group-row">
                  <th rowSpan={2}>ROLE, SCOPE &amp; HEADCOUNT</th>
                  <th colSpan={tabCaps.length}>VISIBLE TABS</th>
                  <th colSpan={actionCaps.length}>APP ACTIONS</th>
                  <th colSpan={adminCaps.length} className="is-locked-group">
                    ADMINISTRATION (LOCKED)
                  </th>
                </tr>
                <tr>
                  {[...tabCaps, ...actionCaps, ...adminCaps].map((cap) => (
                    <th key={cap.id} className="admin-hover-host">
                      <span className="admin-matrix-col-label">{cap.label}</span>
                      <div className="admin-hovercard" role="tooltip">
                        <div className="admin-hovercard-title">{cap.label}</div>
                        <p className="admin-hovercard-copy">{cap.plainDescription}</p>
                        <div className="admin-hovercard-tech">{cap.technicalNote}</div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrixRoles.map((role) => {
                  const caps = effectiveCapsForRole(role.id);
                  const roster = membersByRole.get(role.id) ?? [];
                  return (
                    <tr key={role.id}>
                      <td>
                        <div className="admin-matrix-role-head">
                          <strong>{role.label}</strong>
                          {role.locked && <span className="admin-lock-tag">Locked</span>}
                          <span className="admin-hover-host">
                            <span className="admin-headcount-pill">
                              {roster.length} {roster.length === 1 ? 'person' : 'people'}
                            </span>
                            <span className="admin-hovercard" role="tooltip">
                              <span className="admin-hovercard-title">{role.label} roster</span>
                              {roster.length === 0 ? (
                                <span className="admin-hovercard-copy">No accounts assigned.</span>
                              ) : (
                                roster.map((m) => (
                                  <span key={m.email} className="admin-hover-row">
                                    {m.name ? `${m.name} · ` : ''}{m.email}
                                  </span>
                                ))
                              )}
                            </span>
                          </span>
                        </div>
                        <div className="admin-muted-note">{role.summary}</div>
                      </td>
                      {[...tabCaps, ...actionCaps, ...adminCaps].map((cap) => {
                        const allowed = caps.has(cap.id);
                        const canToggle = props.canEditPolicy && !role.locked && !cap.locked;
                        return (
                          <td key={cap.id} className="admin-matrix-cell">
                            {canToggle ? (
                              <button
                                type="button"
                                aria-pressed={allowed}
                                className={`admin-cell-toggle${allowed ? ' is-on' : ''}`}
                                onClick={() => toggleCapability(role.id, cap.id)}
                              >
                                {allowed ? '✓' : '—'}
                              </button>
                            ) : (
                              <span className={`admin-cell-static${allowed ? ' is-on' : ''}`}>
                                {allowed ? '✓' : '—'}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {policyDirty && props.canEditPolicy && (
            <form action={policyAction} className="admin-staged-bar">
              <input type="hidden" name="expectedVersion" value={String(props.rolePolicy.version)} />
              <input type="hidden" name="policyJson" value={JSON.stringify(draftPolicy)} />
              <strong>Unsaved role policy changes</strong>
              <input
                name="reason"
                className="admin-sharp-input"
                placeholder="Short reason for audit log..."
                value={policyReason}
                onChange={(e) => setPolicyReason(e.target.value)}
              />
              <button type="submit" className="admin-primary-btn">
                Save policy
              </button>
              <button
                type="button"
                className="admin-ghost-btn"
                onClick={() => setDraftPolicy(props.rolePolicy.policy)}
              >
                Discard
              </button>
            </form>
          )}
          <ActionResultMessage result={policyState} stepUpHref={props.stepUpHref} />
        </div>
      )}

      {subTab === 'requests' && props.requestsTab && (
        <div className="table-wrap">{props.requestsTab.node}</div>
      )}
    </div>
  );
}
