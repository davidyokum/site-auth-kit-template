/**
 * This site's auth-kit theme (`auth-kit/themes`; ADR 0024): its family's colors, sender name, footer
 * identity line, email hint, and help route, with the site's own help address and email hint. The
 * sign-in card, the sign-up and request screens, the error and not-found cards, the app's emails,
 * and Cognito's code emails (amplify/auth/custom-message) all take this one theme, so they agree.
 *
 * No path aliases: the Amplify backend imports it too.
 */
import { type AuthTheme, authTheme } from 'auth-kit/themes';
import { type FamilySite, helpAddressFor } from '../site.families';

export interface ThemeSite extends FamilySite {
  readonly emailHint?: string | null;
  readonly ownerName?: string | null;
}

/** The site's theme: its family's, with the site's help address and (when set) its own email hint. */
export function siteTheme(site: ThemeSite): AuthTheme {
  const hint = site.emailHint?.trim();
  return authTheme(site.family, { helpAddress: helpAddressFor(site), ...(hint ? { emailHint: hint } : {}) });
}

/**
 * What the sign-in screens' `help` prop takes: the help address in effect (read on the server, so a
 * Super admin's override shows at once) and, on families that name owners, the owner's name.
 */
export function signInHelpProp(site: ThemeSite, address: string): { address: string; owner?: string } {
  const owner = site.ownerName?.trim();
  return { address, ...(owner ? { owner } : {}) };
}
