/**
 * Sign in (always public). auth-kit's `SignIn`: passkey first, "Use a password instead" (password,
 * then the authenticator code), "Email me a code instead". It handles every step these pools
 * return, then sends password users without an authenticator to set one up, offers a passkey once,
 * and returns through `safeRedirect` (same-site paths only). `?reauth=1` is step-up: a risky action
 * asked for a fresh sign-in.
 *
 * The card sits on the site's backdrop (components/auth-scene.tsx); the email field's placeholder is
 * the site's email hint (site.config.ts `emailHint`, else the family's).
 */
import { SignIn } from 'auth-kit/client';
import type { Metadata } from 'next';
import { AuthScene } from '@/components/auth-scene';
import { site } from '@/site.config';
import { emailHintFor } from '@/site.families';

export const metadata: Metadata = { title: 'Sign in' };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string | string[]; reauth?: string }> }) {
  const { next, reauth } = await searchParams;
  return (
    <AuthScene>
      <SignIn
        siteName={site.name}
        passkeysEnabled={site.passkeys !== false}
        emailHint={emailHintFor(site)}
        next={typeof next === 'string' ? next : null}
        reauth={reauth === '1'}
        lostAuthenticatorHelp={<>Lost your authenticator? Ask an admin of {site.name} to reset it.</>}
      />
    </AuthScene>
  );
}
