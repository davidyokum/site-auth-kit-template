/**
 * The SSR compute role: the IAM role Amplify Hosting's server code runs as (03 §2 Foundation:
 * "server code uses the SSR compute role, not IAM access keys"). Defining it here keeps its
 * permissions in code review instead of in a console policy that drifts.
 *
 * It holds exactly what the server needs:
 * - the People page and live checks (auth-kit's `peopleAdminPolicy`: list, invite, change role,
 *   disable, re-enable, sign out, delete; and AdminGetUser / AdminListGroupsForUser for the
 *   `{ live: true }` re-reads), on this pool only;
 * - `ses:SendEmail` from the site's SES identity, for invites, alerts, and account notices;
 * - the rate-limit counters: UpdateItem only, on every site (the account-change notices are limited
 *   per account; register A10). The notice route reads the account's own address with ListUsers, which
 *   the People policy already grants on this pool, and checks a new passkey with the person's own
 *   token (no IAM);
 * - the audit log: PutItem and Query only (`grantAppendAndQuery`);
 * - who has access to which project (auth-kit's `ResourceAccessTable`): GetItem, PutItem, DeleteItem,
 *   and Query on that table only (`grantApp`);
 * - the projects table: GetItem, BatchGetItem, PutItem, Query;
 * - the site settings table (a Super admin's sign-in help address): GetItem, PutItem, DeleteItem;
 * - on sites that take sign-ups or requests (site.config.ts `accountCreation`): Query/GetItem/PutItem
 *   on the request queue (request sites), and on sign-up sites the Cognito calls the sign-up route and
 *   members' own account actions make (find, create, update their own address, sign out, delete), on
 *   this pool only.
 *
 * Amplify doesn't attach it by itself: once per app, set it as the app's compute role (README,
 * "Deploy on Amplify"). The ARN is in amplify_outputs.json as `custom.computeRoleArn`.
 */
import { Stack, aws_iam as iam } from 'aws-cdk-lib';
import type { IUserPool } from 'aws-cdk-lib/aws-cognito';
import { peopleAdminPolicy, SELF_SERVICE_COGNITO_ACTIONS, SIGN_UP_COGNITO_ACTIONS } from 'auth-kit/admin';
import type { AccessRequestTable, AuditLogTable, RateLimitTable, ResourceAccessTable, SiteSettingsTable } from 'auth-kit/admin/cdk';
import { Construct } from 'constructs';
import type { ProjectsTable } from './data/projects-table';

export interface SsrComputeRoleProps {
  userPool: IUserPool;
  auditLog: AuditLogTable;
  resourceAccess: ResourceAccessTable;
  projects: ProjectsTable;
  /** Settings changed without a deploy (the Super admin's sign-in help address). */
  siteSettings: SiteSettingsTable;
  /** The counters: the account-change notices on every site, and the sign-up and request routes where they exist. */
  rateLimits: RateLimitTable;
  /** The request queue (request sites). */
  accessRequests?: AccessRequestTable;
  /** Sign-up sites: the sign-up route's and members' own Cognito calls. */
  selfSignUp?: boolean;
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
      description: 'Amplify Hosting SSR compute role: People page, live checks, email, audit log, settings, account creation, app data',
    });
    const sesIdentityArn = stack.formatArn({ service: 'ses', resource: 'identity', resourceName: props.sesIdentity });
    // The audit table's statements come from grantAppendAndQuery below, so they aren't repeated here.
    const people = peopleAdminPolicy({ userPoolArn: props.userPool.userPoolArn, sesResourceArns: [sesIdentityArn] });
    this.role.attachInlinePolicy(new iam.Policy(this, 'PeopleAndEmail', { document: iam.PolicyDocument.fromJson(people) }));
    if (props.selfSignUp) {
      this.role.addToPrincipalPolicy(
        new iam.PolicyStatement({
          sid: 'AccountCreationCognito',
          actions: [...new Set([...SIGN_UP_COGNITO_ACTIONS, ...SELF_SERVICE_COGNITO_ACTIONS])],
          resources: [props.userPool.userPoolArn],
        }),
      );
    }
    props.auditLog.grantAppendAndQuery(this.role);
    props.resourceAccess.grantApp(this.role);
    props.projects.grantApp(this.role);
    props.siteSettings.grantApp(this.role);
    props.rateLimits.grantApp(this.role);
    props.accessRequests?.grantApp(this.role);
  }
}
