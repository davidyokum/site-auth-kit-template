/**
 * AWS WAF's JavaScript integration (site.config.ts `siteWaf.integrationUrl`), on the pages that post
 * to the sign-up and request routes. The site web ACL challenges those posts silently; with this
 * script loaded, auth-kit's screens send through `window.AwsWafIntegration.fetch`, which carries the
 * challenge's token (auth-kit ADR 0023). Nothing without `siteWaf`.
 *
 * It carries the request's CSP nonce (proxy.ts puts it in `x-nonce`), so the strict policy lets it
 * run, and lib/security-headers.ts lets it reach its own host.
 */
import { headers } from 'next/headers';
import Script from 'next/script';
import { site } from '@/site.config';

export async function WafIntegration() {
  if (site.siteWaf === null) return null;
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return <Script src={site.siteWaf.integrationUrl} strategy="afterInteractive" nonce={nonce} />;
}
