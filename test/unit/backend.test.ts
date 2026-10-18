/**
 * The backend's own constructs, checked by CDK synthesis (no AWS calls). The auth preset itself is
 * tested in auth-kit; here, the site's tables and the compute role's exact permissions.
 */
import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { UserPool } from 'aws-cdk-lib/aws-cognito';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AuditLogTable, InviteExpirySweep, ResourceAccessTable } from 'auth-kit/admin/cdk';
import { RESOURCE_TABLE_SCHEMA } from 'auth-kit/resources';
import { describe, expect, it } from 'vitest';
import { SsrComputeRole } from '@/amplify/compute-role';
import { ProjectsTable } from '@/amplify/data/projects-table';
import { PROJECTS_SCHEMA } from '@/amplify/data/projects-table.schema';

function synth(context: Record<string, string> = {}) {
  const app = new App({ context });
  const stack = new Stack(app, 'Site', { env: { account: '111122223333', region: 'us-east-1' } });
  const pool = new UserPool(stack, 'Pool');
  const auditLog = new AuditLogTable(stack, 'AuditLog');
  const resourceAccess = new ResourceAccessTable(stack, 'ResourceAccess');
  const projects = new ProjectsTable(stack, 'Projects');
  new SsrComputeRole(stack, 'Compute', { userPool: pool, auditLog, resourceAccess, projects, sesIdentity: 'example.com' });
  return Template.fromStack(stack);
}

type Table = { DeletionPolicy?: string; Properties: { KeySchema: { AttributeName: string }[]; GlobalSecondaryIndexes?: { IndexName: string }[] } };
const tableNamed = (template: Template, prefix: string) =>
  Object.entries(template.findResources('AWS::DynamoDB::GlobalTable')).find(([id]) => id.startsWith(prefix))?.[1] as Table | undefined;

type Statement = { Action: string | string[]; Effect: string; Resource: unknown };
const allStatements = (template: Template): Statement[] =>
  Object.values(template.findResources('AWS::IAM::Policy')).flatMap(
    (p) => (p as { Properties: { PolicyDocument: { Statement: Statement[] } } }).Properties.PolicyDocument.Statement,
  );
const actionsOf = (s: Statement) => (Array.isArray(s.Action) ? s.Action : [s.Action]);

describe('the projects table', () => {
  it('is protected outside sandboxes: deletion protection, point-in-time recovery, retained on stack delete', () => {
    const template = synth({ 'amplify-backend-type': 'branch' });
    template.hasResource('AWS::DynamoDB::GlobalTable', {
      DeletionPolicy: 'Retain',
      Properties: Match.objectLike({
        KeySchema: [{ AttributeName: PROJECTS_SCHEMA.partitionKey, KeyType: 'HASH' }],
        Replicas: [Match.objectLike({ DeletionProtectionEnabled: true, PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true } })],
      }),
    });
  });

  it('has the index the server queries for every project', () => {
    expect(tableNamed(synth(), 'Projects')?.Properties.GlobalSecondaryIndexes?.map((i) => i.IndexName)).toEqual(['recent']);
  });

  it('is throwaway in a sandbox', () => {
    expect(tableNamed(synth({ 'amplify-backend-type': 'sandbox' }), 'Projects')).toMatchObject({ DeletionPolicy: 'Delete' });
  });
});

describe('the resource access table (auth-kit ResourceAccessTable: who has which role on which project)', () => {
  it('is protected and keyed as auth-kit’s store expects, with the byPerson index for "my projects"', () => {
    const access = tableNamed(synth({ 'amplify-backend-type': 'branch' }), 'ResourceAccess');
    expect(access).toMatchObject({ DeletionPolicy: 'Retain' });
    expect(access?.Properties.KeySchema.map((k) => k.AttributeName)).toEqual([RESOURCE_TABLE_SCHEMA.partitionKey, RESOURCE_TABLE_SCHEMA.sortKey]);
    expect(access?.Properties.GlobalSecondaryIndexes?.map((i) => i.IndexName)).toEqual(['byPerson']);
  });

  it('amplify/backend.ts creates it, grants the compute role, and publishes its name for the app', () => {
    const backend = readFileSync(join(import.meta.dirname, '..', '..', 'amplify', 'backend.ts'), 'utf8');
    expect(backend).toMatch(/new ResourceAccessTable\(data, 'ResourceAccess'\)/);
    expect(backend).toMatch(/resourceAccessTable: resourceAccess\.tableName/);
    expect(backend).toMatch(/projectsTable: projects\.tableName/);
  });
});

