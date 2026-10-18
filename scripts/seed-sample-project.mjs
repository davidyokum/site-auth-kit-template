#!/usr/bin/env node
// `npm run projects:seed`: gives the sample personas their roles on a sample project, in YOUR SANDBOX.
//
// personas.json has three members named for the resource roles (auth-kit ADR 0022): "manager",
// "contributor", and "reader". `npm run personas:seed` makes their accounts; this makes the sample
// project (as Admin – content & people, who creates projects) and gives each persona its role on it,
// so "Sign in as…" shows each role's view at once. Run it after personas:seed; running it again
// changes nothing.
//
// It refuses anything but a sandbox: the account check first (deploy.config.json, read-only STS), then
// auth-kit's sandbox check on the pool in amplify_outputs.json (tagged Environment=sandbox, in that
// account, a handful of users). The project and the access change are written to the audit log like
// any other change, as the creator persona.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CognitoIdentityProviderClient, ListUsersCommand } from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { createDynamoAuditLog, recordChange } from 'auth-kit/admin';
import { assertSandboxInspection, inspectUserPool } from 'auth-kit/dev';
import { createDynamoResourceStore } from 'auth-kit/resources';
import { assertAccount } from './lib/assert-account.mjs';
import { SAMPLE_CREATOR, SAMPLE_PROJECT, SAMPLE_ROLES, sampleAccessCommit } from './lib/sample-project.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function refuse(message) {
  console.error(`projects:seed: ${message}`);
  process.exit(1);
}

let config;
try {
  config = assertAccount(root);
} catch (error) {
  refuse(error instanceof Error ? error.message : String(error));
}
// Every client below uses the checked profile, never a default.
process.env.AWS_PROFILE = config.awsProfile;

let outputs;
try {
  outputs = JSON.parse(readFileSync(join(root, 'amplify_outputs.json'), 'utf8'));
} catch {
  refuse('no amplify_outputs.json: run `npm run sandbox` first.');
}
const region = outputs.auth?.aws_region;
const userPoolId = outputs.auth?.user_pool_id;
const tables = outputs.custom ?? {};
if (!region || !userPoolId || !tables.projectsTable || !tables.resourceAccessTable || !tables.auditLogTable) {
  refuse('amplify_outputs.json has no pool or tables: is it your sandbox’s (npm run sandbox)?');
}

const cognito = new CognitoIdentityProviderClient({ region });
try {
  assertSandboxInspection(await inspectUserPool(cognito, userPoolId), { expectedAccountId: config.awsAccountId });
} catch (error) {
  refuse(`${error instanceof Error ? error.message : String(error)} Nothing was written.`);
}
console.log(`projects:seed: pool ${userPoolId} is a sandbox in account ${config.awsAccountId}.`);

// The personas' accounts, by email (personas:seed made them).
const personas = JSON.parse(readFileSync(join(root, 'personas.json'), 'utf8'));
async function account(key) {
  const persona = personas.find((p) => p.key === key);
  if (!persona) refuse(`personas.json has no "${key}" persona.`);
  const out = await cognito.send(new ListUsersCommand({ UserPoolId: userPoolId, Filter: `email = "${persona.email}"`, Limit: 2 }));
  const user = out.Users?.[0];
  const sub = user?.Attributes?.find((a) => a.Name === 'sub')?.Value;
  if (!sub) refuse(`no account for ${persona.email}: run \`npm run personas:seed\` first.`);
  return { sub, email: persona.email };
}
const creator = await account(SAMPLE_CREATOR);
const people = {};
for (const key of Object.keys(SAMPLE_ROLES)) people[key] = await account(key);

const db = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
const auditLog = createDynamoAuditLog({ tableName: tables.auditLogTable, region });
const store = createDynamoResourceStore({ tableName: tables.resourceAccessTable, region });
const actor = { sub: creator.sub, email: creator.email };
const now = new Date().toISOString();
const ref = { type: 'project', id: SAMPLE_PROJECT.id };

// 1. The project itself (as the app's create would write it), if it isn't there yet.
const existing = await db.send(new GetCommand({ TableName: tables.projectsTable, Key: { id: SAMPLE_PROJECT.id } }));
if (existing.Item) {
  console.log(`projects:seed: "${SAMPLE_PROJECT.name}" is already there.`);
} else {
  const project = { ...SAMPLE_PROJECT, createdAt: now, createdBy: creator.sub, updatedAt: now, updatedBy: creator.sub };
  await recordChange(auditLog, {
    intent: { actor, action: 'projects.create', target: { recordId: `project:${SAMPLE_PROJECT.id}` }, after: { name: SAMPLE_PROJECT.name, seeded: true }, reason: 'npm run projects:seed (sandbox)', calls: ['DynamoDB PutItem project'] },
    run: async (steps) => {
      await steps.call('DynamoDB PutItem project', () =>
        db.send(new PutCommand({ TableName: tables.projectsTable, Item: { ...project, entity: 'project' }, ConditionExpression: 'attribute_not_exists(id)' })),
      );
      return { value: undefined };
    },
  });
  console.log(`projects:seed: made "${SAMPLE_PROJECT.name}".`);
}

// 2. The roles: only what's missing, in one access change at the version read.
const commit = sampleAccessCommit(await store.getAccess(ref), people, creator, now);
if (!commit) {
  console.log('projects:seed: the Manager, Contributor, and Reader already have their roles. Nothing to do.');
} else {
  await recordChange(auditLog, {
    intent: {
      actor,
      action: 'resources.add',
      target: { recordId: `project:${SAMPLE_PROJECT.id}` },
      after: { item: { noun: 'project', name: SAMPLE_PROJECT.name }, members: commit.put.map((m) => ({ email: m.email, role: m.role })) },
      reason: 'npm run projects:seed (sandbox)',
      calls: ['TransactWriteItems project access'],
    },
    run: async (steps) => {
      await steps.call('TransactWriteItems project access', () => store.commit(ref, commit));
      return { value: undefined };
    },
  });
  for (const m of commit.put) console.log(`projects:seed: ${m.email} is now ${m.role} of "${SAMPLE_PROJECT.name}".`);
}
