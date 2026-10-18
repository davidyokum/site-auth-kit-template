'use server';
/**
 * One project's server actions. Each checks for itself, whatever the page around it did:
 * - editing: `requireResourceRole('project', id, 'edit', { live: true })` (a demoted admin loses the
 *   site floor at once), then an audited, conditional save (lib/projects/service.ts);
 * - access: auth-kit's resource actions, which re-read the acting person live, check their access to
 *   the project, keep at least one Manager, and log intent and result.
 * test/unit/actions.test.ts covers them (the auth matrix can't see server actions).
 */
import type { ActionResult } from 'auth-kit/admin';
import { RESOURCE_FORM_FIELDS } from 'auth-kit/resources';
import { AuthUnavailableError, ForbiddenError, NotFoundError, isAuthError } from 'auth-kit/server';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { projectStore, validateProjectInput } from '@/lib/projects';
import { updateProject } from '@/lib/projects/service';
import { resourceActions } from '@/lib/resource-actions';

export type ProjectEditState = { ok: true; message: string } | { ok: false; error: string; field?: 'name' | 'summary' };

function after(result: ActionResult, data: FormData): ActionResult {
  const id = data.get(RESOURCE_FORM_FIELDS.id);
  if (result.ok && typeof id === 'string') revalidatePath(`/app/projects/${id}`);
  return result;
}

export async function addMember(previous: ActionResult | null, data: FormData): Promise<ActionResult> {
  return after(await resourceActions().forms.add(previous, data), data);
}

export async function changeMemberRole(previous: ActionResult | null, data: FormData): Promise<ActionResult> {
  return after(await resourceActions().forms.changeRole(previous, data), data);
}

/** Removes someone, or (with your own sub) leaves the project. */
export async function removeMember(previous: ActionResult | null, data: FormData): Promise<ActionResult> {
  return after(await resourceActions().forms.remove(previous, data), data);
}

/** A Manager invites someone new: access to this one project only; the site's admins are alerted. */
export async function inviteToProject(previous: ActionResult | null, data: FormData): Promise<ActionResult> {
  return after(await resourceActions().forms.invite(previous, data), data);
}

export async function updateProjectAction(_previous: ProjectEditState | null, data: FormData): Promise<ProjectEditState> {
  const id = data.get('id');
  const expectedUpdatedAt = data.get('updatedAt');
  if (typeof id !== 'string' || typeof expectedUpdatedAt !== 'string') return { ok: false, error: 'That request is invalid.' };
  let access;
  try {
    access = await auth.requireResourceRole('project', id, 'edit', { live: true });
  } catch (error) {
    if (error instanceof NotFoundError) return { ok: false, error: 'That project doesn’t exist, or you don’t have access to it.' };
    if (error instanceof ForbiddenError) return { ok: false, error: 'You can see this project but not edit it.' };
    if (error instanceof AuthUnavailableError) return { ok: false, error: 'Couldn’t check your access right now. Nothing was saved; try again.' };
    if (isAuthError(error)) return { ok: false, error: 'Your session has ended or doesn’t allow this. Sign in again, then retry.' };
    throw error;
  }
  const input = validateProjectInput({ name: data.get('name'), summary: data.get('summary') });
  if (!input.ok) return { ok: false, error: input.error, field: input.field };
  const current = await projectStore().get(id);
  if (!current) return { ok: false, error: 'This project no longer exists.' };
  const result = await updateProject(access.user, current, input, expectedUpdatedAt);
  if (!result.ok) return { ok: false, error: result.message };
  revalidatePath(`/app/projects/${id}`);
  revalidatePath('/app/projects');
  return { ok: true, message: result.outcomeLogged ? 'Saved.' : 'Saved, but the activity log didn’t record the outcome.' };
}
