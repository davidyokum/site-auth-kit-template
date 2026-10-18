/**
 * The site's backend. Deployed by Amplify Hosting's branch pipeline for each branch, and by
 * `npm run sandbox` for your own throwaway copy (never deploy by hand, never edit in the console).
 */
import { defineBackend } from '@aws-amplify/backend';
import { AuditLogTable, InviteExpirySweep, ResourceAccessTable } from 'auth-kit/admin/cdk';
import { applyAuthStandard, formatSender } from 'auth-kit/amplify';
import { site } from '../site.config';
import { senderDisplayName } from '../site.families';
import { auth, authOptions } from './auth/resource';
import { SsrComputeRole } from './compute-role';
import { ProjectsTable } from './data/projects-table';

const backend = defineBackend({ auth });

// What defineAuth can't express: admin-create-only, deletion protection, token lifetimes, the
// 3-minute sign-in session, the password policy, passkeys counting as MFA, SES from a domain
// identity, the WAF web ACL (its per-rule modes are `waf` in amplify/auth/resource.ts), and tags.
// Sandboxes get the sandbox variant automatically.
applyAuthStandard(backend.auth, authOptions);

const data = backend.createStack('site-data');

// The append-only audit log for people and content changes (auth-kit ADR 0010): deletion
// protection, point-in-time recovery, and a resource policy that denies edits to every principal.
const auditLog = new AuditLogTable(data, 'AuditLog');

// Invites expire (03 §2: "An invite with no sign-in after 7 days is disabled"; auth-kit ADR 0019).
// An invite is a live account until it's used, so EventBridge Scheduler runs auth-kit's sweep
// hourly: a Lambda that disables every invite still unused after 7 days and removes its admin
// roles, logging each to the audit log as "Scheduled job". Its role can only list people, read
// their groups, disable, remove from groups (this pool), append to the audit log, and write its own
// log. Sandboxes get it too (seeded personas are verified, so it never touches them).
new InviteExpirySweep(data, 'InviteExpiry', {
  userPool: backend.auth.resources.userPool,
  auditLog,
  // The owner's invite is never disabled (a site keeps its one owner; auth-kit ADR 0019, 0020):
  // when it's unused past 7 days, the sweep emails the owner (and the first alert address) instead,
  // once a day, from the site's sender. The function may send only from that address's domain.
  ownerWarnings: {
    siteName: site.name,
    from: formatSender(senderDisplayName(site), site.email.fromAddress),
    ...(site.alertEmails[0] !== undefined && { fallbackEmail: site.alertEmails[0] }),
  },
  // Site-specific:
  // alarmTopic: an SNS topic someone reads (an email subscription needs one confirmation click):
  //   alarms when a run fails (a due invite wasn't disabled, the pool outgrew maxPeople) or the
  //   scheduler couldn't run it. Without it, failures show only in the function's metrics and log.
  // inviteMode: 'temporary-password', // the Tier 3 admin pool (no emailed codes)
  // schedule: 'rate(1 hour)', // the default; a rate from 10 minutes to 1 day, or a cron
  // maxPeople: 5000, // the default; a bigger pool fails each run (and alarms) until raised
});

// Who has which role on which item (auth-kit ADR 0022): Manager, Contributor, or Reader on one
// project. Point-in-time recovery, deletion protection, retained if the stack is deleted, and table
// deletion denied to everyone; the server may only read and write its items. Every change to it is
// also written to the audit log, by the app.
const resourceAccess = new ResourceAccessTable(data, 'ResourceAccess');

// The sample app's items. Replace with your own tables (keep the resource access table).
const projects = new ProjectsTable(data, 'Projects');

const compute = new SsrComputeRole(data, 'SsrCompute', {
  userPool: backend.auth.resources.userPool,
  auditLog,
  resourceAccess,
  projects,
  sesIdentity: site.email.fromAddress.slice(site.email.fromAddress.lastIndexOf('@') + 1),
});

backend.addOutput({
  custom: {
    auditLogTable: auditLog.tableName,
    resourceAccessTable: resourceAccess.tableName,
    projectsTable: projects.tableName,
    computeRoleArn: compute.role.roleArn,
  },
});
