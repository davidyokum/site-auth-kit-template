'use client';
/**
 * Function props (`onDone`) can't cross from a server component, so this small client wrapper
 * renders auth-kit's `AuthenticatorSetup` and decides where to go afterwards.
 */
import { AuthenticatorSetup } from 'auth-kit/client';

export function AuthenticatorSetupPanel({ issuer }: { issuer: string }) {
  // A full page load, so the server sees the session with its new authenticator.
  return <AuthenticatorSetup issuer={issuer} onDone={() => window.location.assign('/app')} />;
}
