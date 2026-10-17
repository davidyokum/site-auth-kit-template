/**
 * The DynamoDB ticket store. It makes only GetItem, PutItem, and Query, which is all the compute
 * role is granted (amplify/data/tickets-table.ts). Lists are Queries on an index, so a member's list
 * is filtered by the database on the server, never in the browser.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'node:crypto';
import { TICKETS_SCHEMA } from '@/amplify/data/tickets-table.schema';
import { type NewTicket, type Ticket, type TicketStore, TICKET_ID_RE, TICKET_LIMITS } from './types';

function toTicket(item: Record<string, unknown> | undefined): Ticket | null {
  if (!item) return null;
  const { id, ownerSub, title, body, createdAt } = item;
  if (typeof id !== 'string' || typeof ownerSub !== 'string' || typeof title !== 'string' || typeof createdAt !== 'string') return null;
  return { id, ownerSub, title, body: typeof body === 'string' ? body : '', createdAt };
}

export function createDynamoTicketStore(options: { tableName: string; region: string; client?: DynamoDBClient }): TicketStore {
  const db = DynamoDBDocumentClient.from(options.client ?? new DynamoDBClient({ region: options.region }));
  const { byOwner, recent } = TICKETS_SCHEMA.indexes;
  const clamp = (limit: number | undefined) => Math.min(Math.max(1, limit ?? TICKET_LIMITS.listDefault), TICKET_LIMITS.listMax);

  async function query(index: typeof byOwner | typeof recent, value: string, limit: number | undefined): Promise<Ticket[]> {
    const out = await db.send(
      new QueryCommand({
        TableName: options.tableName,
        IndexName: index.name,
        KeyConditionExpression: '#pk = :pk',
        ExpressionAttributeNames: { '#pk': index.partitionKey },
        ExpressionAttributeValues: { ':pk': value },
        ScanIndexForward: false,
        Limit: clamp(limit),
      }),
    );
    return (out.Items ?? []).map(toTicket).filter((t): t is Ticket => t !== null);
  }

  return {
    listForOwner: (ownerSub, limit) => query(byOwner, ownerSub, limit),
    listRecent: (limit) => query(recent, TICKETS_SCHEMA.entityValue, limit),
    async get(id) {
      // Not a ticket ID: no ticket, and no request to the database for it.
      if (!TICKET_ID_RE.test(id)) return null;
      const out = await db.send(new GetCommand({ TableName: options.tableName, Key: { [TICKETS_SCHEMA.partitionKey]: id } }));
      return toTicket(out.Item);
    },
    async create(input: NewTicket) {
      const ticket: Ticket = { id: randomUUID(), ownerSub: input.ownerSub, title: input.title, body: input.body, createdAt: new Date().toISOString() };
      await db.send(
        new PutCommand({
          TableName: options.tableName,
          Item: { ...ticket, entity: TICKETS_SCHEMA.entityValue },
          ConditionExpression: 'attribute_not_exists(#id)',
          ExpressionAttributeNames: { '#id': TICKETS_SCHEMA.partitionKey },
        }),
      );
      return ticket;
    },
  };
}
