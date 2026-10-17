import { describe, expect, it } from 'vitest';
import { BASELINE_CSP, contentSecurityPolicy, newNonce, staticSecurityHeaders } from '@/lib/security-headers';

const directive = (csp: string, name: string) =>
  csp
    .split(';')
    .map((d) => d.trim())
    .find((d) => d === name || d.startsWith(`${name} `));

describe('the per-request Content-Security-Policy', () => {
  const nonce = newNonce();
  const prod = contentSecurityPolicy({ nonce, dev: false, region: 'us-east-1' });
  const dev = contentSecurityPolicy({ nonce, dev: true, region: 'us-east-1' });

  it('runs only scripts carrying this request’s nonce (no unsafe-inline, no unsafe-eval in production)', () => {
    const scripts = directive(prod, 'script-src') ?? '';
    expect(scripts).toContain(`'nonce-${nonce}'`);
    expect(scripts).toContain("'strict-dynamic'");
    expect(scripts).not.toContain("'unsafe-inline'");
    expect(scripts).not.toContain("'unsafe-eval'");
    expect(scripts).not.toMatch(/https?:|\*/);
  });

  it('adds unsafe-eval only under next dev (React’s dev tooling), and drops the https upgrade there', () => {
    expect(directive(dev, 'script-src')).toContain("'unsafe-eval'");
    expect(directive(dev, 'upgrade-insecure-requests')).toBeUndefined();
    expect(directive(prod, 'upgrade-insecure-requests')).toBe('upgrade-insecure-requests');
  });

  it('allows inline <style> only with the nonce in production; style attributes (React style props) stay allowed', () => {
    expect(directive(prod, 'style-src')).toBe(`style-src 'self' 'nonce-${nonce}'`);
    expect(directive(prod, 'style-src-attr')).toBe("style-src-attr 'unsafe-inline'");
  });

  it('can’t be framed, has no plugins or base-URI tricks, and posts forms only to itself', () => {
    expect(directive(prod, 'frame-ancestors')).toBe("frame-ancestors 'none'");
    expect(directive(prod, 'object-src')).toBe("object-src 'none'");
    expect(directive(prod, 'base-uri')).toBe("base-uri 'none'");
    expect(directive(prod, 'form-action')).toBe("form-action 'self'");
  });

  it('lets the browser reach exactly Cognito (this region) and the breached-password check', () => {
    expect(directive(prod, 'connect-src')).toBe(
      "connect-src 'self' https://cognito-idp.us-east-1.amazonaws.com https://cognito-identity.us-east-1.amazonaws.com https://api.pwnedpasswords.com",
    );
  });

  it('makes a fresh 128-bit nonce each time, and refuses a weak one or a bad region', () => {
    const nonces = new Set(Array.from({ length: 50 }, newNonce));
    expect(nonces.size).toBe(50);
    expect(atob(newNonce()).length).toBe(16);
    expect(() => contentSecurityPolicy({ nonce: 'abc', dev: false, region: 'us-east-1' })).toThrow(/nonce/);
    expect(() => contentSecurityPolicy({ nonce, dev: false, region: "us-east-1; script-src *" })).toThrow(/Region/);
  });
});

describe('the static headers (next.config.ts)', () => {
  const headers = (dev: boolean) => Object.fromEntries(staticSecurityHeaders({ dev }).map((h) => [h.key, h.value]));

  it('sends a baseline CSP with the directives that need no nonce', () => {
    expect(headers(false)['Content-Security-Policy']).toBe(BASELINE_CSP);
    expect(BASELINE_CSP).toContain("frame-ancestors 'none'");
    expect(BASELINE_CSP).not.toContain('script-src');
  });

  it('sends HSTS in production builds only, plus nosniff, DENY framing, and a strict referrer policy', () => {
    expect(headers(false)['Strict-Transport-Security']).toMatch(/max-age=\d{8}/);
    expect(headers(true)['Strict-Transport-Security']).toBeUndefined();
    expect(headers(false)['X-Content-Type-Options']).toBe('nosniff');
    expect(headers(false)['X-Frame-Options']).toBe('DENY');
    expect(headers(false)['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
  });

  it('keeps passkeys working for this origin while turning off unused features', () => {
    const policy = headers(false)['Permissions-Policy'] ?? '';
    expect(policy).toContain('publickey-credentials-get=(self)');
    expect(policy).toContain('camera=()');
  });
});
