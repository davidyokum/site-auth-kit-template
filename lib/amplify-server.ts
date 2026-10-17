/**
 * Amplify's Next.js adapter, used for one thing only: refreshing an expired session server-side in
 * the proxy, so people aren't bounced to sign-in every hour (auth-kit ADR 0007). auth-kit verifies
 * every token itself; the adapter's own validator deliberately accepts expired tokens.
 *
 * The cookies it writes are Secure, SameSite=Lax, and expire with the refresh token
 * (`amplifyCookieRuntimeOptions`). Over plain http on *.localhost under `next dev` they drop Secure,
 * because browsers won't store Secure cookies from an http page.
 */
import { createServerRunner } from '@aws-amplify/adapter-nextjs';
import { amplifyCookieRuntimeOptions } from 'auth-kit/server';
import { devOrigin } from '@/site.config';
import { amplifyOutputs } from './outputs';
import { refreshTokenMinutes } from './session';

export const { runWithAmplifyServerContext } = createServerRunner({
  config: amplifyOutputs,
  runtimeOptions: amplifyCookieRuntimeOptions({
    refreshTokenMinutes,
    ...(process.env.NODE_ENV === 'development' && { localDevOrigin: devOrigin }),
  }),
});
