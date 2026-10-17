/**
 * Session settings both halves of the app need: the browser (configureAuthClient) and the server
 * (the proxy's refresh adapter, the dev kit's cookies). No imports from auth-kit/server, so client
 * components can use it.
 *
 * Token cookies must expire with the app client's refresh token instead of outliving it. The
 * preset's default refresh token is the tier's ceiling (30 days on Tier 2, 1 day on Tier 3);
 * test/unit/session.test.ts fails if this drifts from what amplify/auth/resource.ts deploys.
 */
import { site } from '@/site.config';

const REFRESH_TOKEN_MINUTES_BY_TIER = { 2: 30 * 24 * 60, 3: 24 * 60 } as const;

/** The app client's refresh-token lifetime, in minutes. */
export const refreshTokenMinutes: number = REFRESH_TOKEN_MINUTES_BY_TIER[site.tier];
