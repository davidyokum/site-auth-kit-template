/**
 * Settings & Emails (`settings.security`, checked live): Sign-in help override, pure-DOM outgoing
 * Email Studio, and editable Invitation welcome paragraph.
 */
import { SignInHelpSettings } from 'auth-kit/admin/ui';
import type { Metadata } from 'next';
import { SettingsEmailsWorkspace } from '@/components/admin/settings-emails-workspace';
import { effectiveHelp, signInHelpActions } from '@/lib/accounts';
import { stepUpHref } from '@/lib/admin';
import { buildEmailPreviewCatalog, inviteWelcomeStore } from '@/lib/admin-stores';
import { pages } from '@/lib/auth';
import { publicOrigin } from '@/lib/origin';
import { site } from '@/site.config';
import { clearSignInHelp, saveInviteWelcome, setSignInHelp } from './actions';

export const metadata: Metadata = { title: 'Settings & Emails' };

export default async function SettingsPage() {
  await pages.requireCan('settings.security', { live: true });
  const [view, help, welcome] = await Promise.all([
    signInHelpActions().get(),
    effectiveHelp(),
    inviteWelcomeStore().get().catch(() => ({ note: null, version: 0, updatedAt: null })),
  ]);
  const reauth = stepUpHref('/admin/settings');
  const emails = buildEmailPreviewCatalog({
    siteName: site.name,
    helpEmail: help.address,
    signInUrl: `${publicOrigin()}/sign-in`,
    welcomeNote: welcome.note,
  });

  return (
    <SettingsEmailsWorkspace
      signInHelpNode={
        <SignInHelpSettings
          view={view}
          actions={{ set: setSignInHelp, clear: clearSignInHelp }}
          stepUpHref={reauth}
        />
      }
      emails={emails}
      welcomeNote={welcome.note}
      welcomeVersion={welcome.version}
      saveWelcomeAction={saveInviteWelcome}
      stepUpHref={reauth}
    />
  );
}
