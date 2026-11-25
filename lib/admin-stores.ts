/**
 * Server-only `SiteSettingsTable` stores for Admin Mode (auth-kit ADR 0031):
 * - Guarded Role Builder policy (`siteRolePolicyStore`)
 * - Directory profiles (`directoryProfileStore`)
 * - Privacy-safe first-party usage ledger (`usageLedgerStore`)
 * - Invite email welcome note (`inviteWelcomeStore`)
 *
 * Uses in-memory stores under the auth-matrix server and DynamoDB `SiteSettingsTable` elsewhere.
 */
import 'server-only';
import {
  createDynamoSiteSettingsStore,
  createMemorySiteSettingsStore,
  type SiteSettingsStore,
} from 'auth-kit/accounts';
import {
  createDirectoryProfileStore,
  createInviteWelcomeStore,
  createSiteSettingsRolePolicyStore,
  createUsageLedgerStore,
  type DirectoryProfileStore,
  type InviteWelcomeStore,
  type SiteSettingsRolePolicyStore,
  type UsageLedgerStore,
} from 'auth-kit/admin';
import { matrixOverrides } from '@/dev-matrix';
import { auditLog } from './audit-log';
import { outputs } from './outputs';
import { STARTER_ROLE_CATALOG } from './role-catalog';

const memFallback = createMemorySiteSettingsStore();

function adminSettingsStore(): SiteSettingsStore {
  const matrix = matrixOverrides();
  if (matrix) return matrix.shared('site-settings', createMemorySiteSettingsStore);
  if (outputs.custom?.siteSettingsTable) {
    return createDynamoSiteSettingsStore({
      tableName: outputs.custom.siteSettingsTable,
      region: outputs.auth.aws_region,
    });
  }
  return memFallback;
}

let rolePolicy: SiteSettingsRolePolicyStore | undefined;
export function siteRolePolicyStore(): SiteSettingsRolePolicyStore {
  if (matrixOverrides()) {
    return createSiteSettingsRolePolicyStore({
      catalog: STARTER_ROLE_CATALOG,
      settings: adminSettingsStore(),
      auditLog: auditLog(),
    });
  }
  return (rolePolicy ??= createSiteSettingsRolePolicyStore({
    catalog: STARTER_ROLE_CATALOG,
    settings: adminSettingsStore(),
    auditLog: auditLog(),
  }));
}

let profiles: DirectoryProfileStore | undefined;
export function directoryProfileStore(): DirectoryProfileStore {
  if (matrixOverrides()) {
    return createDirectoryProfileStore({ settings: adminSettingsStore(), auditLog: auditLog() });
  }
  return (profiles ??= createDirectoryProfileStore({
    settings: adminSettingsStore(),
    auditLog: auditLog(),
  }));
}

let usage: UsageLedgerStore | undefined;
export function usageLedgerStore(): UsageLedgerStore {
  if (matrixOverrides()) {
    return createUsageLedgerStore({ settings: adminSettingsStore() });
  }
  return (usage ??= createUsageLedgerStore({ settings: adminSettingsStore() }));
}

let inviteWelcome: InviteWelcomeStore | undefined;
export function inviteWelcomeStore(): InviteWelcomeStore {
  if (matrixOverrides()) {
    return createInviteWelcomeStore({ settings: adminSettingsStore(), auditLog: auditLog() });
  }
  return (inviteWelcome ??= createInviteWelcomeStore({
    settings: adminSettingsStore(),
    auditLog: auditLog(),
  }));
}

export interface EmailPreviewSpec {
  readonly id: string;
  readonly name: string;
  readonly trigger: string;
  readonly subject: string;
  readonly paragraphs: readonly string[];
  readonly ctaLabel?: string;
  readonly footer: string;
  readonly editableNote?: boolean;
}

export function buildEmailPreviewCatalog(input: {
  siteName: string;
  helpEmail: string;
  signInUrl: string;
  welcomeNote: string | null;
}): readonly EmailPreviewSpec[] {
  const footer = `Help: ${input.helpEmail}. Only enter sign-in codes at ${input.signInUrl.replace(/^https?:\/\//, '')}.`;
  return [
    {
      id: 'invite',
      name: 'Account invitation',
      trigger: 'Sent when an admin invites someone from Admin → People.',
      subject: `You’re invited to ${input.siteName}`,
      paragraphs: [
        input.welcomeNote ?? `You have been invited to sign in to ${input.siteName}.`,
        'Sign in with an emailed code first, then choose a passkey or password plus authenticator app.',
        'This invitation expires in 7 days if unused.',
      ],
      ctaLabel: `Open ${input.siteName}`,
      footer,
      editableNote: true,
    },
    {
      id: 'sign-in-code',
      name: 'Emailed sign-in code',
      trigger: 'Sent by Cognito when a user chooses “Email me a code”.',
      subject: `Your ${input.siteName} sign-in code`,
      paragraphs: [
        'Use this single-use 8-digit code to finish signing in: 4821 9034.',
        'The code expires in 10 minutes. If you did not request it, you can ignore this message.',
      ],
      footer,
    },
    {
      id: 'passkey-added',
      name: 'Passkey added notice',
      trigger: 'Sent automatically after someone registers a new passkey.',
      subject: `A passkey was added to your ${input.siteName} account`,
      paragraphs: [
        'A new passkey was saved to your account.',
        'If this was not you, sign out everywhere from My account and contact support immediately.',
      ],
      footer,
    },
    {
      id: 'password-changed',
      name: 'Password changed notice',
      trigger: 'Sent automatically after someone sets or changes their password.',
      subject: `Your ${input.siteName} password was changed`,
      paragraphs: [
        'Your account password was just updated.',
        'If you did not make this change, contact support right away.',
      ],
      footer,
    },
    {
      id: 'superadmin-grant',
      name: 'Admin grant owner alert',
      trigger: 'Sent to the site Owner whenever Admin (superadmin) is granted.',
      subject: `Admin access granted on ${input.siteName}`,
      paragraphs: [
        'An account was granted Admin (superadmin) access.',
        'Review Admin → Activity for the recorded reason and audit trail.',
      ],
      footer,
    },
    {
      id: 'ownership-transfer',
      name: 'Ownership transfer notice',
      trigger: 'Sent to both the outgoing and incoming Owner during Transfer ownership.',
      subject: `Ownership of ${input.siteName} was transferred`,
      paragraphs: [
        'Site ownership has moved to the new Owner, and the previous Owner now holds Admin access.',
        'Both parties receive this confirmation automatically; if delivery fails, the transfer is rolled back.',
      ],
      footer,
    },
    {
      id: 'help-address-changed',
      name: 'Sign-in help address changed',
      trigger: 'Sent to the Owner and all Admins when Settings → Sign-in help changes.',
      subject: `Sign-in help address updated for ${input.siteName}`,
      paragraphs: [
        `The reply-to and help address shown on sign-in screens and emails is now ${input.helpEmail}.`,
      ],
      footer,
    },
  ];
}
