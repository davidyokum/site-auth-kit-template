/**
 * The families (site.families.ts) and this site's theme (lib/theme.ts). Since auth-kit 0.1.8 the
 * families are auth-kit themes (ADR 0024): the sender name, the footer identity line on the card and
 * every email, the email hint, the help route, and the card's style come from there. The table here
 * holds the addresses a family's sites share (registers A10, E4c, F11): the sender and the help
 * mailbox, the same ones auth-kit 0.1.9's themes carry. This file and the table are the two the
 * hygiene test lets name an employer, by exact path (test/unit/hygiene.test.ts).
 */
import { FAMILY_THEMES, helpAddressProblems, senderAddressProblems, senderDisplayName } from 'auth-kit/themes';
import { describe, expect, it } from 'vitest';
import { signInHelpProp, siteTheme } from '@/lib/theme';
import { site } from '@/site.config';
import {
  FAMILY_HELP_MAILBOX,
  FAMILY_NAMES_OWNER,
  FAMILY_SENDER,
  type FamilySite,
  helpAddressFor,
  helpSettingFor,
  senderAddressFor,
  type SiteHelpAddress,
  SITE_FAMILIES,
} from '@/site.families';

const make = (family: FamilySite['family'], replyTo: SiteHelpAddress | null = null, fromAddress: string | null = null): FamilySite => ({
  name: 'Example Site',
  family,
  email: { fromAddress, replyTo },
});

describe('the families are auth-kit’s themes', () => {
  it('has exactly auth-kit’s three families', () => {
    expect([...SITE_FAMILIES].sort()).toEqual(Object.keys(FAMILY_THEMES).sort());
    expect(Object.keys(FAMILY_HELP_MAILBOX).sort()).toEqual(['osbm', 'personal', 'unc']);
  });

  it('names the family in the sender for work sites, and the site alone for personal ones', () => {
    expect(senderDisplayName('Example Site', 'osbm')).toBe('Example Site (NC OSBM)');
    expect(senderDisplayName('Example Site', 'unc')).toBe('Example Site (UNC)');
    expect(senderDisplayName('Example Site', 'personal')).toBe('Example Site');
  });

  it('says who manages a work site in the footer, and names nobody on a personal one (register E4)', () => {
    expect(siteTheme(make('osbm', 'reports-help@example.org')).footer).toBe('This site is managed by the NC Office of State Budget and Management');
    expect(siteTheme(make('unc', 'reports-help@example.org')).footer).toBe('This site is managed by UNC-Chapel Hill');
    expect(siteTheme(make('personal')).footer).toBeNull();
  });

  it('names the owner on the help screens of work sites only ("the {Site} team" on personal ones)', () => {
    expect(FAMILY_NAMES_OWNER).toEqual({ osbm: true, unc: true, personal: false });
    for (const family of SITE_FAMILIES) expect(FAMILY_THEMES[family].help.named).toBe(FAMILY_NAMES_OWNER[family]);
    expect(signInHelpProp({ ...make('osbm'), ownerName: ' Jordan Lee ' }, 'help@example.org')).toEqual({ address: 'help@example.org', owner: 'Jordan Lee' });
    expect(signInHelpProp({ ...make('personal'), ownerName: null }, 'help@example.org')).toEqual({ address: 'help@example.org' });
  });
});

describe('the sender (register A10, F11)', () => {
  it('is sign-in@yokum.app for personal sites, and auth-kit’s themes agree for every family', () => {
    expect(FAMILY_SENDER.personal).toBe('sign-in@yokum.app');
    for (const family of SITE_FAMILIES) expect(FAMILY_SENDER[family], family).toBe(FAMILY_THEMES[family].senderAddress);
    expect(senderAddressProblems(FAMILY_SENDER.personal)).toEqual([]);
    expect(senderAddressFor(make('personal'))).toBe('sign-in@yokum.app');
  });

  it('takes a work site’s own sender, lowercased (a personal site may only use the family’s: lib/site-checks.ts)', () => {
    expect(senderAddressFor(make('unc', 'reports-help@example.org', ' Sign-In@Reports.Example.org '))).toBe('sign-in@reports.example.org');
  });

  it('refuses a work site with no sender of its own while its family has none, naming the fix', () => {
    for (const family of ['osbm', 'unc'] as const) {
      if (FAMILY_SENDER[family] !== null) continue;
      expect(() => senderAddressFor(make(family, 'reports-help@example.org'))).toThrow(/needs a sender[\s\S]*email\.fromAddress/);
    }
  });
});

