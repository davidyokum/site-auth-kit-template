/**
 * Creating and editing projects, shared by the server actions and the API routes so both check,
 * log, and report trouble the same honest way.
 *
 * - Creating: auth-kit's `create` writes the project's access (its first Manager) and then, inside
 *   the same audited change (`resources.create`), the project itself; if the project can't be
 *   written, the access is removed again.
 * - Editing: the store write wrapped in the audit log's intent → call → result ordering
 *   (`projects.update`, auth-kit `recordChange`, ADR 0010), conditional on the version the editor saw.
 *
 * The callers check access first (`requireResourceRole`): these never decide who may.
 */
import 'server-only';
import { AuditIncompleteError, AuditUnavailableError, recordChange } from 'auth-kit/admin';
import type { CreateResourceResult } from 'auth-kit/resources';
import type { AuthUser } from 'auth-kit/server';
import { auditLog } from '@/lib/audit-log';
import { resourceActions } from '@/lib/resource-actions';
import { projectStore } from './index';
import { type Project, ProjectEditConflict } from './types';

export function createProject(user: Pick<AuthUser, 'sub'>, input: { name: string; summary: string; managerEmail?: string }): Promise<CreateResourceResult<Project>> {
  const at = new Date().toISOString();
  return resourceActions().create({
    type: 'project',
    ...(input.managerEmail !== undefined && { managerEmail: input.managerEmail }),
    run: ({ id }) => projectStore().create({ id, name: input.name, summary: input.summary, createdAt: at, createdBy: user.sub, updatedAt: at, updatedBy: user.sub }),
  });
}

export type UpdateProjectResult =
  /** Saved. `outcomeLogged: false`: saved and its intent logged, but the result row isn't. */
  | { ok: true; project: Project; outcomeLogged: boolean }
  | { ok: false; reason: 'not_found' | 'conflict' | 'audit_unavailable'; message: string };

export async function updateProject(
  user: Pick<AuthUser, 'sub' | 'profile'>,
  current: Project,
  changes: { name: string; summary: string },
  expectedUpdatedAt: string,
): Promise<UpdateProjectResult> {
  try {
    const project = await recordChange(auditLog(), {
      intent: {
        actor: { sub: user.sub, ...(user.profile?.email !== undefined && { email: user.profile.email }) },
        action: 'projects.update',
        target: { recordId: `project:${current.id}` },
        before: { name: current.name, updatedAt: expectedUpdatedAt },
        after: { name: changes.name },
        calls: ['PutItem projects'],
      },
      run: async (steps) => {
        const saved = await steps.call('PutItem projects', () =>
          projectStore().update(current.id, changes, { sub: user.sub, at: new Date().toISOString(), expectedUpdatedAt }),
        );
        if (!saved) throw new ProjectGoneError();
        return { value: saved, after: { name: saved.name, updatedAt: saved.updatedAt } };
      },
    });
    return { ok: true, project, outcomeLogged: true };
  } catch (error) {
    if (error instanceof AuditUnavailableError) return { ok: false, reason: 'audit_unavailable', message: 'The activity log couldn’t record this, so nothing was saved. Try again.' };
    if (error instanceof AuditIncompleteError && error.value) return { ok: true, project: error.value as Project, outcomeLogged: false };
    if (error instanceof ProjectEditConflict) return { ok: false, reason: 'conflict', message: error.message };
    if (error instanceof ProjectGoneError) return { ok: false, reason: 'not_found', message: error.message };
    throw error; // the write itself failed: logged as a failed result, reported as an error
  }
}

class ProjectGoneError extends Error {
  constructor() {
    super('This project no longer exists.');
    this.name = 'ProjectGoneError';
  }
}
