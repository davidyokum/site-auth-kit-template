/**
 * The email the site sends itself: invites and owner-grant alerts (auth-kit's SES mailer, used by
 * lib/admin.ts) and change alerts (lib/alerts.ts). All of it comes from the family's sender name
 * (site.families.ts), carries the help mailbox as Reply-To, and ends with the family footer.
 *
 * Cognito's own email (sign-in and verification codes) gets the same sender name and Reply-To from
 * the pool (amplify/auth/resource.ts), but not the footer: its text is Cognito's. Full control of
 * those messages needs Cognito's custom email sender trigger (later).
 */
import 'server-only';
import type { SESv2Client } from '@aws-sdk/client-sesv2';
import {
  createSesInviteMailer,
  type InviteMailer,
  type OwnerAlertNotifier,
  type RenderedEmail,
  renderInviteEmail,
  renderOwnerAlertEmail,
} from 'auth-kit/admin';
import { site as configuredSite } from '@/site.config';
import { emailFooter, type FamilySite, senderDisplayName } from '@/site.families';

/** What these helpers read from site.config.ts (tests pass their own). */
export interface EmailSite extends FamilySite {
  readonly email: { readonly fromAddress: string; readonly replyTo?: string | null };
}

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c);

/** Letters, digits, spaces, and the other characters RFC 5322 allows unquoted in a display name. */
const PLAIN_DISPLAY_NAME = /^[A-Za-z0-9!#$%&'*+\-/=?^_`{|}~ ]+$/;

/**
 * The From header for SES: `Name <address>`. The name is quoted when it has characters RFC 5322
 * treats specially (the parentheses in "Example Site (UNC)" would otherwise read as a comment),
 * and MIME-encoded when it isn't ASCII, as SES requires.
 */
export function senderMailbox(site: EmailSite = configuredSite): string {
  const name = senderDisplayName(site);
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

/** Reply-To for every email the site sends: the help mailbox, or none. */
export function replyToAddresses(site: EmailSite = configuredSite): string[] {
  const help = site.email.replyTo?.trim();
  return help ? [help] : [];
}

/** A plain-text body with the family footer after a blank line. */
export function withFooterText(text: string, site: EmailSite = configuredSite): string {
  return `${text}\n\n${emailFooter(site)}`;
}

/** An email with the family footer: appended to the text, and HTML-escaped to the HTML. */
export function withFooter(email: RenderedEmail, site: EmailSite = configuredSite): RenderedEmail {
  return { ...email, text: withFooterText(email.text, site), html: `${email.html}\n<p>${escapeHtml(emailFooter(site))}</p>` };
}

/**
 * Invites and owner-grant alerts: auth-kit's SES mailer and its templates, with this site's sender,
 * Reply-To, and footer.
 */
export function createSiteMailer(options: { region: string; client?: SESv2Client }, site: EmailSite = configuredSite): InviteMailer & OwnerAlertNotifier {
  const replyTo = replyToAddresses(site);
  return createSesInviteMailer({
    from: senderMailbox(site),
    region: options.region,
    ...(options.client && { client: options.client }),
    ...(replyTo.length > 0 && { replyTo }),
    render: (input) => withFooter(renderInviteEmail(input), site),
    renderOwnerAlert: (alert) => withFooter(renderOwnerAlertEmail(alert), site),
  });
}
