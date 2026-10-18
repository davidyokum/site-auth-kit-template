/**
 * The projects table's key and index names: shared by the CDK construct (projects-table.ts) and the
 * server code that reads it (lib/projects/dynamo.ts). Pure data, so the app can import it without
 * pulling in aws-cdk-lib.
 *
 * Who may see or change a project isn't stored here: that's auth-kit's resource access table
 * (Manager, Contributor, Reader per project; amplify/backend.ts).
 */
export const PROJECTS_SCHEMA = {
  partitionKey: 'id',
  /** Every project carries `entity: 'project'`, the partition of the `recent` index. */
  entityValue: 'project',
  indexes: {
    recent: { name: 'recent', partitionKey: 'entity', sortKey: 'createdAt' },
  },
} as const;
