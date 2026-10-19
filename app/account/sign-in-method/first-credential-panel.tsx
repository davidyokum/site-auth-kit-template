'use client';
/**
 * Function props (`onDone`) can't cross from a server component, so this small client wrapper
 * renders auth-kit's `ChooseFirstCredential` and decides where to go afterwards. Inside the site's
 * card (`AuthCard`), on the backdrop.
 *
 * Like `SignIn`'s own chooser step, it asks for the account-change notice once the first passkey or
 * password is saved ("A passkey was added to your account", "Your password was changed"; register A10),
 * at auth-kit's `ACCOUNT_NOTICE_PATH` (app/api/auth-kit/account-notice). A notice that can't be sent
 * never holds the person up. (auth-kit keeps its passkey hint to itself, so a passkey made here opens
 * "How do you want to sign in?" once; the first passkey sign-in then sets the hint, register A5a.)
 */
import { ACCOUNT_NOTICE_PATH, AuthCard, ChooseFirstCredential, sendAccountNotice } from 'auth-kit/client';
import { siteTheme } from '@/lib/theme';
import { site } from '@/site.config';

export function FirstCredentialPanel({ issuer, passkeysEnabled, accountName }: { issuer: string; passkeysEnabled: boolean; accountName: string | null }) {
  return (
    <AuthCard name="site-message" theme={siteTheme(site)} classNames={undefined}>
      <ChooseFirstCredential
        issuer={issuer}
        passkeysEnabled={passkeysEnabled}
        {...(accountName !== null && { accountName })}
        onDone={(how) => {
          // The notice never throws and gives up after 5 seconds. Then a full page load, not a client
          // navigation: the server must re-read the account's new way in.
          void sendAccountNotice({ url: ACCOUNT_NOTICE_PATH }, how === 'password' ? 'password-changed' : 'passkey-added').then(() =>
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination
            window.location.assign('/app'),
          );
        }}
      />
    </AuthCard>
  );
}
