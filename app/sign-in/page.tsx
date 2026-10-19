/**
 * Sign in (always public). auth-kit's `SignIn` is the whole card, in the approved words (ADR 0024):
 * email first, then "Use your passkey" (or, before passkeys are on, "Enter your password"), with "Use
 * a password instead" and "Email me a code instead" always offered; "Trouble signing in?" and its
 * help screens; the line saying how this site gives out accounts (`accountCreation`); and the family's
 * footer. It handles every step these pools return, then sends a password user without an
 * authenticator to set one up, requires the first credential after an invite or a sign-up, and
 * returns through `safeRedirect` (same-site paths only). `?reauth=1` is step-up.
 *
 * The help address is read here, on the server, on every request, so a Super admin's override
 * (Admin → Settings → "Sign-in help") shows at once. The card sits on the site's backdrop.
 */
import { SignIn } from 'auth-kit/client';
import type { Metadata } from 'next';
import { AuthScene } from '@/components/auth-scene';
import { effectiveHelp } from '@/lib/accounts';
import { passkeyPrompt } from '@/lib/passkeys';
import { signInHelpProp, siteTheme } from '@/lib/theme';
import { site } from '@/site.config';

export const metadata: Metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string | string[]; reauth?: string }> }) {
  const { next, reauth } = await searchParams;
  const help = await effectiveHelp();
  const passkey = passkeyPrompt();
  return (
    <AuthScene>
      <SignIn
        siteName={site.name}
        theme={siteTheme(site)}
        help={signInHelpProp(site, help.address)}
        passkeysEnabled={site.passkeys !== false}
        {...(passkey && { passkey })}
        accountCreation={site.accountCreation}
        codeLifetimeMinutes={site.codeLifetimeMinutes}
        // The account-change notice route is mounted (app/api/auth-kit/account-notice), so "Forgot your
        // password?" may promise "We'll email you a note when your password changes." (register A10).
        notices={{ mounted: true }}
        next={typeof next === 'string' ? next : null}
        reauth={reauth === '1'}
      />
    </AuthScene>
  );
}
