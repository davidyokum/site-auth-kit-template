/**
 * Create your account (auth-kit's `SignUp`; register D1–D4, ADR 0023). Only on sign-up sites
 * (site.config.ts `accountCreation`: 'domains' or 'open'): the `.signup.tsx` extension makes this a
 * page only there (next.config.ts, lib/account-modes.ts), so invite-only and request sites don't have it.
 *
 * The address (and, in 'domains' mode, the domain list), the privacy notice, the sign-up route (the
 * same answer for every address), the emailed code, "Your name", the required "Choose how you'll sign
 * in next time", then "You're set up" as a Member. An address that already has an account gets an
 * email instead of a different screen. Public (lib/public-routes.ts).
 */
import { SignUp } from 'auth-kit/client';
import type { Metadata } from 'next';
import { AuthScene } from '@/components/auth-scene';
import { WafIntegration } from '@/components/waf-integration';
import { effectiveHelp } from '@/lib/accounts';
import { signInHelpProp, siteTheme } from '@/lib/theme';
import { requiredPrivacyNotice } from '@/lib/site-checks';
import { site } from '@/site.config';

export const metadata: Metadata = { title: 'Create your account' };
export const dynamic = 'force-dynamic';

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams;
  const help = await effectiveHelp();
  return (
    <AuthScene>
      <WafIntegration />
      <SignUp
        siteName={site.name}
        theme={siteTheme(site)}
        help={signInHelpProp(site, help.address)}
        accountCreation={site.accountCreation}
        privacyNoticeUrl={requiredPrivacyNotice(site)}
        {...(site.termsUrl !== null && { termsUrl: site.termsUrl })}
        passkeysEnabled={site.passkeys !== false}
        codeLifetimeMinutes={site.codeLifetimeMinutes}
        next={typeof next === 'string' ? next : null}
      />
    </AuthScene>
  );
}
