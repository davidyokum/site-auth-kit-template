/**
 * The site's backend. Deployed by Amplify Hosting's branch pipeline for each branch, and by
 * `npm run sandbox` for your own throwaway copy (never deploy by hand, never edit in the console).
 *
 * What it deploys follows site.config.ts: every site gets the pool (with its custom message trigger),
 * the audit log, the invite-expiry schedule, the resource access table, the site settings table, the
 * sample projects table, and the SSR compute role. Sites that take sign-ups or requests
 * (`accountCreation`; lib/account-modes.ts) also get the tables and jobs auth-kit's account creation
 * needs (ADR 0023).
 */
import { defineBackend } from '@aws-amplify/backend';
import {
  AccessRequestDigest,
  AccessRequestTable,
  AuditLogTable,
  InviteExpirySweep,
  RateLimitTable,
  ResourceAccessTable,
  SiteSettingsTable,
  UnverifiedAccountSweep,
} from 'auth-kit/admin/cdk';
import { applyAuthStandard, formatSender } from 'auth-kit/amplify';
import { senderDisplayName } from 'auth-kit/themes';
import { needsRateLimits, takesRequests, takesSignUps } from '../lib/account-modes';
import { backendOrigin } from '../lib/origin';
import { site } from '../site.config';
import { helpAddressFor } from '../site.families';
import { auth, authOptions } from './auth/resource';
import { SsrComputeRole } from './compute-role';
import { ProjectsTable } from './data/projects-table';

// The pool's trigger functions (custom message; preSignUp on 'domains' sites) come with `auth`: Amplify
// creates each trigger's function in the auth stack (amplify/auth/resource.ts).
const backend = defineBackend({ auth });

// What defineAuth can't express: admin-create-only (Cognito's own sign-up stays off), deletion
// protection, token lifetimes, the sign-in session (the emailed code's lifetime), the password
// policy, passkeys counting as MFA, SES from a domain identity, the WAF web ACL (its per-rule modes are
// `waf` in amplify/auth/resource.ts), and tags. It also checks the custom message trigger is wired and
// is auth-kit's. Sandboxes get the sandbox variant automatically.
applyAuthStandard(backend.auth, authOptions);

const sandbox = backend.stack.node.tryGetContext('amplify-backend-type') === 'sandbox';
const origin = backendOrigin();
const sender = formatSender(senderDisplayName(site.name, site.family), site.email.fromAddress);
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
    from: sender,
    ...(origin.startsWith('https://') && { signInUrl: `${origin}/sign-in` }),
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

// Settings an admin changes without a deploy (auth-kit ADR 0024): today, a Super admin's sign-in
// help address (Admin → Settings → "Sign-in help"). Point-in-time recovery, deletion protection,
// retained; every change is also in the audit log, and the owner is emailed.
const siteSettings = new SiteSettingsTable(data, 'SiteSettings');

// ---- Account creation (site.config.ts `accountCreation`; auth-kit ADR 0023) --------------------
// Invite-only sites deploy none of this.
const signUps = takesSignUps(site.accountCreation);
const requests = takesRequests(site.accountCreation);

// Per-address and per-IP counters for the sign-up and request routes (and members' email changes):
// addresses and IPs stored only as hashes, each counter gone an hour after its window.
const rateLimits = needsRateLimits(site.accountCreation) ? new RateLimitTable(data, 'RateLimits') : undefined;

// The request queue: requests wait here, never as Cognito users, and each one, with its typed name
// and reason, is deleted 30 days after it's settled. No point-in-time recovery, so backups don't
// keep what was deleted.
const accessRequests = requests ? new AccessRequestTable(data, 'AccessRequests') : undefined;

if (accessRequests && !sandbox) {
  // A daily digest of pending requests (8:00 Eastern) to the admins who manage people, instead of one
  // email per request; it also deletes requests past retention. Its links need the site's https
  // address, so sandboxes (on http://*.localhost) skip it; the People page's tab still lists requests.
  new AccessRequestDigest(data, 'RequestDigest', {
    userPool: backend.auth.resources.userPool,
    requests: accessRequests,
    settings: siteSettings,
    siteName: site.name,
    family: site.family,
    from: sender,
    signInUrl: `${origin}/sign-in`,
    peopleUrl: `${origin}/admin/people`,
    helpEmail: helpAddressFor(site),
  });
}

if (signUps) {
  // Sign-ups whose address is never verified are deleted after 24 hours (only accounts the sign-up
  // route marked; never one with a role, never the owner, never an admin's invite).
  new UnverifiedAccountSweep(data, 'UnverifiedSweep', { userPool: backend.auth.resources.userPool, auditLog });
}

// The sample app's items. Replace with your own tables (keep the resource access table).
const projects = new ProjectsTable(data, 'Projects');

const compute = new SsrComputeRole(data, 'SsrCompute', {
  userPool: backend.auth.resources.userPool,
  auditLog,
  resourceAccess,
  projects,
  siteSettings,
  ...(rateLimits && { rateLimits }),
  ...(accessRequests && { accessRequests }),
  selfSignUp: signUps,
  sesIdentity: site.email.fromAddress.slice(site.email.fromAddress.lastIndexOf('@') + 1),
});

backend.addOutput({
  custom: {
    auditLogTable: auditLog.tableName,
    resourceAccessTable: resourceAccess.tableName,
    siteSettingsTable: siteSettings.tableName,
    ...(rateLimits && { rateLimitTable: rateLimits.tableName }),
    ...(accessRequests && { accessRequestTable: accessRequests.tableName }),
    projectsTable: projects.tableName,
    computeRoleArn: compute.role.roleArn,
  },
});
