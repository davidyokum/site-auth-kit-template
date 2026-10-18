/**
 * An in-memory project store with the same behavior as the DynamoDB one. Used by the unit tests and
 * by the auth-matrix dev server (lib/projects/index.ts, through auth-kit's matrix server mode). Never
 * in production: it forgets everything on restart, and lib/projects/index.ts never chooses it outside
 * those two.
 */
import { type Project, ProjectEditConflict, type ProjectStore, PROJECT_LIMITS } from './types';

export function createMemoryProjectStore(): ProjectStore & { readonly size: number } {
  const rows = new Map<string, Project>();
  const newestFirst = (a: Project, b: Project) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : b.id.localeCompare(a.id));
  const clamp = (limit: number | undefined) => Math.min(Math.max(1, limit ?? PROJECT_LIMITS.listDefault), PROJECT_LIMITS.listMax);
  const copy = (p: Project): Project => ({ ...p });

  return {
    get size() {
      return rows.size;
    },
    get: (id) => Promise.resolve(rows.has(id) ? copy(rows.get(id)!) : null),
    getMany: (ids) => Promise.resolve([...new Set(ids)].flatMap((id) => (rows.has(id) ? [copy(rows.get(id)!)] : [])).sort(newestFirst)),
    listRecent: (limit) => Promise.resolve([...rows.values()].sort(newestFirst).slice(0, clamp(limit)).map(copy)),
    create(project) {
      if (rows.has(project.id)) return Promise.reject(new Error('project id collision'));
      rows.set(project.id, copy(project));
      return Promise.resolve(copy(project));
    },
    update(id, changes, by) {
      const found = rows.get(id);
      if (!found) return Promise.resolve(null);
      if (found.updatedAt !== by.expectedUpdatedAt) return Promise.reject(new ProjectEditConflict());
      const next: Project = { ...found, name: changes.name, summary: changes.summary, updatedAt: by.at, updatedBy: by.sub };
      rows.set(id, next);
      return Promise.resolve(copy(next));
    },
  };
}
