/**
 * Site families: who runs a site. Every site names one in site.config.ts (`family`); the template
 * ships 'personal'.
 *
 * Since auth-kit 0.1.8 the families are auth-kit themes (`auth-kit/themes`, ADR 0024): the accent
 * colors, the sender's display name ("{Site} (NC OSBM)", "{Site} (UNC)", "{Site}"), the footer
 * identity line on the sign-in card and at the foot of every email ("This site is managed by …";
 * personal sites name nobody), the email field's example, the help route, and the card's style all
 * come from there, so the card, the emails, and Cognito's code emails say the same thing. lib/theme.ts
 * builds this site's theme from them.
 *
 * This table holds the two addresses a family may share among its sites (registers A10, E4c, F11):
 * the sender (always a reply-able `sign-in@` mailbox, never `noreply@`) and the role-based help
 * mailbox. Since auth-kit 0.1.9 its themes carry the same ones (`theme.senderAddress`,
 * `theme.help.address`: the personal family's on yokum.app, none yet for OSBM or UNC), and
 * test/unit/families.test.ts holds this table to them. A site overrides either in site.config.ts
 * (`email.fromAddress`, `email.replyTo`), and a Super admin can override the help address without a
 * deploy (Admin → Settings → "Sign-in help").
 *
 * Pure data and pure functions, with no imports and no path aliases: site.config.ts imports this
 * file, the Amplify backend in `amplify/` imports site.config.ts, and the scripts load both with
 * TypeScript's transpiler (from a temporary folder, where no package import would resolve).
 *
 * This is the one file the hygiene test lets name an employer (test/unit/hygiene.test.ts).
 */

/** The three families (auth-kit's `ThemeFamily`). */
export type SiteFamily = 'osbm' | 'unc' | 'personal';

export const SITE_FAMILIES: readonly SiteFamily[] = ['osbm', 'unc', 'personal'];

/**
 * Each family's sender: the `sign-in@` mailbox its sites send auth email from, or null where each
 * site sends from its own (`email.fromAddress` in site.config.ts, on a domain verified in SES).
 *
 * - personal: sign-in@yokum.app (SES domain identity yokum.app, MAIL FROM mail.yokum.app; live and
 *   verified in the personal account since 2026-10-19; register F11).
 * - osbm, unc: none; each site sends from `sign-in@` on its own verified domain.
 */
export const FAMILY_SENDER: Readonly<Record<SiteFamily, string | null>> = {
  osbm: null,
  unc: null,
  personal: 'sign-in@yokum.app',
};

/**
 * Each family's help mailbox, or null where the family has none yet (each of its sites sets its own
 * in site.config.ts, e.g. its existing site mailbox).
 *
 * - personal: help@yokum.app, forwarding to David (Cloudflare Email Routing, live since 2026-10-19;
 *   register F11). It was help@yokumlab.com, which still forwards.
 * - osbm: a shared mailbox from OSBM IT, once there is one.
 * - unc: a shared mailbox, once there is one.
 */
export const FAMILY_HELP_MAILBOX: Readonly<Record<SiteFamily, string | null>> = {
  osbm: null,
  unc: null,
  personal: 'help@yokum.app',
};

/** Families whose help screens name the site's owner ("Jordan Lee looks after …"); personal sites say "the {Site} team". */
export const FAMILY_NAMES_OWNER: Readonly<Record<SiteFamily, boolean>> = { osbm: true, unc: true, personal: false };

/**
 * A site's own help address in site.config.ts (auth-kit's `HelpAddressSetting`): a role-based mailbox,
 * or a person's own address acknowledged on purpose, `{ address, personal: true }` (register E4c: only
 * for a site that deliberately signals it's one person, never the default).
 */
export type SiteHelpAddress = string | { readonly address: string; readonly personal: true };

/** What the helpers read from site.config.ts. */
export interface FamilySite {
  readonly name: string;
  readonly family: SiteFamily;
  readonly email: { readonly fromAddress?: string | null; readonly replyTo?: SiteHelpAddress | null };
}

export function isSiteFamily(value: unknown): value is SiteFamily {
  return typeof value === 'string' && (SITE_FAMILIES as readonly string[]).includes(value);
}

function checkedFamily(site: FamilySite): SiteFamily {
  if (!isSiteFamily(site.family)) throw new Error(`site.config.ts: family "${String(site.family)}" isn't one of ${SITE_FAMILIES.join(', ')}.`);
  return site.family;
}

/**
 * The site's configured help address as auth-kit takes it: its own (`email.replyTo`), lowercased, else
 * its family's mailbox. A person's own address stays `{ address, personal: true }`, so auth-kit sees the
 * acknowledgement. Throws, naming the fix, when there's neither: the help address is required
 * (auth-kit refuses a pool, a sign-in page, and the code emails without one).
 */
export function helpSettingFor(site: FamilySite): SiteHelpAddress {
  const family = checkedFamily(site);
  const own = site.email.replyTo;
  if (own !== null && typeof own === 'object') {
    if (own.personal !== true) throw new Error("site.config.ts email.replyTo: an object acknowledges a person's own address on purpose: { address: '…', personal: true }.");
    return { address: String(own.address ?? '').trim().toLowerCase(), personal: true };
  }
  const trimmed = own?.trim();
  if (trimmed) return trimmed.toLowerCase();
  const shared = FAMILY_HELP_MAILBOX[family];
  if (shared) return shared;
  throw new Error(
    `site.config.ts: this site needs a help address. The ${family} family has no shared help mailbox yet, so set email.replyTo to a ` +
      "role-based mailbox the site's people can write to (never a person's own address). npm run setup asks for it.",
  );
}

/** The help address alone (the "Help: …" line, Reply-To headers): `helpSettingFor`'s address. */
export function helpAddressFor(site: FamilySite): string {
  const setting = helpSettingFor(site);
  return typeof setting === 'string' ? setting : setting.address;
}

/**
 * The address the site's auth email comes from: its own (`email.fromAddress`), lowercased, else its
 * family's shared sender. Throws, naming the fix, when there's neither: every email needs a reply-able
 * `sign-in@` sender (auth-kit refuses anything else at synthesis and when the mailer starts).
 */
export function senderAddressFor(site: FamilySite): string {
  const family = checkedFamily(site);
  const own = site.email.fromAddress?.trim();
  if (own) return own.toLowerCase();
  const shared = FAMILY_SENDER[family];
  if (shared) return shared;
  throw new Error(
    `site.config.ts: this site needs a sender. The ${family} family has no shared sender, so set email.fromAddress to the site's ` +
      "sign-in@ mailbox on a domain verified in SES (e.g. 'sign-in@reports.example.org'). npm run setup asks for it.",
  );
}
