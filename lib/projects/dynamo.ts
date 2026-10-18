/**
 * The DynamoDB project store. It makes only GetItem, BatchGetItem, PutItem (conditional), and Query,
 * which is all the compute role is granted (amplify/data/projects-table.ts).
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { BatchGetCommand, DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { PROJECTS_SCHEMA } from '@/amplify/data/projects-table.schema';
import { type Project, ProjectEditConflict, type ProjectStore, PROJECT_ID_RE, PROJECT_LIMITS } from './types';

function toProject(item: Record<string, unknown> | undefined): Project | null {
  if (!item) return null;
  const { id, name, summary, createdAt, createdBy, updatedAt, updatedBy } = item;
  if (typeof id !== 'string' || typeof name !== 'string' || typeof createdAt !== 'string' || typeof createdBy !== 'string') return null;
  return {
    id,
    name,
    summary: typeof summary === 'string' ? summary : '',
    createdAt,
    createdBy,
    updatedAt: typeof updatedAt === 'string' ? updatedAt : createdAt,
    updatedBy: typeof updatedBy === 'string' ? updatedBy : createdBy,
  };
}

const newestFirst = (a: Project, b: Project) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0);
const isConditionFailure = (error: unknown) => (error as { name?: string } | null)?.name === 'ConditionalCheckFailedException';

export function createDynamoProjectStore(options: { tableName: string; region: string; client?: DynamoDBClient }): ProjectStore {
  const db = DynamoDBDocumentClient.from(options.client ?? new DynamoDBClient({ region: options.region }));
  const TableName = options.tableName;
  const key = PROJECTS_SCHEMA.partitionKey;

  return {
    async get(id) {
      // Not a project ID: no project, and no request to the database for it.
      if (!PROJECT_ID_RE.test(id)) return null;
      const out = await db.send(new GetCommand({ TableName, Key: { [key]: id } }));
      return toProject(out.Item);
    },
    async getMany(ids) {
      const wanted = [...new Set(ids)].filter((id) => PROJECT_ID_RE.test(id)).slice(0, PROJECT_LIMITS.listMax);
      const found: Project[] = [];
      for (let i = 0; i < wanted.length; i += 100) {
        let keys = wanted.slice(i, i + 100).map((id) => ({ [key]: id }));
        // BatchGet may return some keys unprocessed (throttling): ask again for those, a few times.
        for (let attempt = 0; keys.length > 0 && attempt < 5; attempt++) {
          const out = await db.send(new BatchGetCommand({ RequestItems: { [TableName]: { Keys: keys } } }));
          for (const item of out.Responses?.[TableName] ?? []) {
            const project = toProject(item);
            if (project) found.push(project);
          }
          keys = (out.UnprocessedKeys?.[TableName]?.Keys ?? []) as typeof keys;
        }
        if (keys.length > 0) throw new Error('Some projects couldn’t be read (the database kept throttling). Try again.');
      }
      return found.sort(newestFirst);
    },
    async listRecent(limit) {
      const { recent } = PROJECTS_SCHEMA.indexes;
      const out = await db.send(
        new QueryCommand({
          TableName,
          IndexName: recent.name,
          KeyConditionExpression: '#pk = :pk',
          ExpressionAttributeNames: { '#pk': recent.partitionKey },
          ExpressionAttributeValues: { ':pk': PROJECTS_SCHEMA.entityValue },
          ScanIndexForward: false,
          Limit: Math.min(Math.max(1, limit ?? PROJECT_LIMITS.listDefault), PROJECT_LIMITS.listMax),
        }),
      );
      return (out.Items ?? []).map(toProject).filter((p): p is Project => p !== null);
    },
    async create(project) {
      await db.send(
        new PutCommand({
          TableName,
          Item: { ...project, entity: PROJECTS_SCHEMA.entityValue },
          ConditionExpression: 'attribute_not_exists(#id)',
          ExpressionAttributeNames: { '#id': key },
        }),
      );
      return project;
    },
    async update(id, changes, by) {
      const current = await this.get(id);
      if (!current) return null;
      const next: Project = { ...current, name: changes.name, summary: changes.summary, updatedAt: by.at, updatedBy: by.sub };
      try {
        await db.send(
          new PutCommand({
            TableName,
            Item: { ...next, entity: PROJECTS_SCHEMA.entityValue },
            ConditionExpression: 'attribute_exists(#id) AND #u = :u',
            ExpressionAttributeNames: { '#id': key, '#u': 'updatedAt' },
            ExpressionAttributeValues: { ':u': by.expectedUpdatedAt },
          }),
        );
      } catch (error) {
        if (isConditionFailure(error)) throw new ProjectEditConflict();
        throw error;
      }
      return next;
    },
  };
}
