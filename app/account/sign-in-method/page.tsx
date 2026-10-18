/**
 * "Choose how you'll sign in next time" (auth-kit's `ChooseFirstCredential`; register A1, ADR 0024):
 * a passkey, or a password followed by an authenticator app. It's required: there's no "Not now",
 * because an account left on emailed codes would make the backstop its everyday way in.
 *
 * The server enforces it. `requireUser` refuses an account with neither a passkey nor a password
 * (403 `first_credential_required`) everywhere else, and page guards send it here (auth-kit's
 * `firstCredentialPath`, default this path). This is the one page that lets it in
 * (`allowFirstCredentialEnrollment`). Invitees and new sign-ups land here after their first emailed
 * code; closing the tab or reloading can't skip it.
 */
import type { Metadata } from 'next';
import { AuthScene } from '@/components/auth-scene';
import { pages } from '@/lib/auth';
import { site } from '@/site.config';
import { FirstCredentialPanel } from './first-credential-panel';

export const metadata: Metadata = { title: 'Choose how you’ll sign in' };

export default async function SignInMethodPage() {
  const user = await pages.requireUser({ allowFirstCredentialEnrollment: true });
  return (
    <AuthScene>
      <FirstCredentialPanel issuer={site.name} passkeysEnabled={site.passkeys !== false} accountName={user.profile?.email ?? null} />
    </AuthScene>
  );
}
