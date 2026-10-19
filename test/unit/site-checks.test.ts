/**
 * lib/site-checks.ts: what site.config.ts must hold. `next dev` and every build stop on a problem
 * (next.config.ts), so these are the messages people see.
 */
import { describe, expect, it } from 'vitest';
import { type CheckedSite, assertSiteConfig, requiredPrivacyNotice, siteConfigProblems } from '@/lib/site-checks';
import { site } from '@/site.config';

const base: CheckedSite = {
  name: 'Example Site',
  family: 'personal',
  email: { fromAddress: null, replyTo: null },
  accountCreation: { mode: 'invite' },
  codeLifetimeMinutes: 10,
  privacyNoticeUrl: null,
  termsUrl: null,
  siteWaf: null,
};
const waf = { webAclArn: 'arn:aws:wafv2:us-east-1:111122223333:global/webacl/auth-kit-site-routes/00000000-0000-4000-8000-000000000000', integrationUrl: 'https://abcd1234.edge.sdk.awswaf.com/abcd1234/efgh5678/challenge.js' };

describe('site.config.ts checks (lib/site-checks.ts)', () => {
  it('pass for this site', () => {
    expect(siteConfigProblems(site)).toEqual([]);
    expect(() => assertSiteConfig(site)).not.toThrow();
  });

  it('need a help address auth-kit accepts: a work site without one, a placeholder, a person’s own address unless acknowledged (register E4c)', () => {
    const work = { ...base, family: 'unc' as const, email: { fromAddress: 'sign-in@reports.example.org', replyTo: null } };
    expect(siteConfigProblems(work).join(' ')).toMatch(/needs a help address/);
    expect(siteConfigProblems({ ...base, email: { replyTo: 'apps-help@replace-me.invalid' } }).join(' ')).toMatch(/placeholder/);
    expect(siteConfigProblems({ ...base, email: { replyTo: 'jordan.lee@example.org' } }).join(' ')).toMatch(/person's own address/);
    expect(siteConfigProblems({ ...base, email: { replyTo: { address: 'Jordan.Lee@example.org', personal: true } } })).toEqual([]);
    expect(siteConfigProblems({ ...base, email: { replyTo: { address: 'jordan.lee@example.org', personal: false as unknown as true } } }).join(' ')).toMatch(/personal: true/);
    expect(siteConfigProblems({ ...work, email: { ...work.email, replyTo: 'reports-help@example.org' } })).toEqual([]);
  });

  it('need a reply-able sign-in@ sender: the site’s own, or its family’s; personal sites only sign-in@yokum.app (register A10, F11)', () => {
    const work = { ...base, family: 'unc' as const, email: { replyTo: 'reports-help@example.org' } };
    expect(siteConfigProblems(work).join(' ')).toMatch(/needs a sender[\s\S]*email\.fromAddress/);
    expect(siteConfigProblems({ ...work, email: { ...work.email, fromAddress: 'noreply@example.org' } }).join(' ')).toMatch(/can't be replied to/);
    expect(siteConfigProblems({ ...work, email: { ...work.email, fromAddress: 'reports@example.org' } }).join(' ')).toMatch(/sign-in@ mailbox/);
    expect(siteConfigProblems({ ...work, email: { ...work.email, fromAddress: 'Sign-In@Reports.Example.org' } })).toEqual([]);
    expect(siteConfigProblems({ ...base, email: { fromAddress: 'sign-in@reports.example.org' } }).join(' ')).toMatch(/Personal family's sender/);
    expect(siteConfigProblems({ ...base, email: { fromAddress: 'sign-in@yokum.app' } })).toEqual([]);
  });

  it('take a site name outside ASCII (auth-kit encodes it for SES) and need a known card style (register E5)', () => {
    expect(siteConfigProblems({ ...base, name: 'Café Reports' })).toEqual([]);
    for (const cardStyle of ['quiet', 'monogram', 'frosted', 'plain', 'porcelain'] as const) expect(siteConfigProblems({ ...base, cardStyle })).toEqual([]);
    expect(siteConfigProblems({ ...base, cardStyle: 'glossy' as never }).join(' ')).toMatch(/cardStyle must be one of/);
  });

  it('need what each mode needs: a domain list, a privacy notice and the site web ACL on sign-up sites (register D3)', () => {
    expect(siteConfigProblems({ ...base, accountCreation: { mode: 'domains' } }).join(' ')).toMatch(/needs a domain list/);
    expect(siteConfigProblems({ ...base, accountCreation: { mode: 'domains', domains: ['example.org'] } }).join(' ')).toMatch(/privacy notice/);
    expect(siteConfigProblems({ ...base, accountCreation: { mode: 'domains', domains: ['example.org'] }, privacyNoticeUrl: '/privacy' }).join(' ')).toMatch(/siteWaf: a sign-up site \('domains'\)/);
    expect(siteConfigProblems({ ...base, accountCreation: { mode: 'domains', domains: ['example.org'] }, privacyNoticeUrl: '/privacy', siteWaf: waf })).toEqual([]);
    expect(siteConfigProblems({ ...base, accountCreation: { mode: 'open' }, privacyNoticeUrl: '/privacy' }).join(' ')).toMatch(/siteWaf/);
    expect(siteConfigProblems({ ...base, accountCreation: { mode: 'open' }, privacyNoticeUrl: '/privacy', siteWaf: waf })).toEqual([]);
    expect(siteConfigProblems({ ...base, accountCreation: { mode: 'request' } })).toEqual([]);
    expect(siteConfigProblems({ ...base, accountCreation: { mode: 'invite', domains: ['example.org'] } }).join(' ')).toMatch(/apply only to 'domains'/);
  });

  it('check the web ACL, its integration, links, and the code lifetime', () => {
    expect(siteConfigProblems({ ...base, siteWaf: { ...waf, webAclArn: 'arn:aws:wafv2:us-east-1:111122223333:regional/webacl/x/00000000-0000-4000-8000-000000000000' } }).join(' ')).toMatch(/CLOUDFRONT/);
    expect(siteConfigProblems({ ...base, siteWaf: { ...waf, integrationUrl: 'https://evil.example.org/challenge.js' } }).join(' ')).toMatch(/JavaScript integration/);
    expect(siteConfigProblems({ ...base, privacyNoticeUrl: 'javascript:alert(1)' }).join(' ')).toMatch(/site path/);
    expect(siteConfigProblems({ ...base, termsUrl: 'http://example.org/terms' }).join(' ')).toMatch(/https URL/);
    expect(siteConfigProblems({ ...base, codeLifetimeMinutes: 2 }).join(' ')).toMatch(/3 to 15/);
  });

  it('name the privacy notice a sign-up screen needs', () => {
    expect(requiredPrivacyNotice({ privacyNoticeUrl: '/privacy' })).toBe('/privacy');
    expect(() => requiredPrivacyNotice({ privacyNoticeUrl: null })).toThrow(/privacy notice/);
  });
});
