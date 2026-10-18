/**
 * The sample projects: input checks, the in-memory store, the DynamoDB store's exact calls, and the
 * resource access wiring (lib/resources.ts): the one type, its switches, and an honest failure when
 * the membership table is missing.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { BatchGetCommand, DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDynamoProjectStore } from '@/lib/projects/dynamo';
import { createMemoryProjectStore } from '@/lib/projects/memory';
import { type Project, ProjectEditConflict, PROJECT_ID_RE, PROJECT_LIMITS } from '@/lib/projects/types';
import { listLimit, validateProjectInput } from '@/lib/projects/validate';
import { PROJECT_SWITCHES, resourceStore, resourceTypes } from '@/lib/resources';

const ID = (n: number) => `6f1c2a7e-1b2c-4d3e-8f4a-${String(n).padStart(12, '0')}`;
const project = (n: number, over: Partial<Project> = {}): Project => ({
  id: ID(n),
  name: `Project ${n}`,
  summary: '',
  createdAt: `2026-10-0${n}T00:00:00.000Z`,
  createdBy: 'admin',
  updatedAt: `2026-10-0${n}T00:00:00.000Z`,
  updatedBy: 'admin',
  ...over,
});

describe('project input is validated on the server', () => {
  it('trims and accepts a normal project', () => {
    expect(validateProjectInput({ name: '  Roads 2027  ', summary: 'Line one\r\nLine two' })).toEqual({ ok: true, name: 'Roads 2027', summary: 'Line one\nLine two' });
  });

  it('refuses a missing, blank, too long, or multi-line name; control characters; an oversized summary', () => {
    expect(validateProjectInput({})).toMatchObject({ ok: false, field: 'name' });
    expect(validateProjectInput({ name: '   ' }).ok).toBe(false);
    expect(validateProjectInput({ name: 'x'.repeat(PROJECT_LIMITS.nameMax + 1) }).ok).toBe(false);
    expect(validateProjectInput({ name: 'two\nlines' }).ok).toBe(false);
    expect(validateProjectInput({ name: 42 }).ok).toBe(false);
    expect(validateProjectInput({ name: `bell${String.fromCharCode(7)}` }).ok).toBe(false);
    expect(validateProjectInput({ name: 'ok', summary: 'x'.repeat(PROJECT_LIMITS.summaryMax + 1) })).toMatchObject({ ok: false, field: 'summary' });
  });

  it('clamps list sizes', () => {
    expect(listLimit(null)).toBe(PROJECT_LIMITS.listDefault);
    expect(listLimit('5')).toBe(5);
    expect(listLimit('100000')).toBe(PROJECT_LIMITS.listMax);
    expect(listLimit('-1')).toBe(PROJECT_LIMITS.listDefault);
  });
});

describe('the in-memory store (unit tests and the auth-matrix server)', () => {
  it('reads several by ID (skipping unknown ones) and all of them, newest first', async () => {
    const store = createMemoryProjectStore();
    for (const n of [1, 2, 3]) await store.create(project(n));
    expect((await store.getMany([ID(1), ID(3), ID(9)])).map((p) => p.id)).toEqual([ID(3), ID(1)]);
    expect((await store.listRecent()).map((p) => p.id)).toEqual([ID(3), ID(2), ID(1)]);
    await expect(store.create(project(1))).rejects.toThrow(/collision/);
  });

  it('edits only at the version the editor saw, and returns copies', async () => {
    const store = createMemoryProjectStore();
    await store.create(project(1));
    const saved = await store.update(ID(1), { name: 'Renamed', summary: 's' }, { sub: 'c-1', at: '2026-10-09T00:00:00.000Z', expectedUpdatedAt: project(1).updatedAt });
    expect(saved).toMatchObject({ name: 'Renamed', updatedBy: 'c-1', createdBy: 'admin' });
    await expect(store.update(ID(1), { name: 'Late', summary: '' }, { sub: 'c-2', at: 'x', expectedUpdatedAt: project(1).updatedAt })).rejects.toBeInstanceOf(ProjectEditConflict);
    expect(await store.update(ID(9), { name: 'x', summary: '' }, { sub: 'c', at: 'x', expectedUpdatedAt: 'x' })).toBeNull();
    const loaded = await store.get(ID(1));
    if (loaded) loaded.name = 'changed by a caller';
    expect((await store.get(ID(1)))?.name).toBe('Renamed');
  });
});

describe('the DynamoDB store makes only GetItem, BatchGetItem, PutItem (conditional), and Query', () => {
  // The document client sends through its own middleware stack, so that's the class to mock.
  const ddb = mockClient(DynamoDBDocumentClient);
  const store = createDynamoProjectStore({ tableName: 'projects-table', region: 'us-east-1', client: new DynamoDBClient({ region: 'us-east-1' }) });
  beforeEach(() => ddb.reset());

  it('lists every project with a Query on the recent index, newest first', async () => {
    ddb.on(QueryCommand).resolves({ Items: [project(2), project(1)] });
    expect(await store.listRecent(10)).toHaveLength(2);
    expect(ddb.commandCalls(QueryCommand)[0]?.args[0].input).toMatchObject({
      TableName: 'projects-table',
      IndexName: 'recent',
      KeyConditionExpression: '#pk = :pk',
      ExpressionAttributeValues: { ':pk': 'project' },
      ScanIndexForward: false,
      Limit: 10,
    });
  });

  it('reads a member’s projects in one BatchGetItem, asking again for unprocessed keys', async () => {
    ddb.on(BatchGetCommand)
      .resolvesOnce({ Responses: { 'projects-table': [project(1)] }, UnprocessedKeys: { 'projects-table': { Keys: [{ id: ID(2) }] } } })
      .resolvesOnce({ Responses: { 'projects-table': [project(2)] } });
    expect((await store.getMany([ID(1), ID(2), 'not-an-id'])).map((p) => p.id)).toEqual([ID(2), ID(1)]);
    expect(ddb.commandCalls(BatchGetCommand)[0]?.args[0].input.RequestItems?.['projects-table']?.Keys).toEqual([{ id: ID(1) }, { id: ID(2) }]);
  });

  it('never asks the database for something that isn’t a project ID', async () => {
    expect(await store.get('../../etc/passwd')).toBeNull();
    expect(await store.getMany(['x', 'y'])).toEqual([]);
    expect(ddb.calls()).toHaveLength(0);
  });

  it('creates with a conditional put (no overwrites), and edits only at the version read', async () => {
    ddb.on(PutCommand).resolves({});
    await store.create(project(1));
    expect(ddb.commandCalls(PutCommand)[0]?.args[0].input).toMatchObject({ ConditionExpression: 'attribute_not_exists(#id)', Item: { id: ID(1), entity: 'project' } });
    ddb.reset();
    ddb.on(GetCommand).resolves({ Item: project(1) });
    ddb.on(PutCommand).rejects(Object.assign(new Error('The conditional request failed'), { name: 'ConditionalCheckFailedException' }));
    await expect(store.update(ID(1), { name: 'x', summary: '' }, { sub: 'c', at: 'now', expectedUpdatedAt: 'stale' })).rejects.toBeInstanceOf(ProjectEditConflict);
    const edit = ddb.commandCalls(PutCommand).at(-1)?.args[0].input;
    expect(edit).toMatchObject({ ConditionExpression: 'attribute_exists(#id) AND #u = :u', ExpressionAttributeValues: { ':u': 'stale' } });
  });

  it('drops malformed rows instead of passing them on', async () => {
    ddb.on(GetCommand).resolves({ Item: { id: ID(1), name: 'no creator' } });
    expect(await store.get(ID(1))).toBeNull();
    expect(PROJECT_ID_RE.test(ID(1))).toBe(true);
  });
});

describe('resource access for projects (lib/resources.ts)', () => {
  it('declares one type, "project", with both switches off by default (admins create; members see their own)', () => {
    expect(resourceTypes.names).toEqual(['project']);
    expect(PROJECT_SWITCHES).toEqual({ selfServiceCreate: false, sharedDirectory: false });
    expect(resourceTypes.get('project')).toMatchObject({ noun: 'project', selfServiceCreate: false, sharedDirectory: false });
  });

  it('with no membership table in amplify_outputs.json, says so on use (the check then answers 503, never "no access")', async () => {
    await expect(resourceStore.getMembership({ type: 'project', id: ID(1) }, 'm-1')).rejects.toThrow(/No resource access table in amplify_outputs.json/);
  });
});
