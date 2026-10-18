'use server';
/**
 * Creating a project. Server actions are public HTTP endpoints: this checks the person itself,
 * validates its input, and lets auth-kit decide (live) whether they may create one and whom they may
 * make its Manager, writing the project's access and the project as one audited change.
 * test/unit/actions.test.ts covers it (the auth matrix can't see server actions).
 */
import { AuthUnavailableError, isAuthError } from 'auth-kit/server';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { validateProjectInput } from '@/lib/projects';
import { createProject } from '@/lib/projects/service';

export type ProjectFormState = { ok: true; message: string; projectId: string } | { ok: false; error: string; field?: 'name' | 'summary' | 'managerEmail' };

export async function createProjectAction(_previous: ProjectFormState | null, data: FormData): Promise<ProjectFormState> {
  let user;
  try {
    user = await auth.requireUser();
  } catch (error) {
    // "Couldn't check" is not "signed out": say which, and that nothing was saved.
    if (error instanceof AuthUnavailableError) return { ok: false, error: 'Couldn’t check your sign-in right now. Nothing was saved; try again.' };
    if (isAuthError(error)) return { ok: false, error: 'Your session has ended or doesn’t allow this. Sign in again, then retry.' };
    throw error;
  }

  const input = validateProjectInput({ name: data.get('name'), summary: data.get('summary') });
  if (!input.ok) return { ok: false, error: input.error, field: input.field };
  const manager = data.get('managerEmail');
  const managerEmail = typeof manager === 'string' && manager.trim() !== '' ? manager.trim() : undefined;

  const result = await createProject(user, { ...input, ...(managerEmail !== undefined && { managerEmail }) });
  if (!result.ok) {
    return { ok: false, error: result.error, ...(result.code === 'refused' && managerEmail !== undefined && { field: 'managerEmail' as const }) };
  }
  revalidatePath('/app/projects');
  return { ok: true, message: result.message, projectId: result.id };
}
