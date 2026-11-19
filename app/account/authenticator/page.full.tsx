/**
 * Authenticator setup: where password users without an authenticator code are sent (the page
 * guards' `mfaSetupPath`). The standard requires one of every password user; `requireUser` refuses
 * them everywhere else (403 `mfa_enrollment_required`), so this is the one page that lets them in.
 */
import type { Metadata } from 'next';
import { pages } from '@/lib/auth';
import { site } from '@/site.config';
import { AuthenticatorSetupPanel } from './setup-panel';

export const metadata: Metadata = { title: 'Set up your authenticator' };

export default async function AuthenticatorPage() {
  await pages.requireUser({ allowMfaEnrollment: true });
  return <AuthenticatorSetupPanel issuer={site.name} />;
}
