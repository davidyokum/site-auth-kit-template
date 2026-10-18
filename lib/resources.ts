/**
 * The site's resource types and where their memberships live (auth-kit/resources, ADR 0022).
 *
 * Who runs the site is a site-wide role (lib/capabilities.ts). Who can do what to one project is a
 * resource role on that project: Manager (edit it and choose who has access), Contributor (edit it),
 * or Reader (see it). On any project a person gets whichever allows more: their site role there
 * (Admin – view only sees every project, Admin – content only also edits every project, Admin –
 * content & people and above also manage access), or their role on it.
 *
 * Imported by lib/auth.ts, and so by proxy.ts: no `server-only`, nothing that needs a request.
 */
import { createDynamoResourceStore, defineResourceTypes, type ResourceAccessStore } from 'auth-kit/resources';
import { matrixOverrides } from '@/dev-matrix';
import { outputs } from './outputs';

/**
 * The two per-type switches, both off by default (06 decision 2 and 3):
 * - `selfServiceCreate`: off, site admins who manage people create projects and choose each one's
 *   Manager; on, any signed-in member creates one and becomes its Manager.
 * - `sharedDirectory`: off, members see only the projects they have a role on; on, every signed-in
 *   person can see every project, read-only.
 */
export const PROJECT_SWITCHES = { selfServiceCreate: false, sharedDirectory: false } as const;

export const resourceTypes = defineResourceTypes({
  project: { noun: 'project', ...PROJECT_SWITCHES },
});

let real: ResourceAccessStore | undefined;

/**
 * The membership table from amplify_outputs.json (your sandbox locally, the branch's table on
 * Amplify Hosting); under the auth-matrix dev server only, auth-kit's in-memory store that every
 * bundle shares. Opened on first use, not at import. No silent fallback: no table is a clear error,
 * which the access check reports as "couldn't check" (503), never as "no access".
 */
function store(): ResourceAccessStore {
  if (real) return real;
  const matrix = matrixOverrides();
  if (matrix) return (real = matrix.resources);
  const tableName = outputs.custom?.resourceAccessTable;
  if (!tableName) {
    throw new Error(
      'No resource access table in amplify_outputs.json (custom.resourceAccessTable). Deploy the backend: `npm run sandbox` locally, or the branch pipeline on Amplify.',
    );
  }
  return (real = createDynamoResourceStore({ tableName, region: outputs.auth.aws_region }));
}

/** Opens the real store on first use; a missing table is a rejected promise, like any store failure. */
const later = <T>(use: (s: ResourceAccessStore) => Promise<T>): Promise<T> => Promise.resolve().then(() => use(store()));

export const resourceStore: ResourceAccessStore = {
  getMembership: (ref, sub) => later((s) => s.getMembership(ref, sub)),
  getAccess: (ref) => later((s) => s.getAccess(ref)),
  listForPerson: (sub, type) => later((s) => s.listForPerson(sub, type)),
  commit: (ref, change) => later((s) => s.commit(ref, change)),
};
