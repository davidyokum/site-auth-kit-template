/**
 * The tickets table's key and index names: shared by the CDK construct (tickets-table.ts) and the
 * server code that reads it (lib/tickets/dynamo.ts). Pure data, so the app can import it without
 * pulling in aws-cdk-lib.
 */
export const TICKETS_SCHEMA = {
  partitionKey: 'id',
  /** Every ticket carries `entity: 'ticket'`, the partition of the `recent` index. */
  entityValue: 'ticket',
  indexes: {
    byOwner: { name: 'byOwner', partitionKey: 'ownerSub', sortKey: 'createdAt' },
    recent: { name: 'recent', partitionKey: 'entity', sortKey: 'createdAt' },
  },
} as const;
