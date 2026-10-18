/** `npm run waf:smoke` (scripts/waf-smoke-test.mjs): what it sends, and how it reads the answer. No network here. */
import { describe, expect, it } from 'vitest';
import { smokeRequest, smokeVerdict } from '@/scripts/lib/waf-smoke.mjs';

describe('the WAF smoke test', () => {
  it('posts to the sign-up route from the site’s own origin, with no token', () => {
    const { url, init } = smokeRequest('https://www.example.org/some/page');
    expect(url).toBe('https://www.example.org/api/auth/sign-up');
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('origin')).toBe('https://www.example.org');
    expect(new Headers(init.headers).get('cookie')).toBeNull();
    expect(() => smokeRequest('http://www.example.org')).toThrow(/https/);
  });

  it('passes only on AWS WAF’s challenge', () => {
    expect(smokeVerdict(202, new Headers({ 'x-amzn-waf-action': 'challenge' })).ok).toBe(true);
    expect(smokeVerdict(503, new Headers()).message).toMatch(/isn't associated with the Amplify app/);
    expect(smokeVerdict(200, new Headers()).ok).toBe(false);
    expect(smokeVerdict(404, new Headers()).message).toMatch(/takes no sign-ups/);
  });
});
