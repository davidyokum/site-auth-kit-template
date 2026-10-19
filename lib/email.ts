/**
 * The email the site sends itself: invites and the owner's alerts (auth-kit's SES mailer, used by
 * lib/admin.ts), a project Manager's invite and the admins' alert about it (lib/resource-actions.ts),
 * the account-creation and self-service notices (lib/accounts.ts), and change alerts (lib/alerts.ts).
 *
 * Emails match the sign-in card (auth-kit ADR 0024; register E4a): no letterhead, the site's reply-able
 * `sign-in@` mailbox under the family's sender name ("{Site} (UNC)" on a work site, or the site's name
 * on personal sites; register A10), the help address as Reply-To, and a footer that repeats the card's
 * identity sentence, then "Help: {address}." (personal sites: the help line alone). Since auth-kit
 * 0.1.9 every email its mailer sends is built that way, its alerts included (Super admin granted,
 * ownership moved, a Manager's invite, the unused owner invite, a changed help address); the site's
 * own grant and removal alerts (lib/alerts.ts) use the same layout through `inCardLayout`.
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
} from 'auth-kit/admin';
import { helpAddressOf, type SignInHelpSource } from 'auth-kit/accounts';
import { type AuthTheme, siteSender } from 'auth-kit/themes';
import { site as configuredSite } from '@/site.config';
import { type FamilySite, senderAddressFor } from '@/site.families';
import { type ThemeSite, siteTheme } from './theme';

/** What these helpers read from site.config.ts (tests pass their own). */
export type MailSite = ThemeSite & FamilySite;

/**
 * The From header: the site's `sign-in@` mailbox (its own, else its family's) under the family's
 * sender name, quoted when it has characters RFC 5322 treats specially (the parentheses in "Example
 * Site (UNC)" would otherwise read as a comment), and written as RFC 2047 encoded-words when it isn't
 * ASCII, as SES requires. auth-kit's `siteSender` builds it and refuses a `noreply@` or any other local
 * part (register A10), and on personal sites any address but sign-in@yokum.app (register F11).
 */
export function senderMailbox(site: MailSite = configuredSite): string {
  if (/[\r\n]/.test(site.name)) throw new Error('site.config.ts: the site name may not contain line breaks.');
  return siteSender(site.name, site.family, senderAddressFor(site));
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
 * address, and any already-rendered email (`sendEmail`: the account-change notices, and the
 * account-creation and self-service emails): auth-kit's SES mailer, from this site's sender, with the
 * help address in effect as Reply-To (an invite replies to whoever sent it) and the card's footer.
 */
export function createSiteMailer(options: SiteMailerOptions, site: MailSite = configuredSite): SiteMailer {
  const theme: AuthTheme = siteTheme(site);
  const from = senderMailbox(site);
  // One SES client for every message; a mailer per message, so each has the help address in effect.
  let client = options.client;
  const mailer = async () => {
    const helpEmail = await helpAddressOf(options.help);
    client ??= new SESv2Client({ region: options.region });
    return createSesInviteMailer({
      from,
      client,
      replyTo: [helpEmail],
      // The site, for the alerts' layout and footer (auth-kit lays each one out like the card).
      site: { siteName: site.name, theme, help: helpEmail, signInUrl: options.signInUrl },
      // People actions pass the theme and help address; a Manager's invite (auth-kit/resources) doesn't.
      render: (input) => renderInviteEmail({ ...input, theme: input.theme ?? theme, helpEmail: input.helpEmail ?? helpEmail }),
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
