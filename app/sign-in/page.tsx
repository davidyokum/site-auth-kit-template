/**
 * Sign in (always public). auth-kit's `SignIn`: passkey first, "Use a password instead" (password,
 * then the authenticator code), "Email me a code instead". It handles every step these pools
 * return, then sends password users without an authenticator to set one up, offers a passkey once,
 * and returns through `safeRedirect` (same-site paths only). `?reauth=1` is step-up: a risky action
 * asked for a fresh sign-in.
 */
import { SignIn } from 'auth-kit/client';
import type { Metadata } from 'next';
import { site } from '@/site.config';

export const metadata: Metadata = { title: 'Sign in' };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string | string[]; reauth?: string }> }) {
  const { next, reauth } = await searchParams;
  return (
    <SignIn
      siteName={site.name}
      passkeysEnabled={site.passkeys !== false}
      next={typeof next === 'string' ? next : null}
      reauth={reauth === '1'}
      lostAuthenticatorHelp={<>Lost your authenticator? Ask an admin of {site.name} to reset it.</>}
    />
  );
}
