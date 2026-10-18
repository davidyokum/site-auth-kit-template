/**
 * Site families: who runs a site, and how its email says so. Every site names one in
 * site.config.ts (`family`); the template ships 'personal'.
 *
 * Pure data and pure functions, with no imports and no path aliases: site.config.ts imports this
 * file, and the Amplify backend in `amplify/` imports site.config.ts.
 *
 * From the sign-in design report (5.1 "Rules for every auth email", 7.2 "What varies, per family"):
 * - the sender's display name: "{Site} (NC OSBM)", "{Site} (UNC)", or "{Site}";
 * - the footer's identity line on email the site sends, followed by "Help: {help}." when the site
 *   has a help (Reply-To) address. Auth email carries that help mailbox as Reply-To, never noreply;
 * - on the sign-in card: the owner line above the heading and the identity line at its foot;
 * - the email field's example address (its placeholder), which a site can override.
 *
 * The family's colors (the card's button, rule, and links, and the backdrop's palette) come from
 * auth-kit/backdrops (`BACKDROP_FAMILIES`), keyed by the same family names.
 *
 * This is the one file the hygiene test lets name an employer (test/unit/hygiene.test.ts).
 */

export type SiteFamily = 'osbm' | 'unc' | 'personal';

export interface FamilyText {
  /** Added to the site's name in the sender's display name, in parentheses. Null: the name alone. */
  readonly senderSuffix: string | null;
  /** The footer's identity line. `{site}` is the site's name; `{unit}` (UNC) its unit, or nothing. */
  readonly footer: string;
  /** The sign-in card's owner line, small, above the heading. `{unit}` as in `footer`. */
  readonly ownerLine: string;
  /** The sign-in card's identity line, at its foot. `{unit}` as in `footer`. */
  readonly cardFooter: string;
  /** The email field's example address (a placeholder; the "Email address" label always shows). */
  readonly emailHint: string;
}

export const SITE_FAMILIES = {
  osbm: {
    senderSuffix: 'NC OSBM',
    footer: '{site} is run by the NC Office of State Budget and Management.',
    ownerLine: 'NC Office of State Budget and Management',
    cardFooter: 'A tool of the NC Office of State Budget and Management.',
    emailHint: 'name@osbm.nc.gov',
  },
  unc: {
    senderSuffix: 'UNC',
    footer: 'A UNC-Chapel Hill {unit} project.',
    ownerLine: 'UNC-Chapel Hill · {unit}',
    cardFooter: 'A UNC-Chapel Hill {unit} project.',
    emailHint: 'name@unc.edu',
  },
  personal: {
    senderSuffix: null,
    footer: 'Made by Yokum Lab.',
    ownerLine: 'Yokum Lab',
    cardFooter: 'Made by Yokum Lab.',
    emailHint: 'name@example.com',
  },
} as const satisfies Record<SiteFamily, FamilyText>;

/** What the helpers read from site.config.ts. */
export interface FamilySite {
  readonly name: string;
  readonly family: SiteFamily;
  /** UNC only: the unit in "A UNC-Chapel Hill {unit} project". Null or absent: "A UNC-Chapel Hill project." */
  readonly familyUnit?: string | null;
  readonly email: { readonly replyTo?: string | null };
  /** The site's own email hint, overriding the family's (a site with outside users). */
  readonly emailHint?: string | null;
}

function familyOf(site: FamilySite): FamilyText {
  const family: FamilyText | undefined = (SITE_FAMILIES as Record<string, FamilyText>)[site.family];
  if (!family) throw new Error(`site.config.ts: family "${site.family}" isn't one of ${Object.keys(SITE_FAMILIES).join(', ')}.`);
  return family;
}

/** The sender's display name: "{Site} (NC OSBM)", "{Site} (UNC)", or "{Site}". */
export function senderDisplayName(site: FamilySite): string {
  const { senderSuffix } = familyOf(site);
  return senderSuffix === null ? site.name : `${site.name} (${senderSuffix})`;
}

/** Fills `{site}` and `{unit}` (dropping a missing unit and the separator before it). */
function fill(template: string, site: FamilySite): string {
  const unit = site.familyUnit?.trim();
  // Function replacements, so a `$` in a name is just a character.
  return template
    .replace('{site}', () => site.name)
    .replace(/(?: · | )\{unit\}/, (m) => (unit ? m.replace('{unit}', () => unit) : ''));
}

/** The sign-in card's owner line: "NC Office of State Budget and Management", "UNC-Chapel Hill · {unit}", "Yokum Lab". */
export function ownerLine(site: FamilySite): string {
  return fill(familyOf(site).ownerLine, site);
}

/** The sign-in card's identity line, at its foot. */
export function cardFooter(site: FamilySite): string {
  return fill(familyOf(site).cardFooter, site);
}

/** The email field's example address: the site's own `emailHint`, else the family's. */
export function emailHintFor(site: FamilySite): string {
  const own = site.emailHint?.trim();
  return own ? own : familyOf(site).emailHint;
}

/** The footer of email the site sends: who runs it, then "Help: {help}." when there's a help address. */
export function emailFooter(site: FamilySite): string {
  const unit = site.familyUnit?.trim();
  // Function replacements, so a `$` in a name is just a character.
  const identity = familyOf(site)
    .footer.replace('{site}', () => site.name)
    .replace(' {unit}', () => (unit ? ` ${unit}` : ''));
  const help = site.email.replyTo?.trim();
  return help ? `${identity} Help: ${help}.` : identity;
}
