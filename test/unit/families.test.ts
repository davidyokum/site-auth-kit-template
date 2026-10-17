/**
 * The family table's text (site.families.ts), from the sign-in design report (5.1, 7.2): the
 * sender's display name and the footer of the email the site sends. This file and the table are
 * the two the hygiene test lets name an employer, by exact path (test/unit/hygiene.test.ts).
 */
import { describe, expect, it } from 'vitest';
import { site } from '@/site.config';
import { emailFooter, type FamilySite, SITE_FAMILIES, senderDisplayName } from '@/site.families';

const make = (family: FamilySite['family'], extra: { familyUnit?: string | null; replyTo?: string | null } = {}): FamilySite => ({
  name: 'Example Site',
  family,
  familyUnit: extra.familyUnit ?? null,
  email: { replyTo: extra.replyTo ?? null },
});

describe('the sender’s display name', () => {
  it('names the family for work sites, and is the site’s name alone for personal ones', () => {
    expect(senderDisplayName(make('osbm'))).toBe('Example Site (NC OSBM)');
    expect(senderDisplayName(make('unc'))).toBe('Example Site (UNC)');
    expect(senderDisplayName(make('personal'))).toBe('Example Site');
  });
});

describe('the email footer', () => {
  it('says who runs the site', () => {
    expect(emailFooter(make('osbm'))).toBe('Example Site is run by the NC Office of State Budget and Management.');
    expect(emailFooter(make('unc'))).toBe('A UNC-Chapel Hill project.');
    expect(emailFooter(make('personal'))).toBe('Made by Yokum Lab.');
  });

  it('names the UNC unit when there is one (and only for UNC)', () => {
    expect(emailFooter(make('unc', { familyUnit: 'Example Unit' }))).toBe('A UNC-Chapel Hill Example Unit project.');
    expect(emailFooter(make('unc', { familyUnit: '  ' }))).toBe('A UNC-Chapel Hill project.');
    expect(emailFooter(make('personal', { familyUnit: 'Example Unit' }))).toBe('Made by Yokum Lab.');
  });

  it('adds "Help: {help}." when the site has a help (Reply-To) address', () => {
    const help = { replyTo: 'help@example.com' };
    expect(emailFooter(make('osbm', help))).toBe('Example Site is run by the NC Office of State Budget and Management. Help: help@example.com.');
    expect(emailFooter(make('unc', { ...help, familyUnit: 'Example Unit' }))).toBe('A UNC-Chapel Hill Example Unit project. Help: help@example.com.');
    expect(emailFooter(make('personal', help))).toBe('Made by Yokum Lab. Help: help@example.com.');
  });

  it('treats a site name as text ($ patterns included)', () => {
    expect(emailFooter({ ...make('osbm'), name: 'Costs $& More' })).toBe('Costs $& More is run by the NC Office of State Budget and Management.');
  });

  it('refuses a family that isn’t in the table', () => {
    expect(() => emailFooter({ ...make('personal'), family: 'acme' as FamilySite['family'] })).toThrow(/isn't one of osbm, unc, personal/);
  });
});

describe('the table and this site', () => {
  it('has exactly the three families, text only (themes come later)', () => {
    expect(Object.keys(SITE_FAMILIES).sort()).toEqual(['osbm', 'personal', 'unc']);
    for (const family of Object.values(SITE_FAMILIES)) expect(Object.keys(family).sort()).toEqual(['footer', 'senderSuffix']);
  });

  it('gives this site a sender name auth-kit’s pool settings accept (no < > " or line breaks), and a help address or none', () => {
    expect(senderDisplayName(site)).not.toMatch(/[<>"\r\n]/);
    expect(site.email.replyTo === null || /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(site.email.replyTo)).toBe(true);
  });
});
