/**
 * People (primer §9; auth-kit ADR 0020): each button is one Cognito call and says when it takes
 * effect. The list is a live ListUsers snapshot; a failed fetch shows "—" and the reason, never an
 * empty list. Every admin role sees the list; inviting needs `people.manage`, and each action checks
 * its own capability on the server. The role picker shows each role's can and can't, "Compare
 * roles", and the note that these roles are for running the site (access to items is per item).
 */
import { InviteForm, PeopleTable, RoleMatrixTable } from 'auth-kit/admin/ui';
import type { Metadata } from 'next';
import { peopleActions, stepUpHref } from '@/lib/admin';
import { pages } from '@/lib/auth';
import { site } from '@/site.config';
import { changeRole, deleteUser, disable, enable, invite, resend, signOutEverywhere, transferOwnership } from './actions';

export const metadata: Metadata = { title: 'People' };

export default async function PeoplePage() {
  const user = await pages.requireCan('people.read', { live: true });
  const viewer = { sub: user.sub, groups: [...user.groups], capabilities: [...user.capabilities] };
  const reauth = stepUpHref('/admin/people');
  let list;
  try {
    list = await peopleActions().listPeople();
  } catch (error) {
    list = { state: 'unavailable' as const, reason: error instanceof Error ? error.message : String(error) };
  }
  return (
    <div className="stack">
      <h1>People</h1>
      {user.capabilities.has('people.manage') ? (
        <InviteForm action={invite} viewer={viewer} appRoles={site.appRoles} inviteDomains={site.inviteDomains} stepUpHref={reauth} />
      ) : (
        <details className="card">
          <summary>Compare roles</summary>
          <RoleMatrixTable />
        </details>
      )}
      <div className="table-wrap">
        <PeopleTable
          people={list}
          viewer={viewer}
          appRoles={site.appRoles}
          actions={{ resend, changeRole, transferOwnership, disable, enable, signOutEverywhere, deleteUser }}
          stepUpHref={reauth}
        />
      </div>
    </div>
  );
}
