'use client';
/**
 * Function props (`onDone`, `onCancel`) can't cross from a server component, so this small client
 * wrapper renders auth-kit's `AuthenticatorSetup` inside the site's card (`AuthCard`) and decides where
 * to go afterwards.
 *
 * The way out is "Sign out everywhere" (03 §2 Sessions: sign-out is global, and labeled so). Setup
 * stays required: the next sign-in comes back here until the authenticator is on.
 */
import { AuthCard, AuthenticatorSetup, MY_ACCOUNT, signOutEverywhere } from 'auth-kit/client';
import { signOut } from 'aws-amplify/auth';
import { siteTheme } from '@/lib/theme';
import { site } from '@/site.config';

export function AuthenticatorSetupPanel({ issuer, accountName }: { issuer: string; accountName: string | null }) {
  return (
    <AuthCard name="site-message" theme={siteTheme(site)} classNames={undefined}>
      <AuthenticatorSetup
        issuer={issuer}
        {...(accountName !== null && { accountName })}
        intro={MY_ACCOUNT.gateIntro(issuer)}
        // A full page load, not a client navigation: the server must re-read the session with its new authenticator.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        onDone={() => window.location.assign('/app')}
        onCancel={() => {
          // If the global sign-out can't reach Cognito, this browser's session still ends (a local
          // sign-out needs no network), so the way out always works.
          void signOutEverywhere()
            .catch(() => signOut().catch(() => undefined))
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination
            .finally(() => window.location.assign('/signed-out'));
        }}
        cancelLabel={MY_ACCOUNT.signOut}
      />
    </AuthCard>
  );
}
