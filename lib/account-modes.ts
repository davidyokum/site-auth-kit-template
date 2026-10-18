/**
 * What the site's account-creation mode (site.config.ts `accountCreation`; auth-kit ADR 0023) turns
 * on, in one place: which pages and routes exist, which tables and jobs the backend deploys, and
 * which screens the sign-in card links to.
 *
 * - Sign-up sites (`domains`, `open`): /sign-up and its route, the rate-limit table, the 24-hour
 *   sweep of never-verified sign-ups, members' own email change and delete on My account, and (in
 *   `domains` mode) the preSignUp trigger.
 * - Request sites (`request`, or `domains` with `requestsAlso`): /request-access and its route, the
 *   request and rate-limit tables, the daily digest, and the People page's "Pending requests" tab.
 * - Invite only: none of it.
 *
 * Pure, with no imports and no path aliases: next.config.ts (which pages exist), the Amplify backend
 * (which tables and jobs deploy), and the app all read it. The rules are auth-kit's own
 * (`allowsSelfSignUp`, `takesAccessRequests` in `auth-kit/accounts`); test/unit/account-modes.test.ts
 * holds them to auth-kit's for every mode.
 */

export type AccountCreationModeName = 'invite' | 'request' | 'domains' | 'open';

export interface AccountCreationLike {
  readonly mode: AccountCreationModeName;
  readonly domains?: readonly string[];
  readonly requestsAlso?: boolean;
}

/** People create their own account here (`domains` or `open`). */
export function takesSignUps(setting: AccountCreationLike): boolean {
  return setting.mode === 'domains' || setting.mode === 'open';
}

/** People can ask for an account here (`request`, or `domains` with `requestsAlso`). */
export function takesRequests(setting: AccountCreationLike): boolean {
  return setting.mode === 'request' || (setting.mode === 'domains' && setting.requestsAlso === true);
}

/** The sign-up or request routes need the per-address and per-IP counters. */
export function needsRateLimits(setting: AccountCreationLike): boolean {
  return takesSignUps(setting) || takesRequests(setting);
}

/**
 * The page extensions that switch the account-creation pages and routes on (next.config.ts): a file
 * named `page.signup.tsx` or `route.signup.ts` exists in the app only on sign-up sites, and
 * `page.request.tsx` / `route.request.ts` only on request sites. Elsewhere they aren't routes at all,
 * so the build, the route manifest, and the auth matrix don't have them (the same mechanism keeps
 * the localhost kit's `.dev.ts` routes out of builds).
 */
export function accountCreationPageExtensions(setting: AccountCreationLike): string[] {
  return [...(takesSignUps(setting) ? ['signup.tsx', 'signup.ts'] : []), ...(takesRequests(setting) ? ['request.tsx', 'request.ts'] : [])];
}
