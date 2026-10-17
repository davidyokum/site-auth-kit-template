/**
 * People (primer §9): each button is one Cognito call and says when it takes effect. The list is a
 * live ListUsers snapshot; a failed fetch shows "—" and the reason, never an empty list.
 */
import { InviteForm, PeopleTable } from 'auth-kit/admin/ui';
import type { Metadata } from 'next';
import { peopleActions, stepUpHref } from '@/lib/admin';
import { pages } from '@/lib/auth';
import { site } from '@/site.config';
import { changeRole, deleteUser, disable, enable, invite, resend, signOutEverywhere } from './actions';

export const metadata: Metadata = { title: 'People' };

export default async function PeoplePage() {
  const user = await pages.requireCan('people.manage', { live: true });
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
      <InviteForm action={invite} viewer={viewer} appRoles={site.appRoles} inviteDomains={site.inviteDomains} stepUpHref={reauth} />
      <div className="table-wrap">
        <PeopleTable
          people={list}
          viewer={viewer}
          appRoles={site.appRoles}
          actions={{ resend, changeRole, disable, enable, signOutEverywhere, deleteUser }}
          stepUpHref={reauth}
        />
      </div>
    </div>
  );
}
