/**
 * Which ticket store the server uses: the DynamoDB table from amplify_outputs.json (your sandbox
 * locally, the branch's table on Amplify Hosting). Under the auth-matrix dev server only, an
 * in-memory store. There is no silent fallback: no table means a clear error, never data that
 * quietly vanishes on restart.
 */
import 'server-only';
import { matrixOverrides } from '@/dev-matrix';
import { outputs } from '@/lib/outputs';
import { createDynamoTicketStore } from './dynamo';
import type { TicketStore } from './types';

let store: TicketStore | undefined;

export function ticketStore(): TicketStore {
  if (store) return store;
  const matrix = matrixOverrides();
  if (matrix) return (store = matrix.tickets);
  const tableName = outputs.custom?.ticketsTable;
  if (!tableName) {
    throw new Error(
      'No tickets table in amplify_outputs.json (custom.ticketsTable). Deploy the backend: `npm run sandbox` locally, or the branch pipeline on Amplify.',
    );
  }
  return (store = createDynamoTicketStore({ tableName, region: outputs.auth.aws_region }));
}

export type { Ticket, TicketStore } from './types';
export { TICKET_ID_RE, TICKET_LIMITS } from './types';
export { validateTicketInput, listLimit } from './validate';
