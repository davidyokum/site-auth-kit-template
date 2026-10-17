import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDynamoTicketStore } from '@/lib/tickets/dynamo';
import { createMemoryTicketStore } from '@/lib/tickets/memory';
import { TICKET_ID_RE, TICKET_LIMITS } from '@/lib/tickets/types';
import { listLimit, validateTicketInput } from '@/lib/tickets/validate';

describe('ticket input is validated on the server', () => {
  it('trims and accepts a normal ticket', () => {
    expect(validateTicketInput({ title: '  Printer jam  ', body: 'Line one\r\nLine two' })).toEqual({ ok: true, title: 'Printer jam', body: 'Line one\nLine two' });
  });

  it('refuses a missing, blank, too long, or multi-line title', () => {
    expect(validateTicketInput({}).ok).toBe(false);
    expect(validateTicketInput({ title: '   ' }).ok).toBe(false);
    expect(validateTicketInput({ title: 'x'.repeat(TICKET_LIMITS.titleMax + 1) }).ok).toBe(false);
    expect(validateTicketInput({ title: 'two\nlines' }).ok).toBe(false);
  });

  it('refuses non-string input and control characters, and an oversized body', () => {
    expect(validateTicketInput({ title: 42 }).ok).toBe(false);
    expect(validateTicketInput({ title: `bell${String.fromCharCode(7)}` }).ok).toBe(false);
    expect(validateTicketInput({ title: 'ok', body: 'x'.repeat(TICKET_LIMITS.bodyMax + 1) })).toMatchObject({ ok: false, field: 'body' });
  });

  it('clamps list sizes', () => {
    expect(listLimit(null)).toBe(TICKET_LIMITS.listDefault);
    expect(listLimit('5')).toBe(5);
    expect(listLimit('100000')).toBe(TICKET_LIMITS.listMax);
    expect(listLimit('-1')).toBe(TICKET_LIMITS.listDefault);
  });
});

describe('the in-memory store (unit tests and the auth-matrix server)', () => {
  it('lists only the owner’s tickets for a member, newest first; everything for staff', async () => {
    let t = Date.parse('2026-01-01T00:00:00Z');
    const store = createMemoryTicketStore({ now: () => (t += 1000) });
    const a1 = await store.create({ ownerSub: 'a', title: 'first', body: '' });
    await store.create({ ownerSub: 'b', title: 'other', body: '' });
    const a2 = await store.create({ ownerSub: 'a', title: 'second', body: '' });
    expect((await store.listForOwner('a')).map((x) => x.id)).toEqual([a2.id, a1.id]);
    expect(await store.listRecent()).toHaveLength(3);
    expect(TICKET_ID_RE.test(a1.id)).toBe(true);
  });

  it('returns copies, so callers can’t edit stored records', async () => {
    const store = createMemoryTicketStore();
    const created = await store.create({ ownerSub: 'a', title: 'mine', body: '' });
    const loaded = await store.get(created.id);
    if (loaded) loaded.ownerSub = 'someone-else';
    expect((await store.get(created.id))?.ownerSub).toBe('a');
    expect(await store.get('missing')).toBeNull();
  });
});

describe('the DynamoDB store makes only GetItem, PutItem, and Query', () => {
  // The document client sends through its own middleware stack, so that's the class to mock.
  const ddb = mockClient(DynamoDBDocumentClient);
  const store = createDynamoTicketStore({ tableName: 'tickets-table', region: 'us-east-1', client: new DynamoDBClient({ region: 'us-east-1' }) });

  beforeEach(() => ddb.reset());

  it('lists a member’s tickets with a Query on the owner index, newest first (filtered by the database)', async () => {
    ddb.on(QueryCommand).resolves({ Items: [{ id: 'x', ownerSub: 'a', title: 't', body: 'b', createdAt: '2026-01-01T00:00:00Z' }] });
    expect(await store.listForOwner('a', 10)).toHaveLength(1);
    const input = ddb.commandCalls(QueryCommand)[0]?.args[0].input;
    expect(input).toMatchObject({
      TableName: 'tickets-table',
      IndexName: 'byOwner',
      KeyConditionExpression: '#pk = :pk',
      ExpressionAttributeNames: { '#pk': 'ownerSub' },
      ExpressionAttributeValues: { ':pk': 'a' },
      ScanIndexForward: false,
      Limit: 10,
    });
  });

  it('never asks the database for something that isn’t a ticket ID', async () => {
    expect(await store.get('../../etc/passwd')).toBeNull();
    expect(ddb.calls()).toHaveLength(0);
  });

  it('files a ticket with a conditional put (no overwrites) tagged for the staff index', async () => {
    ddb.on(PutCommand).resolves({});
    const ticket = await store.create({ ownerSub: 'a', title: 'New', body: 'Body' });
    const input = ddb.commandCalls(PutCommand)[0]?.args[0].input;
    expect(input?.ConditionExpression).toBe('attribute_not_exists(#id)');
    expect(input?.Item).toMatchObject({ id: ticket.id, ownerSub: 'a', entity: 'ticket' });
  });

  it('drops malformed rows instead of passing them on', async () => {
    ddb.on(GetCommand).resolves({ Item: { id: 'x', title: 'no owner' } });
    expect(await store.get('6f1c2a7e-1b2c-4d3e-8f4a-0123456789ab')).toBeNull();
  });
});
