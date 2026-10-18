/**
 * "You're signed out everywhere" (auth-kit's `SignedOutEverywhere`, Card Studio v4): where My account's
 * "Sign out everywhere" lands. Public, and it shows nothing about anyone: it's the same page for
 * everybody, with a link back to sign in.
 */
import { SignedOutEverywhere } from 'auth-kit/client';
import type { Metadata } from 'next';
import { AuthScene } from '@/components/auth-scene';
import { siteTheme } from '@/lib/theme';
import { site } from '@/site.config';

export const metadata: Metadata = { title: 'Signed out' };

export default function SignedOutPage() {
  return (
    <AuthScene>
      <SignedOutEverywhere siteName={site.name} theme={siteTheme(site)} />
    </AuthScene>
  );
}
