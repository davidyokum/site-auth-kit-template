'use server';
/**
 * Settings → "Sign-in help" (auth-kit `createSignInHelpActions`, lib/accounts.ts). Each checks
 * `settings.security` live, needs a recent sign-in and a reason, writes the audit intent and result,
 * and emails the owner and every Super admin (undone if that email can't be sent).
 */
import type { ActionResult } from 'auth-kit/admin';
import { revalidatePath } from 'next/cache';
import { signInHelpActions } from '@/lib/accounts';

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
