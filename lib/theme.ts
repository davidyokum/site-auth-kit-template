/**
 * This site's auth-kit theme (`auth-kit/themes`; ADR 0024): its family's colors, sender name, footer
 * identity line, email hint, and help route, with the site's own help address, card style (register
 * E5), and email hint. The sign-in card, the sign-up and request screens, the chooser, the error and
 * not-found cards, the app's emails, and Cognito's code emails (amplify/auth/custom-message) all take
 * this one theme, so they agree.
 *
 * No path aliases: the Amplify backend imports it too.
 */
import { type AuthTheme, authTheme, type CardStyle } from 'auth-kit/themes';
import { type FamilySite, helpSettingFor } from '../site.families';

export interface ThemeSite extends FamilySite {
  readonly emailHint?: string | null;
  readonly ownerName?: string | null;
  /** The card's style (register E5). Left out: auth-kit's default, Quiet. */
  readonly cardStyle?: CardStyle;
}

/**
 * The site's theme: its family's, with the site's help address (a person's own only when site.config.ts
 * acknowledges it, register E4c), its card style, and (when set) its own email hint.
 */
export function siteTheme(site: ThemeSite): AuthTheme {
  const hint = site.emailHint?.trim();
  return authTheme(site.family, {
    helpAddress: helpSettingFor(site),
    ...(site.cardStyle !== undefined && { cardStyle: site.cardStyle }),
    ...(hint ? { emailHint: hint } : {}),
  });
}

/**
 * What the sign-in screens' `help` prop takes: the help address in effect (read on the server, so a
 * Super admin's override shows at once) and, on families that name owners, the owner's name.
 */
export function signInHelpProp(site: ThemeSite, address: string): { address: string; owner?: string } {
  const owner = site.ownerName?.trim();
  return { address, ...(owner ? { owner } : {}) };
}
