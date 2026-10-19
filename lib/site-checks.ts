/**
 * What site.config.ts must hold, checked where it's cheapest to hear about it: `next dev` and every
 * build stop on a problem (next.config.ts), and the unit tests check the template's own config.
 * auth-kit checks the same things again where they're used (the preset at synthesis, the screens when
 * they render, the routes when they start); this says it first, in one list, naming the fix.
 *
 * - a sender: the site's `sign-in@` mailbox, or its family's (auth-kit refuses `noreply@` or any other
 *   local part, register A10, and on personal sites any address but sign-in@yokum.app, register F11);
 * - a help address: the site's own or its family's, role-based (auth-kit refuses a placeholder, and a
 *   person's own address unless it's acknowledged with `{ address, personal: true }`, register E4c);
 * - a known card style (register E5);
 * - a known account-creation mode, with a domain list in 'domains' mode;
 * - sign-up sites ('domains', 'open'): a privacy notice, and the site web ACL with its JavaScript
 *   integration (`siteWaf`; every sign-up gets the silent WAF check, register D3);
 * - links that are site paths or https URLs, and a code lifetime Cognito accepts.
 *
 * No path aliases: next.config.ts imports it.
 */
import { CARD_STYLES, type CardStyle, helpSettingProblems, senderProblems, siteSender } from 'auth-kit/themes';
import type { SiteWaf } from '../site.config';
import { type FamilySite, helpSettingFor, senderAddressFor } from '../site.families';
import { type AccountCreationLike, takesSignUps } from './account-modes';

export interface CheckedSite extends FamilySite {
  readonly cardStyle?: CardStyle;
  readonly accountCreation: AccountCreationLike;
  readonly codeLifetimeMinutes: number;
  readonly privacyNoticeUrl: string | null;
  readonly termsUrl: string | null;
  readonly siteWaf: SiteWaf | null;
}

const SITE_WEB_ACL_ARN = /^arn:aws:wafv2:us-east-1:\d{12}:global\/webacl\/[A-Za-z0-9_-]{1,128}\/[0-9a-f-]{36}$/;
const WAF_INTEGRATION_URL = /^https:\/\/[a-z0-9-]+\.(?:[a-z0-9-]+\.)?sdk\.awswaf\.com\/[^\s]+\/challenge\.js$/;

/** A site path (`/privacy`) or an https URL: what auth-kit's screens accept for a link. */
function linkProblem(value: string | null, key: string): string | null {
  if (value === null) return null;
  if (/^\/(?!\/)[^\s]*$/.test(value)) return null;
  try {
    if (new URL(value).protocol === 'https:') return null;
  } catch {
    // reported below
  }
  return `${key} "${value}" must be a site path like "/privacy" or an https URL.`;
}

/** Every problem with the site's config, or `[]`. */
export function siteConfigProblems(site: CheckedSite): string[] {
  const problems: string[] = [];
  const message = (error: unknown) => (error instanceof Error ? error.message.replace(/^auth-kit: /, '') : String(error));

  try {
    for (const p of senderProblems(siteSender(site.name, site.family, senderAddressFor(site)), { siteName: site.name, theme: site.family })) problems.push(`site.config.ts email.fromAddress (the sender): ${p}`);
  } catch (error) {
    problems.push(message(error).startsWith('site.config.ts') ? message(error) : `site.config.ts email.fromAddress (the sender): ${message(error)}`);
  }

  try {
    for (const p of helpSettingProblems(helpSettingFor(site))) problems.push(`site.config.ts email.replyTo (the help address): ${p}`);
  } catch (error) {
    problems.push(message(error));
  }

  if (site.cardStyle !== undefined && !CARD_STYLES.includes(site.cardStyle)) {
    problems.push(`site.config.ts cardStyle must be one of ${CARD_STYLES.map((s) => `'${s}'`).join(', ')} (got ${JSON.stringify(site.cardStyle)}).`);
  }

  const { mode, domains, requestsAlso } = site.accountCreation;
  if (!['invite', 'request', 'domains', 'open'].includes(mode)) {
    problems.push(`site.config.ts accountCreation.mode must be 'invite', 'request', 'domains', or 'open' (got ${JSON.stringify(mode)}).`);
  } else if (mode === 'domains') {
    if (!Array.isArray(domains) || domains.length === 0) problems.push("site.config.ts accountCreation: 'domains' mode needs a domain list, e.g. { mode: 'domains', domains: ['example.org'] }.");
  } else if (domains !== undefined || requestsAlso !== undefined) {
    problems.push(`site.config.ts accountCreation: domains and requestsAlso apply only to 'domains' mode.`);
  }
  if (takesSignUps(site.accountCreation) && site.privacyNoticeUrl === null) {
    problems.push(`site.config.ts privacyNoticeUrl: a sign-up site ('${mode}') links its privacy notice from the sign-up screen (register D4). Set it to a site path or an https URL.`);
  }
  if (takesSignUps(site.accountCreation) && site.siteWaf === null) {
    problems.push(
      `site.config.ts siteWaf: a sign-up site ('${mode}') needs the site web ACL in front of the sign-up route, and its JavaScript integration: every sign-up gets the silent WAF check (register D3; README, "Account creation").`,
    );
  }
  if (site.siteWaf !== null) {
    if (!SITE_WEB_ACL_ARN.test(site.siteWaf.webAclArn)) problems.push(`site.config.ts siteWaf.webAclArn "${site.siteWaf.webAclArn}" isn't a CLOUDFRONT web ACL ARN (arn:aws:wafv2:us-east-1:<account>:global/webacl/<name>/<id>).`);
    if (!WAF_INTEGRATION_URL.test(site.siteWaf.integrationUrl)) problems.push(`site.config.ts siteWaf.integrationUrl "${site.siteWaf.integrationUrl}" isn't AWS WAF's JavaScript integration URL (https://<id>.edge.sdk.awswaf.com/<id>/<token>/challenge.js).`);
  }
  for (const problem of [linkProblem(site.privacyNoticeUrl, 'site.config.ts privacyNoticeUrl'), linkProblem(site.termsUrl, 'site.config.ts termsUrl')]) if (problem) problems.push(problem);
  if (!Number.isInteger(site.codeLifetimeMinutes) || site.codeLifetimeMinutes < 3 || site.codeLifetimeMinutes > 15) {
    problems.push(`site.config.ts codeLifetimeMinutes must be a whole number from 3 to 15 (Cognito's range); got ${site.codeLifetimeMinutes}.`);
  }
  return problems;
}

/** Throws every problem at once (next.config.ts runs it for `next dev` and every build). */
export function assertSiteConfig(site: CheckedSite): void {
  const problems = siteConfigProblems(site);
  if (problems.length > 0) throw new Error(`site.config.ts has problems:\n- ${problems.join('\n- ')}`);
}

/** The privacy notice a sign-up screen links (required there). */
export function requiredPrivacyNotice(site: Pick<CheckedSite, 'privacyNoticeUrl'>): string {
  if (site.privacyNoticeUrl === null) throw new Error('site.config.ts privacyNoticeUrl: a sign-up site needs its privacy notice.');
  return site.privacyNoticeUrl;
}