describe('the SSR compute role', () => {
  const template = synth();

  it('is assumed by Amplify Hosting only', () => {
    template.hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: { Statement: [Match.objectLike({ Principal: { Service: 'amplify.amazonaws.com' }, Action: 'sts:AssumeRole' })] },
    });
  });

  it('can run the People page on this pool, and nothing broader', () => {
    const cognito = allStatements(template).filter((s) => actionsOf(s).some((a) => a.startsWith('cognito-idp:')));
    expect(cognito.length).toBeGreaterThan(0);
    for (const s of cognito) expect(JSON.stringify(s.Resource)).toMatch(/PoolC3E4FC2E|Pool/);
    expect(cognito.flatMap(actionsOf)).toEqual(expect.arrayContaining(['cognito-idp:ListUsers', 'cognito-idp:AdminDisableUser', 'cognito-idp:AdminGetUser']));
  });

  it('sends email only from the site’s SES identity', () => {
    const ses = allStatements(template).filter((s) => actionsOf(s).some((a) => a.startsWith('ses:')));
    expect(ses.flatMap(actionsOf)).toEqual(['ses:SendEmail']);
    expect(JSON.stringify(ses[0]?.Resource)).toContain('identity/example.com');
  });

  it('touches DynamoDB only with the calls the stores make: no scans or updates; deletes only on the access table', () => {
    const statements = allStatements(template).filter((s) => actionsOf(s).some((a) => a.startsWith('dynamodb:')));
    const dynamo = statements.flatMap(actionsOf);
    expect(new Set(dynamo)).toEqual(new Set(['dynamodb:GetItem', 'dynamodb:BatchGetItem', 'dynamodb:PutItem', 'dynamodb:DeleteItem', 'dynamodb:Query']));
    for (const forbidden of ['dynamodb:Scan', 'dynamodb:UpdateItem', 'dynamodb:BatchWriteItem']) expect(dynamo).not.toContain(forbidden);
    // DeleteItem (removing someone's access) only on the resource access table.
    const deletes = statements.filter((s) => actionsOf(s).includes('dynamodb:DeleteItem'));
    expect(deletes.length).toBeGreaterThan(0);
    for (const s of deletes) expect(JSON.stringify(s.Resource)).toMatch(/ResourceAccess/);
  });

  it('grants no wildcard actions', () => {
    for (const s of allStatements(template)) for (const a of actionsOf(s)) expect(a).not.toMatch(/\*/);
  });
});

describe('the invite-expiry sweep (auth-kit ADR 0019)', () => {
  const ROOT = join(import.meta.dirname, '..', '..');

  it('amplify/backend.ts schedules it for this pool, writing to the audit log', () => {
    const backend = readFileSync(join(ROOT, 'amplify', 'backend.ts'), 'utf8');
    expect(backend).toMatch(/new InviteExpirySweep\(data, 'InviteExpiry', \{\s*userPool: backend\.auth\.resources\.userPool,\s*auditLog,/);
  });

  it('synthesizes from the installed auth-kit: an hourly schedule invoking a function with only the calls it makes', () => {
    const app = new App();
    const stack = new Stack(app, 'Site', { env: { account: '111122223333', region: 'us-east-1' } });
    new InviteExpirySweep(stack, 'InviteExpiry', { userPool: new UserPool(stack, 'Pool'), auditLog: new AuditLogTable(stack, 'AuditLog') });
    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::Scheduler::Schedule', { ScheduleExpression: 'rate(1 hour)', State: 'ENABLED' });
    // The function's code is the bundle inside the release tarball (node_modules/auth-kit/dist/lambda).
    template.hasResourceProperties('AWS::Lambda::Function', { Runtime: 'nodejs22.x', Handler: 'index.handler' });
    const actions = new Set(allStatements(template).flatMap(actionsOf));
    expect(actions).toEqual(
      new Set([
        'cognito-idp:ListUsers',
        // auth-kit 0.1.4: the sweep counts owners live, so it never disables the last one.
        'cognito-idp:ListUsersInGroup',
        'cognito-idp:AdminListGroupsForUser',
        'cognito-idp:AdminDisableUser',
        'cognito-idp:AdminRemoveUserFromGroup',
        'cognito-idp:ListUsersInGroup', // to count the owners: the owner's invite is never disabled
        'dynamodb:PutItem',
        'logs:CreateLogStream',
        'logs:PutLogEvents',
        'lambda:InvokeFunction',
      ]),
    );
  });

  it('warns the owner, as amplify/backend.ts configures it, sending only from the site’s domain', () => {
    const backend = readFileSync(join(ROOT, 'amplify', 'backend.ts'), 'utf8');
    expect(backend).toMatch(/ownerWarnings: \{\s*siteName: site\.name,\s*from: formatSender\(senderDisplayName\(site\), site\.email\.fromAddress\)/);
    const app = new App();
    const stack = new Stack(app, 'Site', { env: { account: '111122223333', region: 'us-east-1' } });
    new InviteExpirySweep(stack, 'InviteExpiry', {
      userPool: new UserPool(stack, 'Pool'),
      auditLog: new AuditLogTable(stack, 'AuditLog'),
      ownerWarnings: { siteName: 'Example Site', from: 'Example Site <noreply@example.com>' },
    });
    const template = Template.fromStack(stack);
    const ses = allStatements(template).filter((st) => actionsOf(st).some((a) => a.startsWith('ses:')));
    expect(ses.flatMap(actionsOf)).toEqual(['ses:SendEmail']);
    expect(JSON.stringify(ses[0]?.Resource)).toContain('identity/example.com');
  });
});
