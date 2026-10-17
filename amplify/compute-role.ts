/**
 * The SSR compute role: the IAM role Amplify Hosting's server code runs as (03 §2 Foundation:
 * "server code uses the SSR compute role, not IAM access keys"). Defining it here keeps its
 * permissions in code review instead of in a console policy that drifts.
 *
 * It holds exactly what the server needs:
 * - the People page and live checks (auth-kit's `peopleAdminPolicy`: list, invite, change role,
 *   disable, re-enable, sign out, delete; and AdminGetUser / AdminListGroupsForUser for the
 *   `{ live: true }` re-reads), on this pool only;
 * - `ses:SendEmail` from the site's SES identity, for invites and owner alerts;
 * - the audit log: PutItem and Query only (`grantAppendAndQuery`);
 * - the tickets table: GetItem, PutItem, Query.
 *
 * Amplify doesn't attach it by itself: once per app, set it as the app's compute role (README,
 * "Deploy on Amplify"). The ARN is in amplify_outputs.json as `custom.computeRoleArn`.
 */
import { Stack, aws_iam as iam } from 'aws-cdk-lib';
import type { IUserPool } from 'aws-cdk-lib/aws-cognito';
import { peopleAdminPolicy } from 'auth-kit/admin';
import type { AuditLogTable } from 'auth-kit/admin/cdk';
import { Construct } from 'constructs';
import type { TicketsTable } from './data/tickets-table';

export interface SsrComputeRoleProps {
  userPool: IUserPool;
  auditLog: AuditLogTable;
  tickets: TicketsTable;
  /** The verified SES identity invites are sent from: a domain (`example.com`) or an address. */
  sesIdentity: string;
}

export class SsrComputeRole extends Construct {
  readonly role: iam.Role;

  constructor(scope: Construct, id: string, props: SsrComputeRoleProps) {
    super(scope, id);
    const stack = Stack.of(this);
    this.role = new iam.Role(this, 'Role', {
      assumedBy: new iam.ServicePrincipal('amplify.amazonaws.com'),
      description: 'Amplify Hosting SSR compute role: People page, live checks, invite email, audit log, app data',
    });
    const sesIdentityArn = stack.formatArn({ service: 'ses', resource: 'identity', resourceName: props.sesIdentity });
    // The audit table's statements come from grantAppendAndQuery below, so they aren't repeated here.
    const people = peopleAdminPolicy({ userPoolArn: props.userPool.userPoolArn, sesResourceArns: [sesIdentityArn] });
    this.role.attachInlinePolicy(
      new iam.Policy(this, 'PeopleAndEmail', { document: iam.PolicyDocument.fromJson(people) }),
    );
    props.auditLog.grantAppendAndQuery(this.role);
    props.tickets.grantApp(this.role);
  }
}
