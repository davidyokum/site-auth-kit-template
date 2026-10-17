'use server';
/**
 * The People page's server actions. Library code can't be a server action, so each one wraps
 * auth-kit's form action. Each re-checks the acting person live (`requireCan(…, { live: true })`),
 * validates input, re-reads the target, runs the guardrails, asks for a recent sign-in before a
 * grant or a delete, and logs intent and result (auth-kit ADR 0010, 0011).
 */
import type { ActionResult } from 'auth-kit/admin';
import { revalidatePath } from 'next/cache';
import { peopleActions } from '@/lib/admin';

function after(result: ActionResult): ActionResult {
  if (result.ok) revalidatePath('/admin/people');
  return result;
}

export async function invite(previous: ActionResult | null, data: FormData): Promise<ActionResult> {
  return after(await peopleActions().forms.invite(previous, data));
}

export async function resend(previous: ActionResult | null, data: FormData): Promise<ActionResult> {
  return after(await peopleActions().forms.resend(previous, data));
}

export async function changeRole(previous: ActionResult | null, data: FormData): Promise<ActionResult> {
  return after(await peopleActions().forms.changeRole(previous, data));
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
