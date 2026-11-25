/**
 * People (primer §9; auth-kit ADR 0020, 0029, & 0031): live directory, Guarded Staged Role Builder,
 * "Add several at once" invites, and pending access requests (on request sites).
 */
import { PendingRequestsTable } from 'auth-kit/admin/ui';
import { ResourceRolesSummary } from 'auth-kit/resources/ui';
import type { Metadata } from 'next';
import { PeopleWorkspace } from '@/components/admin/people-workspace';
import { accessRequests } from '@/lib/accounts';
import { peopleActions, stepUpHref } from '@/lib/admin';
import { directoryProfileStore, siteRolePolicyStore, usageLedgerStore } from '@/lib/admin-stores';
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
  inviteMany,
  resend,
  savePersonProfile,
  saveRolePolicy,
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
  const canEditPolicy = user.capabilities.has('settings.security');

  const [list, profiles, usage, rolePolicy] = await Promise.all([
    peopleActions().listPeople().catch(failure),
    directoryProfileStore().getAll().catch(() => ({})),
    usageLedgerStore().get().catch(() => ({ accounts: {}, dailyCounts: {} })),
    siteRolePolicyStore().get().catch(() => ({ policy: { overrides: {}, customRoles: [] }, version: 0, updatedAt: null, updatedBy: null })),
  ]);

  const takesRequests = accessRequests() !== null;
  const requestList = takesRequests && manages ? await peopleActions().listAccessRequests().catch(failure) : null;

  return (
    <PeopleWorkspace
      people={list}
      viewer={viewer}
      appRoles={site.appRoles}
      inviteDomains={site.inviteDomains}
      stepUpHref={reauth}
      profiles={profiles}
      usage={usage}
      rolePolicy={rolePolicy}
      canManagePeople={manages}
      canEditPolicy={canEditPolicy}
      signIn={site.signIn}
      resourceAccess={<ResourceRolesSummary noun="project" href="/app/projects" />}
      {...(requestList
        ? {
            requestsTab: {
              countLabel: requestList.state === 'ok' ? String(requestList.requests.length) : '—',
              node: (
                <PendingRequestsTable
                  list={requestList}
                  viewer={viewer}
                  appRoles={site.appRoles}
                  actions={{ approveRequest, declineRequest, declineRequests }}
                  stepUpHref={reauth}
                />
              ),
            },
          }
        : {})}
      actions={{
        invite,
        inviteMany,
        resend,
        changeRole,
        transferOwnership,
        disable,
        enable,
        signOutEverywhere,
        deleteUser,
        savePersonProfile,
        saveRolePolicy,
      }}
    />
  );
}
