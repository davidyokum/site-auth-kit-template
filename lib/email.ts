/**
 * The email the site sends itself: invites and the owner's alerts (auth-kit's SES mailer, used by
 * lib/admin.ts), a project Manager's invite and the admins' alert about it (lib/resource-actions.ts),
 * the account-creation and self-service notices (lib/accounts.ts), and change alerts (lib/alerts.ts).
 *
 * Emails match the sign-in card (auth-kit ADR 0024; register E4a): no letterhead, the family's
 * sender name ("{Site} (UNC)" on a work site, or the site's name on personal sites), the help address as
 * Reply-To, and a footer that repeats the card's identity sentence, then "Help: {address}."
 * (personal sites: the help line alone). auth-kit's invite and account emails are built that way;
 * its plain alerts (Super admin granted, ownership moved, a Manager's invite, the unused owner
 * invite, a changed help address) are re-laid in the same layout here, so every email the site
 * sends looks like one family.
 *
 * The help address is the one in effect when each email goes out: the configured one, or a Super
 * admin's override (`createSignInHelp`, lib/accounts.ts). Cognito's code emails come from the custom
 * message trigger in the same layout (amplify/auth/custom-message).
 */
import 'server-only';
import { SESv2Client } from '@aws-sdk/client-sesv2';
import {
  createSesInviteMailer,
  type EmailBlock,
  type EmailSender,
  type EmailSite,
  type InviteMailer,
  type OwnerAlertNotifier,
  type OwnerInviteWarningNotifier,
  type RenderedEmail,
  type ResourceInviteNotifier,
  renderEmail,
  renderInviteEmail,
  renderOwnerInviteWarningEmail,
  renderOwnershipTransferEmail,
  renderResourceInviteAlertEmail,
  renderSignInHelpChangedEmail,
  renderSuperadminGrantEmail,
} from 'auth-kit/admin';
import { helpAddressOf, type SignInHelpSource } from 'auth-kit/accounts';
import { type AuthTheme, senderDisplayName } from 'auth-kit/themes';
import { site as configuredSite } from '@/site.config';
import type { FamilySite } from '@/site.families';
import { siteTheme } from './theme';

/** What these helpers read from site.config.ts (tests pass their own). */
export interface MailSite extends FamilySite {
  readonly emailHint?: string | null;
  readonly email: { readonly fromAddress: string; readonly replyTo?: string | null };
}

/** Letters, digits, spaces, and the other characters RFC 5322 allows unquoted in a display name. */
const PLAIN_DISPLAY_NAME = /^[A-Za-z0-9!#$%&'*+\-/=?^_`{|}~ ]+$/;

/**
 * The From header for SES: `Name <address>`. The name is the family's sender name, quoted when it has
 * characters RFC 5322 treats specially (the parentheses in "Example Site (UNC)" would otherwise read
 * as a comment), and MIME-encoded when it isn't ASCII, as SES requires.
 */
export function senderMailbox(site: MailSite = configuredSite): string {
  const name = senderDisplayName(site.name, site.family);
  const address = site.email.fromAddress.trim();
  if (/[\r\n]/.test(name)) throw new Error('site.config.ts: the site name may not contain line breaks.');
  if (!/^[^\s<>"@]+@[^\s<>"@]+\.[^\s<>"@]+$/.test(address)) throw new Error(`site.config.ts: email.fromAddress "${address}" isn't an address.`);
  let display: string;
  if (PLAIN_DISPLAY_NAME.test(name)) {
    display = name;
  } else if (/^[\x20-\x7e]+$/.test(name)) {
    display = `"${name.replace(/["\\]/g, '\\$&')}"`;
  } else {
    let binary = '';
    for (const byte of new TextEncoder().encode(name)) binary += String.fromCharCode(byte);
    display = `=?UTF-8?B?${btoa(binary)}?=`;
  }
  return `${display} <${address}>`;
}

/**
 * A plain email (subject, and text whose paragraphs are its lines) in the card's layout: the site's
 * name as a text wordmark, the paragraphs, and the footer ("{identity line}. Help: {address}.").
 */
export function inCardLayout(email: Pick<RenderedEmail, 'subject' | 'text' | 'preheader' | 'replyTo'>, site: EmailSite): RenderedEmail {
  const paragraphs = email.text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const blocks: EmailBlock[] = paragraphs.map((line) => ({ kind: 'paragraph', parts: [line] }));
  return renderEmail({
    site,
    subject: email.subject,
    preheader: email.preheader ?? paragraphs[0] ?? email.subject,
    blocks,
    ...(email.replyTo !== undefined && { replyTo: email.replyTo }),
  });
}

export interface SiteMailerOptions {
  region: string;
  client?: SESv2Client;
  /** The help address in effect: an address, or `createSignInHelp` (lib/accounts.ts). */
  help: SignInHelpSource;
  /** Absolute sign-in URL: its host is the "only enter codes at" domain in the layout. */
  signInUrl: string;
}

export type SiteMailer = InviteMailer & Required<OwnerAlertNotifier> & OwnerInviteWarningNotifier & ResourceInviteNotifier & EmailSender;

/**
 * Invites (the People page's, an approved request's, and a project Manager's), the owner's alerts, the
 * warning about the owner's unused invite, the admins' alert about a Manager's invite, a changed help
 * address, and any already-rendered email (`sendEmail`: account-creation and self-service notices):
 * auth-kit's SES mailer, from this site's sender, with the help address in effect as Reply-To (an
 * invite replies to whoever sent it) and the card's footer.
 */
export function createSiteMailer(options: SiteMailerOptions, site: MailSite = configuredSite): SiteMailer {
  const theme: AuthTheme = siteTheme(site);
  const from = senderMailbox(site);
  // One SES client for every message; a mailer per message, so each has the help address in effect.
  let client = options.client;
  const mailer = async () => {
    const helpEmail = await helpAddressOf(options.help);
    const layout: EmailSite = { siteName: site.name, theme, signInUrl: options.signInUrl, helpEmail };
    const card =
      <T,>(render: (input: T) => RenderedEmail) =>
      (input: T) =>
        inCardLayout(render(input), layout);
    client ??= new SESv2Client({ region: options.region });
    return createSesInviteMailer({
      from,
      client,
      replyTo: [helpEmail],
      // People actions pass the theme and help address; a Manager's invite (auth-kit/resources) doesn't.
      render: (input) => renderInviteEmail({ ...input, theme: input.theme ?? theme, helpEmail: input.helpEmail ?? helpEmail }),
      renderSuperadminGrant: card(renderSuperadminGrantEmail),
      renderOwnershipTransfer: card(renderOwnershipTransferEmail),
      renderOwnerInviteWarning: card(renderOwnerInviteWarningEmail),
      renderResourceInvite: card(renderResourceInviteAlertEmail),
      renderSignInHelpChanged: card(renderSignInHelpChangedEmail),
    });
  };
  return {
    sendInvite: async (input) => (await mailer()).sendInvite(input),
    superadminGranted: async (alert) => (await mailer()).superadminGranted(alert),
    ownershipTransferred: async (alert) => (await mailer()).ownershipTransferred(alert),
    signInHelpChanged: async (alert) => (await mailer()).signInHelpChanged(alert),
    ownerInviteUnused: async (warning) => (await mailer()).ownerInviteUnused(warning),
    resourceInviteSent: async (alert) => (await mailer()).resourceInviteSent(alert),
    sendEmail: async (message) => (await mailer()).sendEmail(message),
  };
}
