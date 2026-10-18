/**
 * People (primer §9; auth-kit ADR 0020): each button is one Cognito call and says when it takes
 * effect. The list is a live ListUsers snapshot; a failed fetch shows "—" and the reason, never an
 * empty list. Every admin role sees the list; inviting needs `people.manage`, and each action checks
 * its own capability on the server. The role picker shows each role's can and can't, "Compare
 * roles", and the note that these roles are for running the site, linked to the projects, with the
 * resource roles (Manager, Contributor, Reader on each project) summarized under it.
 *
 * On request sites (site.config.ts `accountCreation`), a "Pending requests" tab with a badge: who
 * asked, in their own (untrusted) words, approve (the ordinary invite) or decline (silently), and
 * "Decline all shown" for a flood. A count that can't be read shows "—" and why, never zero.
 */
import { InviteForm, PeoplePageTabs, PeopleTable, PendingRequestsTable, RoleMatrixTable } from 'auth-kit/admin/ui';
import { ResourceRolesSummary } from 'auth-kit/resources/ui';
import type { Metadata } from 'next';
import { accessRequests } from '@/lib/accounts';
import { peopleActions, stepUpHref } from '@/lib/admin';
import { pages } from '@/lib/auth';
import { site } from '@/site.config';
import {
  approveRequest,
  changeRole,
  declineRequest,
  declineRequests,
  deleteUser,
  disable,
  enable,
  invite,
  resend,
  signOutEverywhere,
  transferOwnership,
} from './actions';

export const metadata: Metadata = { title: 'People' };

const failure = (error: unknown) => ({ state: 'unavailable' as const, reason: error instanceof Error ? error.message : String(error) });

export default async function PeoplePage() {
  const user = await pages.requireCan('people.read', { live: true });
  const viewer = { sub: user.sub, groups: [...user.groups], capabilities: [...user.capabilities] };
  const reauth = stepUpHref('/admin/people');
  const manages = user.capabilities.has('people.manage');
  const list = await peopleActions().listPeople().catch(failure);
  // The request queue: only on request sites, and only for admins who can act on it.
  const takesRequests = accessRequests() !== null;
  const requestList = takesRequests && manages ? await peopleActions().listAccessRequests().catch(failure) : null;
  // Where access to one project lives, under every site role picker (auth-kit ADR 0020, 0022).
  const itemAccess = { resourceAccessHref: '/app/projects', resourceAccess: <ResourceRolesSummary noun="project" href="/app/projects" /> };
  const people = (
    <div className="stack">
      {manages ? (
        <InviteForm action={invite} viewer={viewer} appRoles={site.appRoles} inviteDomains={site.inviteDomains} stepUpHref={reauth} {...itemAccess} />
      ) : (
        <details className="card">
          <summary>Compare roles</summary>
          <RoleMatrixTable />
          <ResourceRolesSummary noun="project" href="/app/projects" />
        </details>
      )}
      <div className="table-wrap">
        <PeopleTable
          people={list}
          viewer={viewer}
          appRoles={site.appRoles}
          actions={{ resend, changeRole, transferOwnership, disable, enable, signOutEverywhere, deleteUser }}
          stepUpHref={reauth}
          {...itemAccess}
        />
      </div>
    </div>
  );
  return (
    <div className="stack">
      <h1>People</h1>
      <PeoplePageTabs
        people={people}
        {...(requestList && {
          requestList,
          requests: (
            <div className="table-wrap">
              <PendingRequestsTable list={requestList} viewer={viewer} appRoles={site.appRoles} actions={{ approveRequest, declineRequest, declineRequests }} stepUpHref={reauth} />
            </div>
          ),
        })}
      />
    </div>
  );
}
