/**
 * Settings (Super admins and the owner: `settings.security`, read live). Today one setting:
 * "Sign-in help" (auth-kit's `SignInHelpSettings`; ADR 0024), the help address the sign-in card's help
 * screens and every email name, changed without a deploy. It stays on the configured address's domain
 * (or the family's), needs a recent sign-in and a reason, is audited, and emails the owner and every
 * Super admin; if that email can't be sent, the change is undone. "Use the configured address" goes
 * back to site.config.ts's. A setting that can't be read shows "—" and why.
 */
import { SignInHelpSettings } from 'auth-kit/admin/ui';
import type { Metadata } from 'next';
import { signInHelpActions } from '@/lib/accounts';
import { stepUpHref } from '@/lib/admin';
import { pages } from '@/lib/auth';
import { clearSignInHelp, setSignInHelp } from './actions';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  await pages.requireCan('settings.security', { live: true });
  const view = await signInHelpActions().get();
  return (
    <div className="stack">
      <h1>Settings</h1>
      <SignInHelpSettings view={view} actions={{ set: setSignInHelp, clear: clearSignInHelp }} stepUpHref={stepUpHref('/admin/settings')} />
    </div>
  );
}
