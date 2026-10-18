/**
 * The sample app's item: a project. Who may see, edit, or share each one is a resource role on it
 * (Manager, Contributor, Reader; auth-kit/resources), combined with the site role. Replace with your
 * site's own items, keeping the pattern: every route that takes an ID calls requireResourceRole,
 * lists come from listMyResources, and anyone without access gets 404.
 */
export interface Project {
  /** A random UUID, from auth-kit's `create`. */
  id: string;
  name: string;
  summary: string;
  /** ISO 8601. */
  createdAt: string;
  /** The Cognito `sub` of whoever created it. Never an email (emails change). */
  createdBy: string;
  /** ISO 8601: the last edit (equal to `createdAt` until then). Edits are conditional on it. */
  updatedAt: string;
  updatedBy: string;
}

/** The only operations the app needs, so the store's IAM grant can be exactly these. */
export interface ProjectStore {
  get(id: string): Promise<Project | null>;
  /** Several by ID (a member's own list), newest first. IDs that don't exist are skipped. */
  getMany(ids: readonly string[]): Promise<Project[]>;
  /** Every project, newest first: for site roles that see every item. */
  listRecent(limit?: number): Promise<Project[]>;
  /** Refuses an ID that exists. */
  create(project: Project): Promise<Project>;
  /**
   * Replaces the name and summary if the project still has `expectedUpdatedAt` (someone else's edit
   * in between: `ProjectEditConflict`). Null if it doesn't exist.
   */
  update(id: string, changes: { name: string; summary: string }, by: { sub: string; at: string; expectedUpdatedAt: string }): Promise<Project | null>;
}

/** Someone else edited the project since this edit's page loaded. */
export class ProjectEditConflict extends Error {
  constructor() {
    super('Someone else changed this project since you opened it. Reload to see their changes.');
    this.name = 'ProjectEditConflict';
  }
}

export const PROJECT_LIMITS = {
  nameMax: 120,
  summaryMax: 2000,
  listDefault: 50,
  listMax: 100,
} as const;

/** Project IDs are random UUIDs; anything else can't name a project (and gets a 404). */
export const PROJECT_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
