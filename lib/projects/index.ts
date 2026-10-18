/**
 * Which project store the server uses: the DynamoDB table from amplify_outputs.json (your sandbox
 * locally, the branch's table on Amplify Hosting). Under the auth-matrix dev server only, an
 * in-memory store, one per server process: auth-kit's `shared(...)` keeps it across the proxy's,
 * pages', and routes' bundles, so a project the API creates shows on the page. There is no silent
 * fallback: no table means a clear error, never data that quietly vanishes on restart.
 */
import 'server-only';
import { matrixOverrides } from '@/dev-matrix';
import { outputs } from '@/lib/outputs';
import { createDynamoProjectStore } from './dynamo';
import { createMemoryProjectStore } from './memory';
import type { ProjectStore } from './types';

let store: ProjectStore | undefined;

export function projectStore(): ProjectStore {
  if (store) return store;
  const matrix = matrixOverrides();
  if (matrix) return (store = matrix.shared('projects', createMemoryProjectStore));
  const tableName = outputs.custom?.projectsTable;
  if (!tableName) {
    throw new Error(
      'No projects table in amplify_outputs.json (custom.projectsTable). Deploy the backend: `npm run sandbox` locally, or the branch pipeline on Amplify.',
    );
  }
  return (store = createDynamoProjectStore({ tableName, region: outputs.auth.aws_region }));
}

export type { Project, ProjectStore } from './types';
export { PROJECT_ID_RE, PROJECT_LIMITS, ProjectEditConflict } from './types';
export { validateProjectInput, listLimit } from './validate';
