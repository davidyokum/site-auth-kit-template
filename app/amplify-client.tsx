'use client';
/**
 * Configures Amplify in the browser the way the standard expects (auth-kit `configureAuthClient`):
 * `ssr: true` (tokens in cookies the server verifies), SameSite=Lax, Secure on https, and cookies
 * that expire with the refresh token instead of Amplify's default 365 days.
 *
 * Runs at module load, before any component's effect: child effects run before parents', so a
 * configure-in-useEffect would let the sign-in screen call Amplify unconfigured.
 */
import { configureAuthClient } from 'auth-kit/client';
import { amplifyOutputs } from '@/lib/outputs';
import { refreshTokenMinutes } from '@/lib/session';

configureAuthClient(amplifyOutputs, { refreshTokenMinutes });

export function AmplifyClient() {
  return null;
}
