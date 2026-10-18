/**
 * Site families: who runs a site. Every site names one in site.config.ts (`family`); the template
 * ships 'personal'.
 *
 * Since auth-kit 0.1.8 the families are auth-kit themes (`auth-kit/themes`, ADR 0024): the accent
 * colors, the sender's display name ("{Site} (NC OSBM)", "{Site} (UNC)", "{Site}"), the footer
 * identity line on the sign-in card and at the foot of every email ("This site is managed by …";
 * personal sites name nobody), the email field's example, and the help route all come from there,
 * so the card, the emails, and Cognito's code emails say the same thing. lib/theme.ts builds this
 * site's theme from them.
 *
 * What auth-kit deliberately doesn't ship is each family's help mailbox (ADR 0024: "no default
 * ships"). That's the one fact this table holds (register E4c): one role-based mailbox per family,
 * never a person's own address. A site can override it in site.config.ts (`email.replyTo`), and a
 * Super admin can override that without a deploy (Admin → Settings → "Sign-in help").
 *
 * Pure data and pure functions, with no imports and no path aliases: site.config.ts imports this
 * file, the Amplify backend in `amplify/` imports site.config.ts, and the scripts load both with
 * TypeScript's transpiler.
 *
 * This is the one file the hygiene test lets name an employer (test/unit/hygiene.test.ts).
 */

/** The three families (auth-kit's `ThemeFamily`). */
export type SiteFamily = 'osbm' | 'unc' | 'personal';

export const SITE_FAMILIES: readonly SiteFamily[] = ['osbm', 'unc', 'personal'];

/**
 * Each family's help mailbox, or null where the family has none yet (each of its sites sets its own
 * in site.config.ts, e.g. its existing site mailbox).
 *
 * - personal: help@yokumlab.com, forwarding to David (live since 2026-10-18).
 * - osbm: a shared mailbox from OSBM IT, once there is one.
 * - unc: a shared mailbox, once there is one.
 */
export const FAMILY_HELP_MAILBOX: Readonly<Record<SiteFamily, string | null>> = {
  osbm: null,
  unc: null,
  personal: 'help@yokumlab.com',
};

/** Families whose help screens name the site's owner ("Jordan Lee looks after …"); personal sites say "the {Site} team". */
export const FAMILY_NAMES_OWNER: Readonly<Record<SiteFamily, boolean>> = { osbm: true, unc: true, personal: false };

/** What the helpers read from site.config.ts. */
export interface FamilySite {
  readonly name: string;
  readonly family: SiteFamily;
  readonly email: { readonly replyTo?: string | null };
}

export function isSiteFamily(value: unknown): value is SiteFamily {
  return typeof value === 'string' && (SITE_FAMILIES as readonly string[]).includes(value);
}

/**
 * The site's configured help address: its own (`email.replyTo`), else its family's mailbox. Throws,
 * naming the fix, when there's neither: the help address is required (auth-kit refuses a pool, a
 * sign-in page, and the code emails without one), so a site can't ship without it.
 */
export function helpAddressFor(site: FamilySite): string {
  if (!isSiteFamily(site.family)) throw new Error(`site.config.ts: family "${String(site.family)}" isn't one of ${SITE_FAMILIES.join(', ')}.`);
  const own = site.email.replyTo?.trim();
  if (own) return own.toLowerCase();
  const family = FAMILY_HELP_MAILBOX[site.family];
  if (family) return family;
  throw new Error(
    `site.config.ts: this site needs a help address. The ${site.family} family has no shared help mailbox yet, so set email.replyTo to a ` +
      "role-based mailbox the site's people can write to (never a person's own address). npm run setup asks for it.",
  );
}
