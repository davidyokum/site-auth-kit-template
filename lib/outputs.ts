/**
 * The one typed reader of `amplify_outputs.json`.
 *
 * That file is generated per environment (your sandbox, each Amplify branch, or CI's placeholder),
 * so its inferred JSON type changes with whichever copy is on disk. Code reads it through this
 * module's declared shape instead, so the type checks pass the same way everywhere.
 */
import raw from '@/amplify_outputs.json';

export interface SiteCustomOutputs {
  /** The append-only audit log (amplify/backend.ts, `AuditLogTable`). */
  auditLogTable?: string;
  /** The sample app's projects (amplify/data/projects-table.ts). */
  projectsTable?: string;
  /** Who has which role on which project (amplify/backend.ts, auth-kit's `ResourceAccessTable`). */
  resourceAccessTable?: string;
  /** The SSR compute role to attach in Amplify Hosting (amplify/compute-role.ts). */
  computeRoleArn?: string;
}

export interface SiteOutputs {
  version?: string;
  auth: {
    aws_region: string;
    user_pool_id: string;
    user_pool_client_id: string;
    identity_pool_id?: string;
  };
  custom?: SiteCustomOutputs;
}

/** The parsed outputs (the whole file, as Amplify's client also needs it). */
export const amplifyOutputs = raw;

/** The same file, read through the shape this site relies on. */
export const outputs = raw as unknown as SiteOutputs;