describe('the help address (register E4c, F11; auth-kit ADR 0024)', () => {
  it('is help@yokum.app for personal sites, a role-based mailbox auth-kit accepts, and auth-kit’s themes agree for every family', () => {
    expect(FAMILY_HELP_MAILBOX.personal).toBe('help@yokum.app');
    for (const family of SITE_FAMILIES) expect(FAMILY_HELP_MAILBOX[family], family).toBe(FAMILY_THEMES[family].help.address);
    expect(helpAddressProblems(FAMILY_HELP_MAILBOX.personal)).toEqual([]);
    expect(helpAddressFor(make('personal'))).toBe('help@yokum.app');
  });

  it('keeps a person’s own address only as acknowledged ({ address, personal: true }), for auth-kit to see', () => {
    expect(helpSettingFor(make('personal', { address: ' Jordan.Lee@Example.org ', personal: true }))).toEqual({ address: 'jordan.lee@example.org', personal: true });
    expect(helpAddressFor(make('personal', { address: 'jordan.lee@example.org', personal: true }))).toBe('jordan.lee@example.org');
    expect(siteTheme(make('personal', { address: 'jordan.lee@example.org', personal: true })).help).toMatchObject({ address: 'jordan.lee@example.org', personal: true });
    expect(() => helpSettingFor(make('personal', { address: 'jordan.lee@example.org', personal: false as unknown as true }))).toThrow(/personal: true/);
  });

  it('takes a site’s own mailbox over the family’s, lowercased', () => {
    expect(helpAddressFor(make('personal', ' Reports-Help@Example.org '))).toBe('reports-help@example.org');
  });

  it('refuses a work site with no mailbox of its own while its family has none, naming the fix', () => {
    for (const family of ['osbm', 'unc'] as const) {
      if (FAMILY_HELP_MAILBOX[family] !== null) continue;
      expect(() => helpAddressFor(make(family))).toThrow(/needs a help address[\s\S]*email\.replyTo/);
      expect(helpAddressFor(make(family, 'reports-help@example.org'))).toBe('reports-help@example.org');
    }
  });

  it('refuses a family that isn’t in the table', () => {
    expect(() => helpAddressFor({ ...make('personal'), family: 'acme' as FamilySite['family'] })).toThrow(/isn't one of osbm, unc, personal/);
  });

  it('puts the help address in this site’s theme (the screens and emails read it there)', () => {
    expect(siteTheme(site).help.address).toBe(helpAddressFor(site));
  });
});

describe('this site', () => {
  it('has a sender name auth-kit’s pool settings accept (no < > " or line breaks) and a usable help address', () => {
    expect(senderDisplayName(site.name, site.family)).not.toMatch(/[<>"\r\n]/);
    expect(helpAddressProblems(helpAddressFor(site))).toEqual([]);
  });

  it('uses its card style (Quiet by default; register E5)', () => {
    expect(site.cardStyle).toBe('quiet');
    expect(siteTheme(site).cardStyle).toBe(site.cardStyle);
    expect(siteTheme({ ...site, cardStyle: 'porcelain' }).cardStyle).toBe('porcelain');
  });

  it('uses its own email hint over the family’s when it sets one', () => {
    expect(siteTheme({ ...site, emailHint: 'name@partner.example.org' }).emailHint).toBe('name@partner.example.org');
    expect(siteTheme({ ...site, emailHint: null }).emailHint).toBe(FAMILY_THEMES[site.family].emailHint);
  });
});
