'use server';
/**
 * The People page's server actions. Library code can't be a server action, so each one wraps
 * auth-kit's form action. Each re-checks the acting person live (`requireCan(…, { live: true })`),
 * validates input, re-reads the target, runs the guardrails (site-wide roles, ADR 0020), asks for a
 * recent sign-in before a grant, a transfer, or a delete, and logs intent and result (ADR 0010).
 */
import type { ActionResult, StoredRolePolicy } from 'auth-kit/admin';
import { revalidatePath } from 'next/cache';
import { peopleActions } from '@/lib/admin';
import { directoryProfileStore, siteRolePolicyStore } from '@/lib/admin-stores';
import { auth } from '@/lib/auth';

function after(result: ActionResult): ActionResult {
  if (result.ok) {
    revalidatePath('/admin');
    revalidatePath('/admin/people');
  }
  return result;
}

export async function invite(previous: ActionResult | null, data: FormData): Promise<ActionResult> {
  return after(await peopleActions().forms.invite(previous, data));
}

/** "Add several at once" (auth-kit ADR 0029): up to 50 pasted addresses, as Member or an app role, each the ordinary invite. */
export async function inviteMany(previous: ActionResult | null, data: FormData): Promise<ActionResult> {
  return after(await peopleActions().forms.inviteMany(previous, data));
}

export async function resend(previous: ActionResult | null, data: FormData): Promise<ActionResult> {
  return after(await peopleActions().forms.resend(previous, data));
}

export async function changeRole(previous: ActionResult | null, data: FormData): Promise<ActionResult> {
  return after(await peopleActions().forms.changeRole(previous, data));
}

/** The owner hands the site to someone who has signed in; the owner becomes Super admin. */
export async function transferOwnership(previous: ActionResult | null, data: FormData): Promise<ActionResult> {
  return after(await peopleActions().forms.transferOwnership(previous, data));
}

export async function disable(previous: ActionResult | null, data: FormData): Promise<ActionResult> {
  return after(await peopleActions().forms.disable(previous, data));
}

export async function enable(previous: ActionResult | null, data: FormData): Promise<ActionResult> {
  return after(await peopleActions().forms.enable(previous, data));
}

export async function signOutEverywhere(previous: ActionResult | null, data: FormData): Promise<ActionResult> {
  return after(await peopleActions().forms.signOutEverywhere(previous, data));
}

export async function deleteUser(previous: ActionResult | null, data: FormData): Promise<ActionResult> {
  return after(await peopleActions().forms.deleteUser(previous, data));
}

// ---- Request sites only (site.config.ts `accountCreation`): the "Pending requests" tab --------------
// Each needs `people.manage`, checked live. Elsewhere the store isn't configured and they're refused.

/** Approve: the ordinary invite (Member by default), under the name the approver checked. */
export async function approveRequest(previous: ActionResult | null, data: FormData): Promise<ActionResult> {
  return after(await peopleActions().forms.approveRequest(previous, data));
}

/** Decline one: removed from the queue, silently (the site sends no note unless notifyOnDecline). */
export async function declineRequest(previous: ActionResult | null, data: FormData): Promise<ActionResult> {
  return after(await peopleActions().forms.declineRequest(previous, data));
}

/** "Decline all shown": up to 100 in one audited step, always silent (a flood of junk requests is one click). */
export async function declineRequests(previous: ActionResult | null, data: FormData): Promise<ActionResult> {
  return after(await peopleActions().forms.declineRequests(previous, data));
}

export async function savePersonProfile(_previous: ActionResult | null, data: FormData): Promise<ActionResult> {
  try {
    const actor = await auth.requireCan('people.manage', { live: true });
    const sub = String(data.get('sub') ?? '').trim();
    const email = String(data.get('email') ?? '').trim();
    const firstName = String(data.get('firstName') ?? '');
    const lastName = String(data.get('lastName') ?? '');
    const title = String(data.get('title') ?? '');
    await directoryProfileStore().setProfile({
      sub,
      ...(email ? { email } : {}),
      firstName,
      lastName,
      title,
      actor: { sub: actor.sub, ...(actor.profile?.email ? { email: actor.profile.email } : {}) },
    });
    revalidatePath('/admin');
    revalidatePath('/admin/people');
    return { ok: true, message: 'Directory profile saved.' };
  } catch (error) {
    return {
      ok: false,
      code: 'unavailable',
      error: error instanceof Error ? error.message : 'Couldn’t save directory profile.',
      changed: 'nothing',
    };
  }
}

export async function saveRolePolicy(_previous: ActionResult | null, data: FormData): Promise<ActionResult> {
  try {
    const actor = await auth.requireCan('settings.security', { live: true, recentSignIn: true });
    const expectedVersion = Number(data.get('expectedVersion') ?? 0);
    const reason = String(data.get('reason') ?? '');
    const rawJson = String(data.get('policyJson') ?? '{}');
    const draft = JSON.parse(rawJson) as StoredRolePolicy;
    await siteRolePolicyStore().save({
      draft,
      expectedVersion: Number.isFinite(expectedVersion) ? expectedVersion : 0,
      reason,
      actor: { sub: actor.sub, ...(actor.profile?.email ? { email: actor.profile.email } : {}) },
    });
    revalidatePath('/admin');
    revalidatePath('/admin/people');
    return { ok: true, message: 'Role policy saved and enforced live.' };
  } catch (error) {
    return {
      ok: false,
      code: 'invalid',
      error: error instanceof Error ? error.message : 'Couldn’t save role policy.',
      changed: 'nothing',
    };
  }
}
