/**
 * Content-Security-Policy and the other security headers (03 §2 Sessions: "a strict
 * Content-Security-Policy is set, because the standard tokens are script-readable").
 *
 * Amplify keeps tokens in cookies page scripts can read (Amplify's browser code needs them), so an
 * injected script could take a session. The CSP is what stops one from running:
 *
 * - **Per request, from proxy.ts**: the full policy with a fresh nonce (auth-kit's `nonceCspHeaders`
 *   makes the nonce, 128 random bits, and puts the policy on the request and on every response).
 *   `script-src` allows only scripts carrying that nonce (`'strict-dynamic'` lets them load their
 *   own chunks), so no inline script an attacker manages to inject can run. Next.js reads the nonce
 *   from the request's CSP header and puts it on its own scripts, which needs every page rendered
 *   per request (the root layout calls `connection()`).
 *   See node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md.
 * - **On every response, from next.config.ts**: the static headers below plus a baseline CSP with
 *   the directives that need no nonce (framing, plugins, base URI, form targets). On responses the
 *   proxy handles, its full policy replaces the baseline (same header name; it contains every
 *   baseline directive). The baseline is what covers paths the proxy's matcher skips, such as
 *   /_next/static/* assets.
 *
 * Plain module with no path aliases: next.config.ts imports it.
 */

export interface CspInput {
  /** This request's nonce, from auth-kit's `nonceCspHeaders` (base64, at least 96 bits). */
  nonce: string;
  /** `next dev` adds what React's dev tooling needs ('unsafe-eval', inline styles) and drops the https upgrade. */
  dev: boolean;
  /** The pool's region: the browser calls Cognito directly. */
  region: string;
}

function serialize(directives: Record<string, readonly string[]>): string {
  return Object.entries(directives)
    .map(([name, values]) => (values.length > 0 ? `${name} ${values.join(' ')}` : name))
    .join('; ');
}

/** The full per-request policy. */
export function contentSecurityPolicy({ nonce, dev, region }: CspInput): string {
  if (!/^[A-Za-z0-9+/]{16,}={0,2}$/.test(nonce)) throw new Error('CSP nonce must be base64 with at least 96 bits.');
  if (!/^[a-z]{2}(?:-[a-z]+)+-\d$/.test(region)) throw new Error(`CSP region "${region}" isn't an AWS Region.`);
  return serialize({
    'default-src': ["'self'"],
    'script-src': ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(dev ? ["'unsafe-eval'"] : [])],
    'style-src': ["'self'", ...(dev ? ["'unsafe-inline'"] : [`'nonce-${nonce}'`])],
    // React's style={...} props render as style attributes (auth-kit's ribbon and banner use them).
    // An attribute can't run script; inline <style> elements still need the nonce.
    'style-src-attr': ["'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:'],
    'font-src': ["'self'"],
    // Amplify's sign-in calls go from the browser to Cognito (user pools, and identity pools for
    // AWS credentials); auth-kit checks new passwords against Have I Been Pwned (k-anonymity range API).
    'connect-src': ["'self'", `https://cognito-idp.${region}.amazonaws.com`, `https://cognito-identity.${region}.amazonaws.com`, 'https://api.pwnedpasswords.com'],
    'object-src': ["'none'"],
    'base-uri': ["'none'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'frame-src': ["'none'"],
    'worker-src': ["'self'"],
    'manifest-src': ["'self'"],
    ...(dev ? {} : { 'upgrade-insecure-requests': [] }),
  });
}

/** The nonce-free directives, sent on every response from next.config.ts. */
export const BASELINE_CSP = serialize({
  'object-src': ["'none'"],
  'base-uri': ["'none'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'none'"],
});

/** Static headers for next.config.ts `headers()`. */
export function staticSecurityHeaders({ dev }: { dev: boolean }): { key: string; value: string }[] {
  return [
    { key: 'Content-Security-Policy', value: BASELINE_CSP },
    // HTTPS only, for two years, subdomains included. (Browsers ignore it on http://*.localhost.)
    ...(dev ? [] : [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]),
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    // Features this site doesn't use are off. Passkeys (publickey-credentials-*) stay with this origin.
    {
      key: 'Permissions-Policy',
      value:
        'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), hid=(), bluetooth=(), browsing-topics=(), ' +
        'publickey-credentials-get=(self), publickey-credentials-create=(self)',
    },
  ];
}
