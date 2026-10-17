/**
 * Site families: who runs a site, and how its email says so. Every site names one in
 * site.config.ts (`family`); the template ships 'personal'.
 *
 * Pure data and pure functions, with no imports and no path aliases: site.config.ts imports this
 * file, and the Amplify backend in `amplify/` imports site.config.ts.
 *
 * Text only, from the sign-in design report (5.1 "Rules for every auth email", 7.2 "What varies,
 * per family"):
 * - the sender's display name: "{Site} (NC OSBM)", "{Site} (UNC)", or "{Site}";
 * - the footer's identity line on email the site sends, followed by "Help: {help}." when the site
 *   has a help (Reply-To) address. Auth email carries that help mailbox as Reply-To, never noreply.
 *
 * Themes hook in here later: the design work defines each family's look (owner line, colors,
 * wordmark), and it goes on each entry as `theme`. Nothing visual lives here yet.
 *
 * This is the one file the hygiene test lets name an employer (test/unit/hygiene.test.ts).
 */

export type SiteFamily = 'osbm' | 'unc' | 'personal';

export interface FamilyText {
  /** Added to the site's name in the sender's display name, in parentheses. Null: the name alone. */
  readonly senderSuffix: string | null;
  /** The footer's identity line. `{site}` is the site's name; `{unit}` (UNC) its unit, or nothing. */
  readonly footer: string;
  // theme: the design work's per-family look, when it exists. Text only for now.
}

export const SITE_FAMILIES = {
  osbm: {
    senderSuffix: 'NC OSBM',
    footer: '{site} is run by the NC Office of State Budget and Management.',
  },
  unc: {
    senderSuffix: 'UNC',
    footer: 'A UNC-Chapel Hill {unit} project.',
  },
  personal: {
    senderSuffix: null,
    footer: 'Made by Yokum Lab.',
  },
} as const satisfies Record<SiteFamily, FamilyText>;

/** What the helpers read from site.config.ts. */
export interface FamilySite {
  readonly name: string;
  readonly family: SiteFamily;
  /** UNC only: the unit in "A UNC-Chapel Hill {unit} project". Null or absent: "A UNC-Chapel Hill project." */
  readonly familyUnit?: string | null;
  readonly email: { readonly replyTo?: string | null };
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
