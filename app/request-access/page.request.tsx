/**
 * Request access (auth-kit's `RequestAccess`; register D1, D3, ADR 0023). Only on request sites
 * (site.config.ts `accountCreation`: 'request', or 'domains' with `requestsAlso`): the `.request.tsx`
 * extension makes this a page only there (next.config.ts, lib/account-modes.ts).
 *
 * Name, email, and an optional reason, then "Request sent", the same for every address: a new one
 * becomes a request on the People page's "Pending requests" tab, never a Cognito user, and an address
 * that already has an account gets an email instead. Public (lib/public-routes.ts).
 */
import { RequestAccess } from 'auth-kit/client';
import type { Metadata } from 'next';
import { AuthScene } from '@/components/auth-scene';
import { WafIntegration } from '@/components/waf-integration';
import { effectiveHelp } from '@/lib/accounts';
import { signInHelpProp, siteTheme } from '@/lib/theme';
import { site } from '@/site.config';

export const metadata: Metadata = { title: 'Request access' };
export const dynamic = 'force-dynamic';

export default async function RequestAccessPage() {
  const help = await effectiveHelp();
  return (
    <AuthScene>
      <WafIntegration />
      <RequestAccess
        siteName={site.name}
        theme={siteTheme(site)}
        help={signInHelpProp(site, help.address)}
        {...(site.privacyNoticeUrl !== null && { privacyNoticeUrl: site.privacyNoticeUrl })}
      />
    </AuthScene>
  );
}
