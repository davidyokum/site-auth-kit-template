'use client';
/**
 * Function props (`onDone`) can't cross from a server component, so this small client wrapper
 * renders auth-kit's `AuthenticatorSetup` and decides where to go afterwards.
 */
import { AuthenticatorSetup } from 'auth-kit/client';

export function AuthenticatorSetupPanel({ issuer }: { issuer: string }) {
  return (
    <AuthenticatorSetup
      issuer={issuer}
      // A full page load, not a client navigation: the server must re-read the session with its new authenticator.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      onDone={() => window.location.assign('/app')}
    />
  );
}
