'use server';
/**
 * Settings → "Sign-in help" (auth-kit `createSignInHelpActions`, lib/accounts.ts) and
 * "Invite welcome paragraph" (`inviteWelcomeStore`, lib/admin-stores.ts). Each checks
 * `settings.security` live with recent sign-in step-up and writes an audited intent + result.
 */
import type { ActionResult } from 'auth-kit/admin';
import { revalidatePath } from 'next/cache';
import { signInHelpActions } from '@/lib/accounts';
import { inviteWelcomeStore } from '@/lib/admin-stores';
import { auth } from '@/lib/auth';

function after(result: ActionResult): ActionResult {
  if (result.ok) revalidatePath('/admin/settings');
  return result;
}

/** Point people who need help signing in at another mailbox (on the allowed domains). */
export async function setSignInHelp(previous: ActionResult | null, data: FormData): Promise<ActionResult> {
  return after(await signInHelpActions().forms.set(previous, data));
}

/** Go back to the site's configured help address. */
export async function clearSignInHelp(previous: ActionResult | null, data: FormData): Promise<ActionResult> {
  return after(await signInHelpActions().forms.clear(previous, data));
}

/** Save or clear the custom invitation email welcome paragraph. */
export async function saveInviteWelcome(_previous: ActionResult | null, data: FormData): Promise<ActionResult> {
  try {
    const actor = await auth.requireCan('settings.security', { live: true, recentSignIn: true });
    const note = String(data.get('note') ?? '');
    const expectedVersion = Number(data.get('expectedVersion') ?? 0);
    await inviteWelcomeStore().save({
      note,
      expectedVersion: Number.isFinite(expectedVersion) ? expectedVersion : 0,
      actor: { sub: actor.sub, ...(actor.profile?.email ? { email: actor.profile.email } : {}) },
    });
    revalidatePath('/admin/settings');
    return { ok: true, message: 'Invitation welcome paragraph saved.' };
  } catch (error) {
    return {
      ok: false,
      code: 'invalid',
      error: error instanceof Error ? error.message : 'Couldn’t save welcome paragraph.',
      changed: 'nothing',
    };
  }
}
