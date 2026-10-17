/**
 * The site's backend. Deployed by Amplify Hosting's branch pipeline for each branch, and by
 * `npm run sandbox` for your own throwaway copy (never deploy by hand, never edit in the console).
 */
import { defineBackend } from '@aws-amplify/backend';
import { AuditLogTable } from 'auth-kit/admin/cdk';
import { applyAuthStandard } from 'auth-kit/amplify';
import { site } from '../site.config';
import { auth, authOptions } from './auth/resource';
import { SsrComputeRole } from './compute-role';
import { TicketsTable } from './data/tickets-table';

const backend = defineBackend({ auth });

// What defineAuth can't express: admin-create-only, deletion protection, token lifetimes, the
// 3-minute sign-in session, the password policy, passkeys counting as MFA, SES from a domain
// identity, the WAF web ACL, and tags. Sandboxes get the sandbox variant automatically.
applyAuthStandard(backend.auth, authOptions);

const data = backend.createStack('site-data');

// The append-only audit log for people and content changes (auth-kit ADR 0010): deletion
// protection, point-in-time recovery, and a resource policy that denies edits to every principal.
const auditLog = new AuditLogTable(data, 'AuditLog');

// The sample app's records. Replace with your own tables.
const tickets = new TicketsTable(data, 'Tickets');

const compute = new SsrComputeRole(data, 'SsrCompute', {
  userPool: backend.auth.resources.userPool,
  auditLog,
  tickets,
  sesIdentity: site.email.fromAddress.slice(site.email.fromAddress.lastIndexOf('@') + 1),
});

backend.addOutput({
  custom: {
    auditLogTable: auditLog.tableName,
    ticketsTable: tickets.tableName,
    computeRoleArn: compute.role.roleArn,
  },
});
