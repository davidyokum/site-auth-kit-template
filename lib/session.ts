/**
 * Session settings both halves of the app need: the browser (configureAuthClient) and the server
 * (the proxy's refresh adapter, the dev kit's cookies). No imports from auth-kit/server, so client
 * components can use it, and none from auth-kit/client, so the proxy can.
 *
 * Token cookies must expire with the app client's refresh token instead of outliving it. On Full
 * sign-in the preset's refresh token is the tier's ceiling (30 days on Tier 2, 1 day on Tier 3); on
 * Simple it's the `stay` (auth-kit ADR 0029: 'browser' is 12 hours, behind cookies that end when the
 * browser quits). test/unit/session.test.ts fails if this drifts from auth-kit's `signInSession`.
 */
import { site } from '@/site.config';

const REFRESH_TOKEN_MINUTES_BY_TIER = { 2: 30 * 24 * 60, 3: 24 * 60 } as const;
/** "Every visit": the refresh token's ceiling behind browser-session cookies. */
const BROWSER_STAY_MINUTES = 12 * 60;

const ceiling: number = REFRESH_TOKEN_MINUTES_BY_TIER[site.tier];
const signIn = site.signIn as { mode: 'full' } | { mode: 'simple'; stay?: 'browser' | number };
/** Simple's stay (default 30 days, at most the tier's ceiling), or null on Full. */
const stay = signIn.mode === 'simple' ? (signIn.stay ?? Math.min(30, ceiling / (24 * 60))) : null;

/** The app client's refresh-token lifetime, in minutes. */
export const refreshTokenMinutes: number = stay === null ? ceiling : stay === 'browser' ? BROWSER_STAY_MINUTES : stay * 24 * 60;

/** Simple with `stay: 'browser'`: the token cookies end when the browser quits (no Max-Age, no Expires). */
export const browserSessionCookies: boolean = stay === 'browser';

/** True on a Simple site: an emailed code is the only way in. */
export const simpleSignIn: boolean = signIn.mode === 'simple';
