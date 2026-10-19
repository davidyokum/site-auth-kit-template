import { normalizeOptions, SESSION_POLICY } from 'auth-kit/amplify';
import { describe, expect, it } from 'vitest';
import { authOptions } from '@/amplify/auth/resource';
import { refreshTokenMinutes } from '@/lib/session';
import { site } from '@/site.config';
import { helpAddressFor, senderAddressFor } from '@/site.families';

describe('the pool settings (amplify/auth/resource.ts) and the app agree', () => {
  const pool = normalizeOptions(authOptions);

  it('the preset accepts the site config (a typo fails here, not at deploy)', () => {
    expect(pool.project).toBe(site.project);
    expect(pool.email.fromAddress).toBe(senderAddressFor(site));
    expect(pool.email.family).toBe(site.family);
    expect(pool.email.replyTo).toBe(helpAddressFor(site));
    expect(pool.groups.slice(0, 5)).toEqual(['owner', 'superadmin', 'admin-content-people', 'admin-content', 'admin-view']);
  });

  it('token cookies expire with the refresh token the pool actually issues', () => {
    expect(refreshTokenMinutes).toBe(pool.refreshTokenMinutes);
    expect(refreshTokenMinutes).toBeLessThanOrEqual(SESSION_POLICY.refreshTokenMinutesMax[pool.tier]);
  });

  it('rate-limits sign-in (WAF is on unless deliberately acknowledged off)', () => {
    expect(pool.waf.mode).not.toBe('off');
  });

  it('the created web ACL counts sign-in attempts first and blocks the overall per-IP rule from day one (auth-kit ADR 0017)', () => {
    // A site on the account's shared ACL (deploy.config.json webAcl) sets the modes where that ACL is created.
    if (pool.waf.mode !== 'create') return;
    expect({ signInRule: pool.waf.signInRule, overallRule: pool.waf.overallRule }).toEqual({ signInRule: 'count', overallRule: 'block' });
  });

  it('takes the code lifetime and the account-creation mode from site.config.ts (register A7: 10 minutes)', () => {
    expect(pool.codeLifetimeMinutes).toBe(site.codeLifetimeMinutes);
    expect(site.codeLifetimeMinutes).toBe(10);
  });

  it('passkeys wait for the final domain (off until site.config sets a relying party)', () => {
    expect(pool.passkeys === null).toBe(site.passkeys === false);
  });
});
