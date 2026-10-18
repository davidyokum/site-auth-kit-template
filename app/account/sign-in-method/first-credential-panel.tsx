'use client';
/**
 * Function props (`onDone`) can't cross from a server component, so this small client wrapper
 * renders auth-kit's `ChooseFirstCredential` and decides where to go afterwards. Inside the site's
 * card (`AuthCard`), on the backdrop.
 */
import { AuthCard, ChooseFirstCredential } from 'auth-kit/client';
import { siteTheme } from '@/lib/theme';
import { site } from '@/site.config';

export function FirstCredentialPanel({ issuer, passkeysEnabled, accountName }: { issuer: string; passkeysEnabled: boolean; accountName: string | null }) {
  return (
    <AuthCard name="site-message" theme={siteTheme(site)} classNames={undefined}>
      <ChooseFirstCredential
        issuer={issuer}
        passkeysEnabled={passkeysEnabled}
        {...(accountName !== null && { accountName })}
        // A full page load, not a client navigation: the server must re-read the account's new way in.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        onDone={() => window.location.assign('/app')}
      />
    </AuthCard>
  );
}
