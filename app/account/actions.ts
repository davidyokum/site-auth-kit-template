'use server';
/**
 * My account's own-account actions on sign-up sites (auth-kit `createSelfServiceActions`, lib/
 * accounts.ts): change my email (a code to the new address, verified before it takes effect; the old
 * address told) and delete my account. Each checks the signed-in person live, needs a sign-in in the
 * last 5 minutes, is audited as that person, and is refused on invite-only and request sites, where
 * admins change accounts.
 */
import type { ActionResult } from 'auth-kit/admin';
import { selfService } from '@/lib/accounts';

export async function requestEmailChange(input: { newEmail: string }): Promise<ActionResult> {
  return selfService().requestEmailChange(input);
}

export async function confirmEmailChange(input: { code: string }): Promise<ActionResult> {
  return selfService().confirmEmailChange(input);
}

export async function deleteMyAccount(input: { confirmEmail: string }): Promise<ActionResult> {
  return selfService().deleteMyAccount(input);
}
