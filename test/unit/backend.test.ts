/**
 * The backend's own constructs, checked by CDK synthesis (no AWS calls). The auth preset itself is
 * tested in auth-kit; here, the site's tables and the compute role's exact permissions.
 */
import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { UserPool } from 'aws-cdk-lib/aws-cognito';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AuditLogTable, InviteExpirySweep } from 'auth-kit/admin/cdk';
import { describe, expect, it } from 'vitest';
import { SsrComputeRole } from '@/amplify/compute-role';
import { TicketsTable } from '@/amplify/data/tickets-table';
import { TICKETS_SCHEMA } from '@/amplify/data/tickets-table.schema';

function synth(context: Record<string, string> = {}) {
  const app = new App({ context });
  const stack = new Stack(app, 'Site', { env: { account: '111122223333', region: 'us-east-1' } });
  const pool = new UserPool(stack, 'Pool');
  const auditLog = new AuditLogTable(stack, 'AuditLog');
  const tickets = new TicketsTable(stack, 'Tickets');
  new SsrComputeRole(stack, 'Compute', { userPool: pool, auditLog, tickets, sesIdentity: 'example.com' });
  return Template.fromStack(stack);
}

type Statement = { Action: string | string[]; Effect: string; Resource: unknown };
const allStatements = (template: Template): Statement[] =>
  Object.values(template.findResources('AWS::IAM::Policy')).flatMap(
    (p) => (p as { Properties: { PolicyDocument: { Statement: Statement[] } } }).Properties.PolicyDocument.Statement,
  );
const actionsOf = (s: Statement) => (Array.isArray(s.Action) ? s.Action : [s.Action]);

describe('the tickets table', () => {
  it('is protected outside sandboxes: deletion protection, point-in-time recovery, retained on stack delete', () => {
    const template = synth({ 'amplify-backend-type': 'branch' });
    template.hasResource('AWS::DynamoDB::GlobalTable', {
      DeletionPolicy: 'Retain',
      Properties: Match.objectLike({
        KeySchema: [{ AttributeName: TICKETS_SCHEMA.partitionKey, KeyType: 'HASH' }],
        Replicas: [Match.objectLike({ DeletionProtectionEnabled: true, PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true } })],
      }),
    });
  });

  it('has the owner and staff indexes the server queries', () => {
    const template = synth();
    const tables = template.findResources('AWS::DynamoDB::GlobalTable');
    const indexes = Object.values(tables).flatMap(
      (t) => (t as { Properties: { GlobalSecondaryIndexes?: { IndexName: string }[] } }).Properties.GlobalSecondaryIndexes ?? [],
    );
    expect(indexes.map((i) => i.IndexName)).toEqual(expect.arrayContaining(['byOwner', 'recent']));
  });

  it('is throwaway in a sandbox', () => {
    const template = synth({ 'amplify-backend-type': 'sandbox' });
    const tickets = Object.entries(template.findResources('AWS::DynamoDB::GlobalTable')).find(([id]) => id.startsWith('Tickets'));
    expect(tickets?.[1]).toMatchObject({ DeletionPolicy: 'Delete' });
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

  it('touches DynamoDB only with GetItem, PutItem, and Query: no scans, updates, or deletes', () => {
    const dynamo = allStatements(template).flatMap(actionsOf).filter((a) => a.startsWith('dynamodb:'));
    expect(new Set(dynamo)).toEqual(new Set(['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:Query']));
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
