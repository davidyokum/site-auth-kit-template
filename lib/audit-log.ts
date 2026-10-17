/**
 * The one append-only audit log (03 §2 Admin area): people changes (written by auth-kit's People
 * actions) and content changes (written by the app with `recordChange`). Who, to whom, what, before
 * and after, why, when; nobody can edit or delete rows, owners included (auth-kit ADR 0010).
 */
import 'server-only';
import { type AuditLogStore, createDynamoAuditLog } from 'auth-kit/admin';
import { matrixOverrides } from '@/dev-matrix';
import { outputs } from '@/lib/outputs';

let store: AuditLogStore | undefined;

export function auditLog(): AuditLogStore {
  if (store) return store;
  const matrix = matrixOverrides();
  if (matrix) return (store = matrix.auditLog);
  const tableName = outputs.custom?.auditLogTable;
  if (!tableName) {
    throw new Error(
      'No audit log table in amplify_outputs.json (custom.auditLogTable). Deploy the backend: `npm run sandbox` locally, or the branch pipeline on Amplify.',
    );
  }
  return (store = createDynamoAuditLog({ tableName, region: outputs.auth.aws_region }));
}
